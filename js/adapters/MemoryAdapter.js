/**
 * MemoryAdapter - In-memory storage implementation for testing
 * Implements the DataAdapter interface
 * @author Factory Droid
 */

const { DataAdapter } = require('./DataAdapter.js');

/**
 * @class MemoryAdapter
 * @description In-memory graph database adapter
 * Stores nodes and relationships in JavaScript memory structures
 */
class MemoryAdapter extends DataAdapter {
    /**
     * Creates a new MemoryAdapter instance
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        super();
        
        this.nodes = new Map(); // id -> node
        this.relationships = new Map(); // id -> relationship
        this.nodeLabels = new Map(); // label -> Set of node ids
        this.relationshipTypes = new Map(); // type -> Set of relationship ids
        this.nodeProperties = new Map(); // property -> Map of value -> Set of node ids
        this.relationshipProperties = new Map(); // property -> Map of value -> Set of relationship ids
        this.nodeRelationships = new Map(); // node id -> Set of relationship ids
        
        this.nodeIdCounter = 1;
        this.relationshipIdCounter = 1;
        
        this.subscriptions = new Map(); // pattern -> Set of callbacks
        this.isHealthy = true;
        this.connectionTime = Date.now();
    }

    /**
     * Connects to the in-memory storage
     * @param {Object} config - Connection configuration (ignored for memory)
     * @returns {Promise<void>}
     */
    async connect(config = {}) {
        // In-memory storage doesn't need connection setup
        this.isHealthy = true;
        this.connectionTime = Date.now();
    }

    /**
     * Disconnects from in-memory storage
     * @returns {Promise<void>}
     */
    async disconnect() {
        // Clear all data
        this.nodes.clear();
        this.relationships.clear();
        this.nodeLabels.clear();
        this.relationshipTypes.clear();
        this.nodeProperties.clear();
        this.relationshipProperties.clear();
        this.nodeRelationships.clear();
        this.subscriptions.clear();
        
        this.isHealthy = false;
    }

    /**
     * Streams graph elements matching the query criteria
     * @param {Object} query - Query object
     * @param {Object} options - Streaming options
     * @returns {AsyncGenerator<GraphElement>} Stream of matching elements
     */
    async *stream(query, options = {}) {
        if (query.type === 'node') {
            yield* this.streamNodes(query, options);
        } else if (query.type === 'relationship') {
            yield* this.streamRelationships(query, options);
        } else {
            throw new Error(`Unsupported query type: ${query.type}`);
        }
    }

    /**
     * Streams nodes matching the query
     * @param {Object} query - Node query
     * @param {Object} options - Streaming options
     * @returns {AsyncGenerator<Object>} Stream of matching nodes
     * @private
     */
    async *streamNodes(query, options) {
        let candidateNodes = new Set(this.nodes.keys());
        
        // Filter by ID
        if (query.id) {
            if (this.nodes.has(query.id)) {
                candidateNodes = new Set([query.id]);
            } else {
                candidateNodes = new Set();
            }
        }
        
        // Filter by labels
        if (query.labels && query.labels.length > 0) {
            const labelFilteredNodes = new Set();
            
            for (const label of query.labels) {
                const labeledNodes = this.nodeLabels.get(label) || new Set();
                for (const nodeId of labeledNodes) {
                    if (candidateNodes.has(nodeId)) {
                        labelFilteredNodes.add(nodeId);
                    }
                }
            }
            
            candidateNodes = labelFilteredNodes;
        }
        
        // Filter by properties
        if (query.properties && Object.keys(query.properties).length > 0) {
            const propertyFilteredNodes = new Set();
            
            for (const nodeData of candidateNodes) {
                const node = this.nodes.get(nodeData);
                if (this.matchesProperties(node.properties, query.properties)) {
                    propertyFilteredNodes.add(nodeData);
                }
            }
            
            candidateNodes = propertyFilteredNodes;
        }
        
        // Yield matching nodes
        for (const nodeId of candidateNodes) {
            const node = this.nodes.get(nodeId);
            if (node) {
                let nodeCopy = JSON.parse(JSON.stringify(node));
                nodeCopy.type = 'node';
                yield nodeCopy;
            }
        }
    }

    /**
     * Streams relationships matching the query
     * @param {Object} query - Relationship query
     * @param {Object} options - Streaming options
     * @returns {AsyncGenerator<Object>} Stream of matching relationships
     * @private
     */
    async *streamRelationships(query, options) {
        let candidateRelationships = new Set(this.relationships.keys());
        
        // Filter by ID
        if (query.id) {
            if (this.relationships.has(query.id)) {
                candidateRelationships = new Set([query.id]);
            } else {
                candidateRelationships = new Set();
            }
        }
        
        // Filter by relationship type
        if (query.relType) {
            const typedRels = this.relationshipTypes.get(query.relType) || new Set();
            candidateRelationships = new Set([...candidateRelationships].filter(id => typedRels.has(id)));
        }
        
        // Filter by from/to nodes
        if (query.from !== undefined && query.to !== undefined) {
            const fromConnectedRels = this.nodeRelationships.get(query.from) || new Set();
            const filteredRels = new Set();
            
            for (const relId of fromConnectedRels) {
                if (candidateRelationships.has(relId)) {
                    const rel = this.relationships.get(relId);
                    if (rel && rel.to === query.to) {
                        filteredRels.add(relId);
                    }
                }
            }
            
            candidateRelationships = filteredRels;
        } else if (query.from !== undefined) {
            const fromConnectedRels = this.nodeRelationships.get(query.from) || new Set();
            candidateRelationships = new Set([...candidateRelationships].filter(id => fromConnectedRels.has(id)));
        } else if (query.to !== undefined) {
            // Need to scan all relationships to find ones ending at query.to
            const filteredRels = new Set();
            
            for (const relId of candidateRelationships) {
                const rel = this.relationships.get(relId);
                if (rel && rel.to === query.to) {
                    filteredRels.add(relId);
                }
            }
            
            candidateRelationships = filteredRels;
        }
        
        // Filter by properties
        if (query.properties && Object.keys(query.properties).length > 0) {
            const propertyFilteredRels = new Set();
            
            for (const relId of candidateRelationships) {
                const rel = this.relationships.get(relId);
                if (this.matchesProperties(rel.properties, query.properties)) {
                    propertyFilteredRels.add(relId);
                }
            }
            
            candidateRelationships = propertyFilteredRels;
        }
        
        // Yield matching relationships
        for (const relId of candidateRelationships) {
            const rel = this.relationships.get(relId);
            if (rel) {
                let relCopy = JSON.parse(JSON.stringify(rel));
                relCopy.type = 'relationship';
                yield relCopy;
            }
        }
    }

    /**
     * Writes a batch of graph elements to storage
     * @param {GraphElement[]} batch - Array of elements to write
     * @param {Object} options - Write options
     * @returns {Promise<void>}
     */
    async batchWrite(batch, options = {}) {
        const operations = [];
        
        for (const element of batch) {
            if (element.type === 'node') {
                operations.push(() => this.writeNode(element));
            } else if (element.type === 'relationship') {
                operations.push(() => this.writeRelationship(element));
            } else {
                throw new Error(`Unsupported element type: ${element.type}`);
            }
        }
        
        // Execute operations (atomic if specified)
        if (options.atomic) {
            const savedState = this.createBackup();
            try {
                for (const operation of operations) {
                    operation();
                }
            } catch (error) {
                // Restore state on failure
                this.restoreBackup(savedState);
                throw error;
            }
        } else {
            for (const operation of operations) {
                operation();
            }
        }
        
        // Notify subscribers of changes
        this.notifySubscribers('batchWrite', { batch });
    }

    /**
     * Writes a single node to storage
     * @param {Object} node - Node data
     * @private
     */
    writeNode(node) {
        const nodeId = node.id || (this.nodeIdCounter++).toString();
        
        if (this.nodes.has(nodeId)) {
            throw new Error(`Node with ID ${nodeId} already exists`);
        }
        
        // Validate that from/to nodes exist for relationships
        const nodeData = {
            id: nodeId,
            labels: node.labels || [],
            properties: node.properties || {},
            type: 'node'
        };
        
        // Store node
        this.nodes.set(nodeId, nodeData);
        
        // Update label index
        for (const label of nodeData.labels) {
            if (!this.nodeLabels.has(label)) {
                this.nodeLabels.set(label, new Set());
            }
            this.nodeLabels.get(label).add(nodeId);
        }
        
        // Update property index
        for (const [key, value] of Object.entries(nodeData.properties)) {
            if (!this.nodeProperties.has(key)) {
                this.nodeProperties.set(key, new Map());
            }
            const propIndex = this.nodeProperties.get(key);
            if (!propIndex.has(value)) {
                propIndex.set(value, new Set());
            }
            propIndex.get(value).add(nodeId);
        }
        
        return nodeData;
    }

    /**
     * Writes a single relationship to storage
     * @param {Object} relationship - Relationship data
     * @throws {Error} If nodes don't exist or relationship already exists
     * @private
     */
    writeRelationship(relationship) {
        const relId = relationship.id || (this.relationshipIdCounter++).toString();
        
        if (this.relationships.has(relId)) {
            throw new Error(`Relationship with ID ${relId} already exists`);
        }
        
        // Validate that from/to nodes exist
        if (!this.nodes.has(relationship.from)) {
            throw new Error(`From node ${relationship.from} does not exist`);
        }
        
        if (!this.nodes.has(relationship.to)) {
            throw new Error(`To node ${relationship.to} does not exist`);
        }
        
        const relData = {
            id: relId,
            relType: relationship.relType,
            from: relationship.from,
            to: relationship.to,
            properties: relationship.properties || {},
            type: 'relationship'
        };
        
        // Store relationship
        this.relationships.set(relId, relData);
        
        // Update relationship type index
        if (!this.relationshipTypes.has(relData.relType)) {
            this.relationshipTypes.set(relData.relType, new Set());
        }
        this.relationshipTypes.get(relData.relType).add(relId);
        
        // Update property index
        for (const [key, value] of Object.entries(relData.properties)) {
            if (!this.relationshipProperties.has(key)) {
                this.relationshipProperties.set(key, new Map());
            }
            const propIndex = this.relationshipProperties.get(key);
            if (!propIndex.has(value)) {
                propIndex.set(value, new Set());
            }
            propIndex.get(value).add(relId);
        }
        
        // Update node relationship index
        if (!this.nodeRelationships.has(relData.from)) {
            this.nodeRelationships.set(relData.from, new Set());
        }
        this.nodeRelationships.get(relData.from).add(relId);
        
        if (relData.from !== relData.to) {
            if (!this.nodeRelationships.has(relData.to)) {
                this.nodeRelationships.set(relData.to, new Set());
            }
            this.nodeRelationships.get(relData.to).add(relId);
        }
        
        return relData;
    }

    /**
     * Deletes elements matching the given criteria
     * @param {Object} criteria - Deletion criteria
     * @param {Object} options - Deletion options
     * @returns {Promise<number>} Number of elements deleted
     */
    async delete(criteria, options = {}) {
        let deletedCount = 0;
        
        if (criteria.type === 'node') {
            const nodesToDelete = [];
            
            // Find nodes to delete
            for await (const node of this.streamNodes(criteria, {})) {
                nodesToDelete.push(node.id);
            }
            
            // Delete each node and possibly related relationships
            for (const nodeId of nodesToDelete) {
                deletedCount += await this.deleteNode(nodeId, options);
            }
        } else if (criteria.type === 'relationship') {
            const relationshipsToDelete = [];
            
            // Find relationships to delete
            for await (const rel of this.streamRelationships(criteria, {})) {
                relationshipsToDelete.push(rel.id);
            }
            
            // Delete each relationship
            for (const relId of relationshipsToDelete) {
                if (await this.deleteRelationship(relId)) {
                    deletedCount++;
                }
            }
        }
        
        // Notify subscribers of changes
        if (deletedCount > 0) {
            this.notifySubscribers('delete', { criteria, deletedCount });
        }
        
        return deletedCount;
    }

    /**
     * Deletes a single node and optionally related relationships
     * @param {string} nodeId - Node ID to delete
     * @param {Object} options - Deletion options
     * @returns {Promise<number>} Number of elements deleted
     * @private
     */
    async deleteNode(nodeId, options = {}) {
        const node = this.nodes.get(nodeId);
        if (!node) {
            return 0;
        }
        
        let deletedCount = 1; // The node itself
        
        // Handle cascading deletions
        if (options.cascade !== false) {
            const connectedRels = this.nodeRelationships.get(nodeId) || new Set();
            
            for (const relId of connectedRels) {
                if (await this.deleteRelationship(relId)) {
                    deletedCount++;
                }
            }
        }
        
        // Remove from all indexes
        this.nodes.delete(nodeId);
        
        // Remove from label indexes
        for (const label of node.labels) {
            const labeledNodes = this.nodeLabels.get(label);
            if (labeledNodes) {
                labeledNodes.delete(nodeId);
                if (labeledNodes.size === 0) {
                    this.nodeLabels.delete(label);
                }
            }
        }
        
        // Remove from property indexes
        for (const [key, value] of Object.entries(node.properties)) {
            const propIndex = this.nodeProperties.get(key);
            if (propIndex) {
                const valueSet = propIndex.get(value);
                if (valueSet) {
                    valueSet.delete(nodeId);
                    if (valueSet.size === 0) {
                        propIndex.delete(value);
                    }
                    if (propIndex.size === 0) {
                        this.nodeProperties.delete(key);
                    }
                }
            }
        }
        
        // Remove from node relationship index
        this.nodeRelationships.delete(nodeId);
        
        return deletedCount;
    }

    /**
     * Deletes a single relationship
     * @param {string} relId - Relationship ID to delete
     * @returns {Promise<boolean>} True if relationship was deleted
     * @private
     */
    async deleteRelationship(relId) {
        const rel = this.relationships.get(relId);
        if (!rel) {
            return false;
        }
        
        // Remove from all indexes
        this.relationships.delete(relId);
        
        // Remove from type index
        const typedRels = this.relationshipTypes.get(rel.relType);
        if (typedRels) {
            typedRels.delete(relId);
            if (typedRels.size === 0) {
                this.relationshipTypes.delete(rel.relType);
            }
        }
        
        // Remove from property indexes
        for (const [key, value] of Object.entries(rel.properties)) {
            const propIndex = this.relationshipProperties.get(key);
            if (propIndex) {
                const valueSet = propIndex.get(value);
                if (valueSet) {
                    valueSet.delete(relId);
                    if (valueSet.size === 0) {
                        propIndex.delete(value);
                    }
                    if (propIndex.size === 0) {
                        this.relationshipProperties.delete(key);
                    }
                }
            }
        }
        
        // Remove from node relationship indexes
        const fromRels = this.nodeRelationships.get(rel.from);
        if (fromRels) {
            fromRels.delete(relId);
            if (fromRels.size === 0) {
                this.nodeRelationships.delete(rel.from);
            }
        }
        
        const toRels = this.nodeRelationships.get(rel.to);
        if (toRels) {
            toRels.delete(relId);
            if (toRels.size === 0) {
                this.nodeRelationships.delete(rel.to);
            }
        }
        
        return true;
    }

    /**
     * Subscribes to real-time changes (limited implementation for memory adapter)
     * @param {Object} pattern - Subscription pattern
     * @param {Function} callback - Change callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(pattern, callback) {
        const patternKey = JSON.stringify(pattern);
        
        if (!this.subscriptions.has(patternKey)) {
            this.subscriptions.set(patternKey, new Set());
        }
        
        this.subscriptions.get(patternKey).add(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.subscriptions.get(patternKey);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.subscriptions.delete(patternKey);
                }
            }
        };
    }

    /**
     * Gets adapter capabilities
     * @returns {Object} Capabilities object
     */
    getCapabilities() {
        return {
            supportsStreaming: true,
            supportsBatching: true,
            supportsTransactions: false, // Basic implementation
            supportsReactive: true, // Basic subscription support
            features: ['nodes', 'relationships', 'properties', 'labels', 'types', 'batch_write', 'streaming']
        };
    }

    /**
     * Performs health check
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const startTime = Date.now();
        const latency = startTime - this.connectionTime;
        
        return {
            healthy: this.isHealthy,
            status: this.isHealthy ? 'healthy' : 'unhealthy',
            latency,
            nodeCount: this.nodes.size,
            relationshipCount: this.relationships.size,
            labelCount: this.nodeLabels.size,
            typeCount: this.relationshipTypes.size
        };
    }

    /**
     * Checks if properties match query criteria
     * @param {Object} objectProperties - Object properties
     * @param {Object} queryProperties - Query properties
     * @returns {boolean} True if properties match
     * @private
     */
    matchesProperties(objectProperties, queryProperties) {
        for (const [key, value] of Object.entries(queryProperties)) {
            if (!objectProperties.hasOwnProperty(key) || objectProperties[key] !== value) {
                return false;
            }
        }
        return true;
    }

    /**
     * Creates backup for atomic operations
     * @returns {Object} Backup state
     * @private
     */
    createBackup() {
        return {
            nodes: new Map(this.nodes),
            relationships: new Map(this.relationships),
            nodeLabels: new Map(this.nodeLabels),
            relationshipTypes: new Map(this.relationshipTypes),
            nodeProperties: new Map(this.nodeProperties),
            relationshipProperties: new Map(this.relationshipProperties),
            nodeRelationships: new Map(this.nodeRelationships),
            nodeIdCounter: this.nodeIdCounter,
            relationshipIdCounter: this.relationshipIdCounter
        };
    }

    /**
     * Restores backup on atomic operation failure
     * @param {Object} backup - Backup state
     * @private
     */
    restoreBackup(backup) {
        this.nodes = backup.nodes;
        this.relationships = backup.relationships;
        this.nodeLabels = backup.nodeLabels;
        this.relationshipTypes = backup.relationshipTypes;
        this.nodeProperties = backup.nodeProperties;
        this.relationshipProperties = backup.relationshipProperties;
        this.nodeRelationships = backup.nodeRelationships;
        this.nodeIdCounter = backup.nodeIdCounter;
        this.relationshipIdCounter = backup.relationshipIdCounter;
    }

    /**
     * Notifies subscribers of changes
     * @param {string} event - Event type
     * @param {Object} data - Event data
     * @private
     */
    notifySubscribers(event, data) {
        for (const [pattern, callbacks] of this.subscriptions) {
            for (const callback of callbacks) {
                try {
                    callback({ event, data });
                } catch (error) {
                    console.error('Subscription callback error:', error);
                }
            }
        }
    }

    /**
     * Gets statistics about the current state
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            nodes: this.nodes.size,
            relationships: this.relationships.size,
            labels: this.nodeLabels.size,
            relationshipTypes: this.relationshipTypes.size,
            properties: {
                nodes: this.nodeProperties.size,
                relationships: this.relationshipProperties.size
            },
            subscriptions: this.subscriptions.size
        };
    }
}

module.exports = { MemoryAdapter };
