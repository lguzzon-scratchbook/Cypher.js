const GraphProcessor = require("./core/GraphProcessor");

/**
 * @class CypherNG
 * @description Drop-in replacement for Cypher.js with pluggable data layer.
 * Supports multiple storage backends via DataAdapter pattern.
 */
class CypherNG {
	/**
	 * Create a new CypherNG instance.
	 * @param {DataAdapter} adapter - Storage backend (InMemory, Filesystem, Redis, etc.)
	 * @param {Object} options - Optional configuration
	 * @example
	 * const adapter = new InMemoryAdapter();
	 * const cypher = new CypherNG(adapter);
	 * cypher.execute("CREATE (n:Person {name: 'Alice'}) RETURN n", ...);
	 */
	constructor(adapter, options = {}) {
		this.adapter = adapter;
		this.options = options;
		this.connected = false;
		this.processor = new GraphProcessor(adapter);
	}

	/**
	 * Connect to the adapter's data source.
	 * @param {Object} config - Adapter-specific config
	 * @returns {Promise<void>}
	 * @example await cypher.connect({ host: 'localhost', port: 6379 })
	 */
	async connect(config = {}) {
		await this.adapter.connect(config);
		this.connected = true;
	}

	/**
	 * Disconnect from the adapter's data source.
	 * @returns {Promise<void>}
	 */
	async disconnect() {
		await this.adapter.disconnect();
		this.connected = false;
	}

	/**
	 * Execute a Cypher query.
	 * @param {string} query - Cypher query string
	 * @param {Function} successCallback - Called with results on success
	 * @param {Function} errorCallback - Called with error on failure
	 * @example
	 * cypher.execute(
	 *   "MATCH (n) RETURN n LIMIT 10",
	 *   (results) => console.log(results),
	 *   (error) => console.error(error)
	 * );
	 */
	async execute(query, successCallback, errorCallback) {
		if (!this.connected) {
			const err = new Error("Adapter not connected. Call connect() first.");
			if (errorCallback) errorCallback(err);
			return;
		}

		try {
			const results = await this.processor.execute(query);
			if (successCallback) successCallback(results);
		} catch (error) {
			if (errorCallback) errorCallback(error);
		}
	}

	/**
	 * Add pre-built graph data.
	 * @param {Object[]} nodes - Array of {id, labels, properties}
	 * @param {Object[]} relationships - Array of {id, type, fromNodeId, toNodeId, properties}
	 * @returns {Promise<void>}
	 * @example
	 * await cypher.addGraph(
	 *   [{id: 1, labels: ['Person'], properties: {name: 'Alice'}}],
	 *   [{id: 1, type: 'KNOWS', fromNodeId: 1, toNodeId: 2, properties: {}}]
	 * );
	 */
	async addGraph(nodes, relationships) {
		for (const node of nodes) {
			await this.adapter.createNode(node);
		}
		for (const rel of relationships) {
			await this.adapter.createRelationship(rel);
		}
	}

	/**
	 * Reset all graph data.
	 * @returns {Promise<void>}
	 */
	async resetDatabase() {
		await this.adapter.clear();
	}

	/**
	 * Get a node by ID.
	 * @param {number} nodeId
	 * @returns {Promise<Object|null>}
	 */
	async getNode(nodeId) {
		return this.processor.getNode(nodeId);
	}

	/**
	 * Get nodes by label.
	 * @param {string} label
	 * @returns {Promise<Object[]>}
	 */
	async getNodesByLabel(label) {
		return this.processor.getNodesByLabel(label);
	}

	/**
	 * Get nodes by property.
	 * @param {string} key
	 * @param {any} value
	 * @returns {Promise<Object[]>}
	 */
	async getNodesByProperty(key, value) {
		return this.processor.getNodesByProperty(key, value);
	}

	/**
	 * Get all nodes.
	 * @returns {Promise<Object[]>}
	 */
	async getAllNodes() {
		return this.processor.getAllNodes();
	}

	/**
	 * Get all relationships.
	 * @returns {Promise<Object[]>}
	 */
	async getAllRelationships() {
		return this.processor.getAllRelationships();
	}

	/**
	 * Get the underlying adapter.
	 * @returns {DataAdapter}
	 */
	getAdapter() {
		return this.adapter;
	}

	/**
	 * Get the graph processor.
	 * @returns {GraphProcessor}
	 */
	getProcessor() {
		return this.processor;
	}
}

// Support CommonJS and ES6 exports
if (typeof module !== "undefined" && module.exports) {
	module.exports = CypherNG;
}
