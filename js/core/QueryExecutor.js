/**
 * @class QueryExecutor
 * @description Executes Cypher queries using the original engine.
 * Bridges between CypherNG/adapters and the original Cypher.js implementation.
 */

class QueryExecutor {
	/**
	 * @param {DataAdapter} adapter - Storage backend
	 */
	constructor(adapter) {
		this.adapter = adapter;
		this.engine = null;
	}

	/**
	 * Initialize the executor with graph data.
	 * @returns {Promise<void>}
	 */
	async initialize() {
		// Lazy load original Cypher engine
		if (!this.engine) {
			try {
				const CypherEngine = require("../Cypher");
				this.engine = new CypherEngine();
			} catch (error) {
				throw new Error(`Failed to initialize Cypher engine: ${error.message}`);
			}
		}
	}

	/**
	 * Load graph data from adapter into the engine.
	 * @returns {Promise<void>}
	 */
	async loadGraphFromAdapter() {
		await this.initialize();
		await this.reset();

		const nodes = await this.adapter.getAllNodes();
		const relationships = await this.adapter.getAllRelationships();

		const nodeData = nodes.map((n) => ({
			id: n.id,
			labels: Array.isArray(n.labels) ? n.labels : Array.from(n.labels),
			properties:
				n.properties instanceof Map
					? Object.fromEntries(n.properties)
					: n.properties,
		}));

		const relData = relationships.map((r) => ({
			id: r.id,
			type: r.type,
			from: r.fromNodeId,
			to: r.toNodeId,
			properties:
				r.properties instanceof Map
					? Object.fromEntries(r.properties)
					: r.properties,
		}));

		if (this.engine.addGraph) {
			this.engine.addGraph(nodeData, relData);
		}
	}

	/**
	 * Execute a Cypher query.
	 * @param {string} query - Cypher query string
	 * @returns {Promise<Object>} Query results
	 */
	async execute(query) {
		await this.initialize();
		await this.loadGraphFromAdapter();

		return new Promise((resolve, reject) => {
			this.engine.execute(
				query,
				(results) => {
					resolve(results);
				},
				(error) => {
					reject(error);
				},
			);
		});
	}

	/**
	 * Reset the internal engine state.
	 * @returns {Promise<void>}
	 */
	async reset() {
		if (this.engine?.resetDataBase) {
			this.engine.resetDataBase();
		}
	}

	/**
	 * Sync changes from adapter back to adapter after query execution.
	 * (Placeholder for mutation handling in future versions)
	 * @returns {Promise<void>}
	 */
	async syncChanges() {
		// Future: Extract graph changes from engine and persist to adapter
	}
}

module.exports = QueryExecutor;
