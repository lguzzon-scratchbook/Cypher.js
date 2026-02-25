/**
 * @fileoverview Database class for CypherNG
 *
 * Represents the graph database with nodes and relationships.
 * Supports storage adapter injection for future persistence integration.
 *
 * @module CypherNG/data/Database
 */

// Forward declaration for JSDoc
var StringRecoder;

/**
 * Database class for managing graph data
 * @class
 * @param {Object} engine - Query engine instance
 * @param {Object} [storageAdapter] - Optional storage adapter for persistence
 */
class Database {
    /**
     * Creates a new Database
     * @param {Object} engine - Query engine instance
     * @param {Object} [storageAdapter] - Optional storage adapter
     */
    constructor(engine, storageAdapter) {
        /** @private @type {Object} */
        this._engine = engine;
        /** @private @type {Object} */
        this._storageAdapter = storageAdapter || null;
        /** @private @type {Node[]} */
        this._nodes = [];
        /** @private @type {number} */
        this._NODE_ID_FACTORY = 0;
        /** @private @type {Object} */
        this._nodeIdLookup = {};
        /** @private @type {Object} */
        this._labelNodeIdLookup = {};
        /** @private @type {Relationship[]} */
        this._relationships = [];
        /** @private @type {number} */
        this._RELATIONSHIP_ID_FACTORY = 0;
        /** @private @type {Object} */
        this._relationshipLookup = {};
        /** @private @type {Object} */
        this._relationshipIdsByNodeIdLookup = {};
        /** @private @type {Object} */
        this._relationshipIdsByNodeIdLookupIncoming = {};
        /** @private @type {Object} */
        this._relationshipIdLookup = {};
        /** @private @type {Object} */
        this._typeRelationshipIdLookup = {};
        /** @private @type {Object} */
        this._tables = {};
        /** @private @type {StringRecoder} */
        this._stringRecoder = null;

        // Initialize string recoder if available
        if (typeof StringRecoder !== 'undefined') {
            this._stringRecoder = new StringRecoder();
        }
    }

    /**
     * Recodes a value using string recoder
     * @private
     * @param {*} val - Value to recode
     * @returns {*} Recoded value
     */
    _recode(val) {
        if (this._stringRecoder) {
            return this._stringRecoder.recode(val);
        }
        return val;
    }

    /**
     * Initializes relationship lookup for a node pair
     * @private
     * @param {number} fromNodeId - From node ID
     * @param {number} toNodeId - To node ID
     */
    _initializeRelationshipLookup(fromNodeId, toNodeId) {
        if (fromNodeId != undefined) {
            if (!this._relationshipLookup[fromNodeId]) {
                this._relationshipLookup[fromNodeId] = {};
            }
            if (toNodeId != undefined) {
                if (!this._relationshipLookup[fromNodeId][toNodeId]) {
                    this._relationshipLookup[fromNodeId][toNodeId] = [];
                }
            }
        }
    }

    /**
     * Looks up relationships between nodes
     * @private
     * @param {number} fromNodeId - From node ID
     * @param {number} toNodeId - To node ID
     * @returns {number[]} Array of relationship IDs
     */
    _lookupRelationships(fromNodeId, toNodeId) {
        this._initializeRelationshipLookup(fromNodeId, toNodeId);
        if (fromNodeId != undefined) {
            if (toNodeId != undefined) {
                return this._relationshipLookup[fromNodeId][toNodeId];
            } else if (toNodeId == undefined) {
                var relationshipIds = [];
                for (var nodeId in this._relationshipLookup[fromNodeId]) {
                    relationshipIds = relationshipIds.concat(
                        this._relationshipLookup[fromNodeId][nodeId]
                    );
                }
                return relationshipIds;
            }
        }
        return [];
    }

    /**
     * Adds a relationship to the lookup
     * @private
     * @param {number} fromNodeId - From node ID
     * @param {number} toNodeId - To node ID
     * @param {number} relationshipId - Relationship ID
     */
    _addLookupRelationship(fromNodeId, toNodeId, relationshipId) {
        this._initializeRelationshipLookup(fromNodeId, toNodeId);
        this._relationshipLookup[fromNodeId][toNodeId].push(relationshipId);
        this._addLookupRelationshipIdsByNodeId(fromNodeId, relationshipId);
        this._addLookupRelationshipIdsByNodeIdIncoming(toNodeId, relationshipId);
    }

    /**
     * Initializes relationship IDs lookup for a node
     * @private
     * @param {number} nodeId - Node ID
     */
    _initializeRelationshipIdsByNodeIdLookup(nodeId) {
        if (!this._relationshipIdsByNodeIdLookup[nodeId]) {
            this._relationshipIdsByNodeIdLookup[nodeId] = [];
        }
    }

    /**
     * Looks up relationship IDs by node ID (outgoing)
     * @private
     * @param {number} nodeId - Node ID
     * @returns {number[]} Array of relationship IDs
     */
    _lookupRelationshipIdsByNodeId(nodeId) {
        this._initializeRelationshipIdsByNodeIdLookup(nodeId);
        return this._relationshipIdsByNodeIdLookup[nodeId];
    }

    /**
     * Adds relationship ID to node lookup (outgoing)
     * @private
     * @param {number} nodeId - Node ID
     * @param {number} relationshipId - Relationship ID
     */
    _addLookupRelationshipIdsByNodeId(nodeId, relationshipId) {
        this._initializeRelationshipIdsByNodeIdLookup(nodeId);
        this._relationshipIdsByNodeIdLookup[nodeId].push(relationshipId);
    }

    /**
     * Initializes incoming relationship IDs lookup for a node
     * @private
     * @param {number} nodeId - Node ID
     */
    _initializeRelationshipIdsByNodeIdLookupIncoming(nodeId) {
        if (!this._relationshipIdsByNodeIdLookupIncoming[nodeId]) {
            this._relationshipIdsByNodeIdLookupIncoming[nodeId] = [];
        }
    }

    /**
     * Looks up relationship IDs by node ID (incoming)
     * @private
     * @param {number} nodeId - Node ID
     * @returns {number[]} Array of relationship IDs
     */
    _lookupRelationshipIdsByNodeIdIncoming(nodeId) {
        this._initializeRelationshipIdsByNodeIdLookupIncoming(nodeId);
        return this._relationshipIdsByNodeIdLookupIncoming[nodeId];
    }

    /**
     * Adds relationship ID to node lookup (incoming)
     * @private
     * @param {number} nodeId - Node ID
     * @param {number} relationshipId - Relationship ID
     */
    _addLookupRelationshipIdsByNodeIdIncoming(nodeId, relationshipId) {
        this._initializeRelationshipIdsByNodeIdLookupIncoming(nodeId);
        this._relationshipIdsByNodeIdLookupIncoming[nodeId].push(relationshipId);
    }

    /**
     * Initializes node ID lookup for a property
     * @private
     * @param {string} key - Property key
     * @param {*} value - Property value
     */
    _initializeNodeIdLookup(key, value) {
        if (!this._nodeIdLookup[key]) {
            this._nodeIdLookup[key] = {};
        }
        if (!this._nodeIdLookup[key][value]) {
            this._nodeIdLookup[key][value] = [];
        }
    }

    /**
     * Looks up node IDs by property
     * @private
     * @param {string} key - Property key
     * @param {*} value - Property value
     * @returns {number[]} Array of node IDs
     */
    _lookupNodeIds(key, value) {
        var recodedKey = this._recode(key);
        var recodedValue = this._recode(value);
        this._initializeNodeIdLookup(recodedKey, recodedValue);
        return this._nodeIdLookup[recodedKey][recodedValue];
    }

    /**
     * Initializes relationship ID lookup for a property
     * @private
     * @param {string} key - Property key
     * @param {*} value - Property value
     */
    _initializeRelationshipIdLookup(key, value) {
        if (!this._relationshipIdLookup[key]) {
            this._relationshipIdLookup[key] = {};
        }
        if (!this._relationshipIdLookup[key][value]) {
            this._relationshipIdLookup[key][value] = [];
        }
    }

    /**
     * Adds node ID to lookup
     * @private
     * @param {string} key - Property key
     * @param {*} value - Property value
     * @param {number} nodeId - Node ID
     */
    _addLookupNodeId(key, value, nodeId) {
        var recodedKey = this._recode(key);
        var recodedValue = this._recode(value);
        this._initializeNodeIdLookup(recodedKey, recodedValue);
        this._nodeIdLookup[recodedKey][recodedValue].push(nodeId);
    }

    /**
     * Adds relationship ID to lookup
     * @private
     * @param {string} key - Property key
     * @param {*} value - Property value
     * @param {number} relationshipId - Relationship ID
     */
    _addLookupRelationshipId(key, value, relationshipId) {
        var recodedKey = this._recode(key);
        var recodedValue = this._recode(value);
        this._initializeRelationshipIdLookup(recodedKey, recodedValue);
        this._relationshipIdLookup[recodedKey][recodedValue].push(relationshipId);
    }

    /**
     * Initializes label-node ID lookup
     * @private
     * @param {string} label - Label name
     */
    _initializeLabelNodeIdLookup(label) {
        if (!this._labelNodeIdLookup[label]) {
            this._labelNodeIdLookup[label] = [];
        }
    }

    /**
     * Looks up node IDs by label
     * @private
     * @param {string} label - Label name
     * @returns {number[]} Array of node IDs
     */
    _lookupLabelNodeIds(label) {
        var recodedLabel = this._recode(label);
        this._initializeLabelNodeIdLookup(recodedLabel);
        return this._labelNodeIdLookup[recodedLabel];
    }

    /**
     * Initializes type-relationship ID lookup
     * @private
     * @param {string} type - Relationship type
     * @returns {boolean} True if already exists
     */
    _initializeTypeRelationshipIdLookup(type) {
        if (!this._typeRelationshipIdLookup[type]) {
            this._typeRelationshipIdLookup[type] = [];
            return false;
        }
        return true;
    }

    /**
     * Adds label-node ID lookup entry
     * @private
     * @param {string} label - Label name
     * @param {number} nodeId - Node ID
     */
    _addLabelNodeIdLookup(label, nodeId) {
        var recodedLabel = this._recode(label);
        this._initializeLabelNodeIdLookup(recodedLabel);
        var equalsNodeIdCheck = function(el) {
            return el == nodeId;
        };
        if (nodeId != undefined && !this._labelNodeIdLookup[recodedLabel].find(equalsNodeIdCheck)) {
            this._labelNodeIdLookup[recodedLabel].push(nodeId);
        }
    }

    /**
     * Gets free node ID
     * @private
     * @returns {number} Free node ID
     */
    _getFreeNodeId() {
        while (this._nodes[this._NODE_ID_FACTORY]) {
            this._NODE_ID_FACTORY++;
        }
        return this._NODE_ID_FACTORY;
    }

    /**
     * Adds a node to the database
     * @param {Node} node - Node to add
     * @param {number} [givenId] - Optional specific ID
     */
    addNode(node, givenId) {
        // Determine the node ID: use givenId if provided, otherwise use node's existing ID, or generate new one
        var nodeId = givenId;
        if (!nodeId && node.id()) {
            // Node already has an ID, use that
            nodeId = node.id();
        } else if (!nodeId) {
            // Generate new ID
            nodeId = this._getFreeNodeId();
        }

        // Always set the ID on the node (unless already set to same value)
        if (node.id() !== nodeId) {
            node.setId(nodeId);
        }

        // Check for duplicate - always check if ID already exists
        if (this._nodes[nodeId]) {
            throw "Node with ID " + nodeId + " already exists in the database.";
        }

        this._nodes[nodeId] = node;

        // Index properties
        var rawProps = node.getRawProperties();
        for (var key in rawProps) {
            this._addLookupNodeId(
                key,
                node.getLocalProperty(key),
                node.id()
            );
        }

        // Index labels
        var labels = node.labels();
        for (var label in labels) {
            this._addLabelNodeIdLookup(
                label,
                node.id()
            );
        }

        // Update engine stats
        if (this._engine && this._engine.statement) {
            this._engine.statement().setNodesAdded(
                this._engine.statement().getNodesAdded() + 1
            );
        }

        // Persist if storage adapter available
        if (this._storageAdapter && this._storageAdapter.addNode) {
            this._storageAdapter.addNode(node);
        }
    }

    /**
     * Gets free relationship ID
     * @private
     * @returns {number} Free relationship ID
     */
    _getFreeRelationshipId() {
        while (this._relationships[this._RELATIONSHIP_ID_FACTORY]) {
            this._RELATIONSHIP_ID_FACTORY++;
        }
        return this._RELATIONSHIP_ID_FACTORY;
    }

    /**
     * Adds a relationship to the database
     * @param {Relationship} relationship - Relationship to add
     * @param {number} [givenId] - Optional specific ID
     */
    addRelationship(relationship, givenId) {
        var relationshipId = null;
        if (!givenId) {
            relationshipId = this._getFreeRelationshipId();
        } else if (givenId) {
            if (this._nodes[givenId]) {
                throw "Relationship with ID " + givenId + " already exists in the database.";
            }
            relationshipId = givenId;
        }
        relationship.setId(relationshipId);
        this._relationships[relationshipId] = relationship;

        // Add to adjacency lookup
        this._addLookupRelationship(
            relationship.getFromNode().id(),
            relationship.getToNode().id(),
            relationship.id()
        );

        // Add reverse for non-self relationships
        if (relationship.getToNode().id() != relationship.getFromNode().id()) {
            this._addLookupRelationship(
                relationship.getToNode().id(),
                relationship.getFromNode().id(),
                relationship.id()
            );
        }

        // Index properties
        var props = relationship.getProperties();
        for (var key in props) {
            this._addLookupRelationshipId(
                key,
                relationship.getProperty(key),
                relationship.id()
            );
        }

        // Index by type
        this._addTypeRelationshipIdLookup(
            relationship.getType(),
            relationship.id()
        );

        relationship.setIsAdded();

        // Update engine stats
        if (this._engine && this._engine.statement) {
            this._engine.statement().setRelationshipsAdded(
                this._engine.statement().getRelationshipsAdded() + 1
            );
        }

        // Persist if storage adapter available
        if (this._storageAdapter && this._storageAdapter.addRelationship) {
            this._storageAdapter.addRelationship(relationship);
        }
    }

    /**
     * Adds type-relationship ID lookup entry
     * @private
     * @param {string} type - Relationship type
     * @param {number} relationshipId - Relationship ID
     */
    _addTypeRelationshipIdLookup(type, relationshipId) {
        if (relationshipId == undefined) {
            return;
        }
        var recodedType = this._recode(type);
        this._initializeTypeRelationshipIdLookup(recodedType);
        var equalsRelationshipIdCheck = function(el) {
            return el == relationshipId;
        };
        if (!this._typeRelationshipIdLookup[recodedType].find(equalsRelationshipIdCheck)) {
            this._typeRelationshipIdLookup[recodedType].push(relationshipId);
            this._relationships[relationshipId].setStoredType(type);
        }
    }

    /**
     * Gets a node by ID
     * @param {number} id - Node ID
     * @returns {Node|null} Node or null
     */
    getNodeById(id) {
        return this._nodes[id] || null;
    }

    /**
     * Gets all nodes
     * @returns {Node[]} All nodes
     */
    getNodes() {
        return this._nodes;
    }

    /**
     * Gets a relationship by ID
     * @param {number} id - Relationship ID
     * @returns {Relationship|null} Relationship or null
     */
    getRelationshipById(id) {
        return this._relationships[id] || null;
    }

    /**
     * Gets all relationships
     * @returns {Relationship[]} All relationships
     */
    getRelationships() {
        return this._relationships;
    }

    /**
     * Gets nodes by label
     * @param {string} label - Label name
     * @returns {Node[]} Nodes with the label
     */
    getNodesByLabel(label) {
        var nodeIds = this._lookupLabelNodeIds(label);
        var nodes = [];
        if (nodeIds) {
            for (var i = 0; i < nodeIds.length; i++) {
                var node = this.getNodeById(nodeIds[i]);
                if (node) {
                    nodes.push(node);
                }
            }
        }
        return nodes;
    }

    /**
     * Gets nodes by property
     * @param {string} key - Property key
     * @param {*} value - Property value
     * @returns {Node[]} Nodes with the property value
     */
    getNodesByProperty(key, value) {
        var nodeIds = this._lookupNodeIds(key, value);
        var nodes = [];
        if (nodeIds) {
            for (var i = 0; i < nodeIds.length; i++) {
                var node = this.getNodeById(nodeIds[i]);
                if (node) {
                    nodes.push(node);
                }
            }
        }
        return nodes;
    }

    /**
     * Gets relationships by type
     * @param {string} type - Relationship type
     * @returns {Relationship[]} Relationships of the type
     */
    getRelationshipsByType(type) {
        var recodedType = this._recode(type);
        this._initializeTypeRelationshipIdLookup(recodedType);
        var relIds = this._typeRelationshipIdLookup[recodedType];
        var relationships = [];
        if (relIds) {
            for (var i = 0; i < relIds.length; i++) {
                var rel = this.getRelationshipById(relIds[i]);
                if (rel) {
                    relationships.push(rel);
                }
            }
        }
        return relationships;
    }

    /**
     * Gets relationships between two nodes
     * @param {number} fromNodeId - From node ID
     * @param {number} toNodeId - To node ID
     * @returns {Relationship[]} Relationships between nodes
     */
    getRelationshipsBetween(fromNodeId, toNodeId) {
        var relIds = this._lookupRelationships(fromNodeId, toNodeId);
        var relationships = [];
        if (relIds) {
            for (var i = 0; i < relIds.length; i++) {
                var rel = this.getRelationshipById(relIds[i]);
                if (rel) {
                    relationships.push(rel);
                }
            }
        }
        return relationships;
    }

    /**
     * Gets all labels in the database
     * @returns {string[]} Array of label names
     */
    getLabels() {
        return Object.keys(this._labelNodeIdLookup);
    }

    /**
     * Gets all relationship types in the database
     * @returns {string[]} Array of relationship types
     */
    getRelationshipTypes() {
        return Object.keys(this._typeRelationshipIdLookup);
    }

    /**
     * Clears the database
     */
    clear() {
        this._nodes = [];
        this._NODE_ID_FACTORY = 0;
        this._nodeIdLookup = {};
        this._labelNodeIdLookup = {};
        this._relationships = [];
        this._RELATIONSHIP_ID_FACTORY = 0;
        this._relationshipLookup = {};
        this._relationshipIdsByNodeIdLookup = {};
        this._relationshipIdsByNodeIdLookupIncoming = {};
        this._relationshipIdLookup = {};
        this._typeRelationshipIdLookup = {};
        this._tables = {};

        // Clear storage if adapter available
        if (this._storageAdapter && this._storageAdapter.clear) {
            this._storageAdapter.clear();
        }
    }

    /**
     * Gets the node count
     * @returns {number} Number of nodes
     */
    nodeCount() {
        return this._nodes.filter(function(n) { return n != null; }).length;
    }

    /**
     * Gets the relationship count
     * @returns {number} Number of relationships
     */
    relationshipCount() {
        return this._relationships.filter(function(r) { return r != null; }).length;
    }

    /**
     * Gets the storage adapter
     * @returns {Object|null} Storage adapter
     */
    getStorageAdapter() {
        return this._storageAdapter;
    }

    /**
     * Sets a storage adapter
     * @param {Object} adapter - Storage adapter
     */
    setStorageAdapter(adapter) {
        this._storageAdapter = adapter;
    }

    /**
     * Gets relationships for a node (both incoming and outgoing)
     * @param {number} nodeId - Node ID
     * @returns {Relationship[]} Relationships connected to the node
     */
    getRelationshipsByNodeId(nodeId) {
        var relationships = [];
        var outgoing = this._lookupRelationshipIdsByNodeId(nodeId);
        var incoming = this._lookupRelationshipIdsByNodeIdIncoming(nodeId);

        if (outgoing) {
            for (var i = 0; i < outgoing.length; i++) {
                var rel = this.getRelationshipById(outgoing[i]);
                if (rel) relationships.push(rel);
            }
        }
        if (incoming) {
            for (var j = 0; j < incoming.length; j++) {
                var r = this.getRelationshipById(incoming[j]);
                if (r && relationships.indexOf(r) === -1) relationships.push(r);
            }
        }
        return relationships;
    }

    /**
     * Removes a label-node ID lookup entry
     * @private
     * @param {string} label - Label name
     * @param {number} nodeId - Node ID
     */
    _removeLabelNodeIdLookup(label, nodeId) {
        var recodedLabel = this._recode(label);
        if (this._labelNodeIdLookup[recodedLabel]) {
            var idx = this._labelNodeIdLookup[recodedLabel].indexOf(nodeId);
            if (idx !== -1) {
                this._labelNodeIdLookup[recodedLabel].splice(idx, 1);
            }
        }
    }

    /**
     * Removes a node ID from property lookup
     * @private
     * @param {string} key - Property key
     * @param {*} value - Property value
     * @param {number} nodeId - Node ID
     */
    _removeNodeIdFromPropertyLookup(key, value, nodeId) {
        var recodedKey = this._recode(key);
        var recodedValue = this._recode(value);
        if (this._nodeIdLookup[recodedKey] && this._nodeIdLookup[recodedKey][recodedValue]) {
            var idx = this._nodeIdLookup[recodedKey][recodedValue].indexOf(nodeId);
            if (idx !== -1) {
                this._nodeIdLookup[recodedKey][recodedValue].splice(idx, 1);
            }
        }
    }

    /**
     * Removes a node
     * @private
     * @param {number} nodeId - Node ID
     */
    _removeNode(nodeId) {
        if (this._nodes[nodeId]) {
            this._nodes[nodeId] = null;
            // Persist if storage adapter available
            if (this._storageAdapter && this._storageAdapter.removeNode) {
                this._storageAdapter.removeNode(nodeId);
            }
        }
    }

    /**
     * Removes a relationship ID from node adjacency lookup
     * @private
     * @param {number} nodeId - Node ID
     * @param {number} otherNodeId - Other node ID
     * @param {number} relationshipId - Relationship ID
     */
    _removeRelationshipIdFromNodeIdLookup(nodeId, otherNodeId, relationshipId) {
        if (this._relationshipLookup[nodeId] && this._relationshipLookup[nodeId][otherNodeId]) {
            var idx = this._relationshipLookup[nodeId][otherNodeId].indexOf(relationshipId);
            if (idx !== -1) {
                this._relationshipLookup[nodeId][otherNodeId].splice(idx, 1);
            }
        }
        // Also remove from relationship IDs lookup
        if (this._relationshipIdsByNodeIdLookup[nodeId]) {
            var idx2 = this._relationshipIdsByNodeIdLookup[nodeId].indexOf(relationshipId);
            if (idx2 !== -1) {
                this._relationshipIdsByNodeIdLookup[nodeId].splice(idx2, 1);
            }
        }
        if (this._relationshipIdsByNodeIdLookupIncoming[nodeId]) {
            var idx3 = this._relationshipIdsByNodeIdLookupIncoming[nodeId].indexOf(relationshipId);
            if (idx3 !== -1) {
                this._relationshipIdsByNodeIdLookupIncoming[nodeId].splice(idx3, 1);
            }
        }
    }

    /**
     * Removes a relationship ID from type lookup
     * @private
     * @param {string} type - Relationship type
     * @param {number} relationshipId - Relationship ID
     */
    _removeRelationshipIdFromTypeLookup(type, relationshipId) {
        var recodedType = this._recode(type);
        if (this._typeRelationshipIdLookup[recodedType]) {
            var idx = this._typeRelationshipIdLookup[recodedType].indexOf(relationshipId);
            if (idx !== -1) {
                this._typeRelationshipIdLookup[recodedType].splice(idx, 1);
            }
        }
    }

    /**
     * Removes a relationship
     * @private
     * @param {number} relationshipId - Relationship ID
     */
    _removeRelationship(relationshipId) {
        if (this._relationships[relationshipId]) {
            this._relationships[relationshipId] = null;
            // Persist if storage adapter available
            if (this._storageAdapter && this._storageAdapter.removeRelationship) {
                this._storageAdapter.removeRelationship(relationshipId);
            }
        }
    }

    /**
     * Gets type name
     * @returns {string} Type name
     */
    type() {
        return this.constructor.name;
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Database;
}