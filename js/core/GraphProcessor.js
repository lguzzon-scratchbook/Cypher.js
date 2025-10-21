const QueryExecutor = require("./QueryExecutor");
const ResultFormatter = require("./ResultFormatter");

/**
 * @class GraphProcessor
 * @description Orchestrates query execution across adapters.
 * Coordinates between the query engine and storage backends.
 */

class GraphProcessor {
	/**
	 * @param {DataAdapter} adapter - Storage backend
	 */
	constructor(adapter) {
		this.adapter = adapter;
		this.executor = new QueryExecutor(adapter);
	}

	/**
	 * Execute a Cypher query.
	 * @param {string} query - Cypher query string
	 * @returns {Promise<Object>} Formatted results
	 * @throws {Error} If query execution fails
	 * @example
	 * const results = await processor.execute("MATCH (n) RETURN n LIMIT 10");
	 * console.log(results.output); // Query results
	 * console.log(results.graph);  // Graph visualization data
	 */
	async execute(query) {
		try {
			const rawResults = await this.executor.execute(query);
			return ResultFormatter.format(rawResults);
		} catch (error) {
			throw new Error(`Query execution failed: ${error.message}`);
		}
	}

	/**
	 * Add nodes to the graph.
	 * @param {Object[]} nodes - Array of {labels, properties}
	 * @returns {Promise<void>}
	 */
	async addNodes(nodes) {
		for (const node of nodes) {
			await this.adapter.createNode(node);
		}
	}

	/**
	 * Add relationships to the graph.
	 * @param {Object[]} relationships - Array of {type, fromNodeId, toNodeId, properties}
	 * @returns {Promise<void>}
	 */
	async addRelationships(relationships) {
		for (const rel of relationships) {
			await this.adapter.createRelationship(rel);
		}
	}

	/**
	 * Add a complete graph.
	 * @param {Object[]} nodes - Array of {id, labels, properties}
	 * @param {Object[]} relationships - Array of {id, type, from, to, properties}
	 * @returns {Promise<void>}
	 */
	async addGraph(nodes, relationships) {
		// Map from adapter format to creation format
		for (const node of nodes) {
			await this.adapter.createNode({
				labels: node.labels || [],
				properties: node.properties || {},
			});
		}

		for (const rel of relationships) {
			await this.adapter.createRelationship({
				type: rel.type,
				fromNodeId: rel.from !== undefined ? rel.from : rel.fromNodeId,
				toNodeId: rel.to !== undefined ? rel.to : rel.toNodeId,
				properties: rel.properties || {},
			});
		}
	}

	/**
	 * Get a node by ID.
	 * @param {number} nodeId
	 * @returns {Promise<Object|null>}
	 */
	async getNode(nodeId) {
		return this.adapter.getNodeById(nodeId);
	}

	/**
	 * Get a relationship by ID.
	 * @param {number} relationshipId
	 * @returns {Promise<Object|null>}
	 */
	async getRelationship(relationshipId) {
		return this.adapter.getRelationshipById(relationshipId);
	}

	/**
	 * Get all nodes with a label.
	 * @param {string} label
	 * @returns {Promise<Object[]>}
	 */
	async getNodesByLabel(label) {
		return this.adapter.getNodesByLabel(label);
	}

	/**
	 * Get all nodes with a property value.
	 * @param {string} key
	 * @param {any} value
	 * @returns {Promise<Object[]>}
	 */
	async getNodesByProperty(key, value) {
		return this.adapter.getNodesByProperty(key, value);
	}

	/**
	 * Get all relationships of a type.
	 * @param {string} type
	 * @returns {Promise<Object[]>}
	 */
	async getRelationshipsByType(type) {
		return this.adapter.getRelationshipsByType(type);
	}

	/**
	 * Get all nodes.
	 * @returns {Promise<Object[]>}
	 */
	async getAllNodes() {
		return this.adapter.getAllNodes();
	}

	/**
	 * Get all relationships.
	 * @returns {Promise<Object[]>}
	 */
	async getAllRelationships() {
		return this.adapter.getAllRelationships();
	}

	/**
	 * Clear all data.
	 * @returns {Promise<void>}
	 */
	async clear() {
		await this.adapter.clear();
		await this.executor.reset();
	}

	/**
	 * Get query statistics.
	 * @param {string} query - Cypher query
	 * @returns {Promise<Object>} Query execution stats
	 */
	async getQueryStats(query) {
		try {
			const results = await this.execute(query);
			return {
				outputRecords: results.output.length,
				nodesInGraph: results.graph.nodes.length,
				relationshipsInGraph: results.graph.links.length,
				nodesAdded: results.stats.nodesAdded,
				relationshipsAdded: results.stats.relationshipsAdded,
			};
		} catch (error) {
			throw new Error(`Failed to get query stats: ${error.message}`);
		}
	}
}

module.exports = GraphProcessor;
