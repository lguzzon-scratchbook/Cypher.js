import { ExpressionEvaluator } from './core/ExpressionEvaluator.js';
import { GraphEngine } from './core/GraphEngine.js';
import { QueryExecutor } from './core/QueryExecutor.js';
import { QueryParser } from './core/QueryParser.js';
import { Graph } from './data/Graph.js';
import { QueryResult } from './data/QueryResult.js';
import { Registry } from './storage/Registry.js';

/**
 * CypherNG - Modern Cypher graph database implementation
 */
export class CypherNG {
	/**
	 * @param {Object} [options={}]
	 */
	constructor(options = {}) {
		this.engine = new GraphEngine();
		this.executor = new QueryExecutor(this.engine);
		this.parser = new QueryParser();
		this.evaluator = new ExpressionEvaluator();
		this.storage = new Registry();
		this.options = {
			...options,
		};
	}

	/**
	 * Execute a Cypher query with callback
	 * @param {string} query - Cypher query string
	 * @param {Object} [params={}] - Query parameters
	 * @param {Function} [callback] - Callback function (optional)
	 * @returns {QueryResult}
	 */
	execute(query, params, callback) {
		return this.executor.execute(query, params, callback);
	}

	/**
	 * Execute a Cypher query asynchronously
	 * @param {string} query - Cypher query string
	 * @param {Object} [params={}] - Query parameters
	 * @returns {Promise<QueryResult>}
	 */
	async executeAsync(query, params = {}) {
		return this.executor.executeAsync(query, params);
	}

	/**
	 * Parse a query without executing
	 * @param {string} query
	 * @returns {Object}
	 */
	parse(query) {
		return this.parser.parse(query);
	}

	/**
	 * Set a storage adapter for persistence
	 * @param {string} name - Adapter name
	 * @param {Object} adapter - Storage adapter
	 */
	setStorage(name, adapter) {
		this.storage.register(name, adapter, true);
	}

	/**
	 * Get the storage registry
	 * @returns {Registry}
	 */
	getStorage() {
		return this.storage;
	}

	/**
	 * Get the underlying graph
	 * @returns {Graph}
	 */
	getGraph() {
		return this.engine.getGraph();
	}

	/**
	 * Clear all data
	 */
	clear() {
		this.engine.clear();
	}

	/**
	 * Export graph to JSON
	 * @returns {Object}
	 */
	toJSON() {
		return this.engine.getGraph().toObject();
	}

	/**
	 * Import graph from JSON
	 * @param {Object} data
	 */
	fromJSON(data) {
		const graph = Graph.fromObject(data);
		this.engine.setGraph(graph);
	}
}

// Export for different module systems
export default CypherNG;

/**
 * Create a new CypherNG instance (factory function)
 * @param {Object} [options={}]
 * @returns {CypherNG}
 */
export function createCypherNG(options) {
	return new CypherNG(options);
}

// Browser global
if (typeof window !== 'undefined') {
	window.CypherNG = CypherNG;
}
