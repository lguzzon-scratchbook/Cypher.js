/**
 * @abstract
 * @description Abstract base class defining the contract for all storage backend adapters.
 * All methods are async (return Promise). Implementations handle nodes, relationships,
 * labels, types, and indexes. Query parsing/planning is NOT adapter responsibility.
 */
class DataAdapter {
	/**
	 * Initialize connection to the data source.
	 * @param {Object} config - Adapter-specific configuration
	 * @throws {AdapterError} If connection fails
	 * @example await adapter.connect({ path: './data.json' })
	 * @returns {Promise<void>}
	 */
	async connect(_config) {
		throw new Error("Not implemented");
	}

	/**
	 * Gracefully disconnect from the data source.
	 * @throws {AdapterError} If disconnection fails
	 * @returns {Promise<void>}
	 */
	async disconnect() {
		throw new Error("Not implemented");
	}

	/**
	 * Get a single node by ID.
	 * @param {number} nodeId
	 * @returns {Promise<Object|null>} GraphNode or null if not found
	 */
	async getNodeById(_nodeId) {
		throw new Error("Not implemented");
	}

	/**
	 * Get a single relationship by ID.
	 * @param {number} relationshipId
	 * @returns {Promise<Object|null>} GraphRelationship or null if not found
	 */
	async getRelationshipById(_relationshipId) {
		throw new Error("Not implemented");
	}

	/**
	 * Get all nodes with a specific label.
	 * @param {string} label
	 * @returns {Promise<Object[]>} Array of GraphNodes
	 */
	async getNodesByLabel(_label) {
		throw new Error("Not implemented");
	}

	/**
	 * Get nodes filtered by property key-value pair.
	 * @param {string} key - Property key
	 * @param {any} value - Property value
	 * @returns {Promise<Object[]>} Array of GraphNodes
	 */
	async getNodesByProperty(_key, _value) {
		throw new Error("Not implemented");
	}

	/**
	 * Get all relationships of a specific type.
	 * @param {string} type - Relationship type
	 * @returns {Promise<Object[]>} Array of GraphRelationships
	 */
	async getRelationshipsByType(_type) {
		throw new Error("Not implemented");
	}

	/**
	 * Get relationships between two nodes (both directions).
	 * @param {number} fromNodeId
	 * @param {number} toNodeId
	 * @returns {Promise<Object[]>} Array of GraphRelationships
	 */
	async getRelationshipsBetween(_fromNodeId, _toNodeId) {
		throw new Error("Not implemented");
	}

	/**
	 * Get outgoing relationships from a node.
	 * @param {number} nodeId
	 * @returns {Promise<Object[]>} Array of GraphRelationships
	 */
	async getOutgoingRelationships(_nodeId) {
		throw new Error("Not implemented");
	}

	/**
	 * Get incoming relationships to a node.
	 * @param {number} nodeId
	 * @returns {Promise<Object[]>} Array of GraphRelationships
	 */
	async getIncomingRelationships(_nodeId) {
		throw new Error("Not implemented");
	}

	/**
	 * Get all nodes in the graph.
	 * @returns {Promise<Object[]>} Array of all GraphNodes
	 */
	async getAllNodes() {
		throw new Error("Not implemented");
	}

	/**
	 * Get all relationships in the graph.
	 * @returns {Promise<Object[]>} Array of all GraphRelationships
	 */
	async getAllRelationships() {
		throw new Error("Not implemented");
	}

	/**
	 * Create a new node and assign it an ID.
	 * @param {Object} graphNode - Node without ID: {labels, properties}
	 * @returns {Promise<Object>} GraphNode with assigned id
	 * @throws {AdapterError} If creation fails
	 */
	async createNode(_graphNode) {
		throw new Error("Not implemented");
	}

	/**
	 * Create a new relationship and assign it an ID.
	 * @param {Object} graphRel - Rel without ID: {type, fromNodeId, toNodeId, properties}
	 * @returns {Promise<Object>} GraphRelationship with assigned id
	 * @throws {AdapterError} If creation fails
	 */
	async createRelationship(_graphRel) {
		throw new Error("Not implemented");
	}

	/**
	 * Update node properties (merge/set semantics).
	 * @param {number} nodeId
	 * @param {Object} properties - Properties to merge
	 * @returns {Promise<void>}
	 * @throws {AdapterError} If node not found
	 */
	async updateNodeProperties(_nodeId, _properties) {
		throw new Error("Not implemented");
	}

	/**
	 * Update relationship properties (merge/set semantics).
	 * @param {number} relationshipId
	 * @param {Object} properties - Properties to merge
	 * @returns {Promise<void>}
	 * @throws {AdapterError} If relationship not found
	 */
	async updateRelationshipProperties(_relationshipId, _properties) {
		throw new Error("Not implemented");
	}

	/**
	 * Add a label to a node.
	 * @param {number} nodeId
	 * @param {string} label
	 * @returns {Promise<void>}
	 * @throws {AdapterError} If node not found
	 */
	async addNodeLabel(_nodeId, _label) {
		throw new Error("Not implemented");
	}

	/**
	 * Delete a node and all connected relationships.
	 * @param {number} nodeId
	 * @returns {Promise<void>}
	 * @throws {AdapterError} If node not found
	 */
	async deleteNode(_nodeId) {
		throw new Error("Not implemented");
	}

	/**
	 * Delete a relationship.
	 * @param {number} relationshipId
	 * @returns {Promise<void>}
	 * @throws {AdapterError} If relationship not found
	 */
	async deleteRelationship(_relationshipId) {
		throw new Error("Not implemented");
	}

	/**
	 * Allocate and return the next available node ID.
	 * @returns {Promise<number>}
	 */
	async getNextNodeId() {
		throw new Error("Not implemented");
	}

	/**
	 * Allocate and return the next available relationship ID.
	 * @returns {Promise<number>}
	 */
	async getNextRelationshipId() {
		throw new Error("Not implemented");
	}

	/**
	 * Clear all graph data (wipe the database).
	 * @returns {Promise<void>}
	 */
	async clear() {
		throw new Error("Not implemented");
	}

	/**
	 * Subscribe to changes (real-time updates). Optional for reactive backends.
	 * @param {Function} callback - Called with (event, data) when changes occur
	 * @returns {Function} Unsubscribe function
	 * @example
	 * const unsub = adapter.subscribe((event, data) => {
	 *   console.log(event, data);
	 * });
	 * unsub();
	 */
	subscribe(_callback) {
		return () => {};
	}
}

module.exports = DataAdapter;
