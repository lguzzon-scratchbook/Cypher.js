import { QueryResult } from '../data/QueryResult.js';
import { QueryParser } from './QueryParser.js';

/**
 * QueryExecutor - Orchestrates query execution
 */
export class QueryExecutor {
	/**
	 * @param {GraphEngine} engine
	 */
	constructor(engine) {
		this.engine = engine;
		this.parser = new QueryParser();
	}

	/**
	 * Execute a Cypher query
	 * @param {string} query - Cypher query string
	 * @param {Object} [params={}] - Query parameters
	 * @param {Function} [callback] - Callback for async execution
	 * @returns {QueryResult}
	 */
	execute(query, params = {}, callback = null) {
		const result = this.executeSync(query, params);

		if (callback) {
			callback(result);
		}

		return result;
	}

	/**
	 * Execute query synchronously
	 * @param {string} query
	 * @param {Object} params
	 * @returns {QueryResult}
	 */
	executeSync(query, params = {}) {
		// Parse the query
		const ast = this.parser.parse(query);

		// Build execution plan
		const plan = this.buildExecutionPlan(ast, params);

		// Execute the plan
		return this.executePlan(plan);
	}

	/**
	 * Execute query asynchronously
	 * @param {string} query
	 * @param {Object} params
	 * @returns {Promise<QueryResult>}
	 */
	async executeAsync(query, params = {}) {
		return new Promise((resolve) => {
			this.execute(query, params, (result) => {
				resolve(result);
			});
		});
	}

	/**
	 * Build execution plan from AST
	 * @param {Object} ast
	 * @param {Object} params
	 * @returns {Object}
	 */
	buildExecutionPlan(ast, params) {
		const plan = {
			clauses: [],
			params,
		};

		for (const clause of ast.clauses) {
			const handler = this.getClauseHandler(clause.type);
			if (handler) {
				plan.clauses.push({
					type: clause.type,
					handler,
					body: clause.body,
				});
			}
		}

		return plan;
	}

	/**
	 * Get clause handler
	 * @param {string} type
	 * @returns {Function|null}
	 */
	getClauseHandler(type) {
		const handlers = {
			MATCH: this.handleMatch.bind(this),
			OPTIONAL: this.handleMatch.bind(this),
			CREATE: this.handleCreate.bind(this),
			MERGE: this.handleMerge.bind(this),
			RETURN: this.handleReturn.bind(this),
			WHERE: this.handleWhere.bind(this),
			DELETE: this.handleDelete.bind(this),
			SET: this.handleSet.bind(this),
			REMOVE: this.handleRemove.bind(this),
			WITH: this.handleWith.bind(this),
			UNWIND: this.handleUnwind.bind(this),
			ORDER: this.handleOrderBy.bind(this),
			SKIP: this.handleSkip.bind(this),
			LIMIT: this.handleLimit.bind(this),
		};

		return handlers[type] || null;
	}

	/**
	 * Execute the plan
	 * @param {Object} plan
	 * @returns {QueryResult}
	 */
	executePlan(plan) {
		let context = {
			params: plan.params,
			results: [],
			graph: this.engine.getGraph(),
		};

		for (const clause of plan.clauses) {
			context = clause.handler(context, clause.body);

			// Stop if error or early return
			if (context.error || context.return) {
				break;
			}
		}

		// Build final result
		const columns = context.columns || [];
		const data = context.results || [];
		const stats = context.stats || {};

		return new QueryResult(columns, data, stats);
	}

	// Clause handlers

	/**
	 * Handle MATCH clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleMatch(context, _body) {
		const nodes = this.engine.getNodes();
		const results = nodes.map((node) => ({ n: node }));

		return {
			...context,
			results,
			columns: ['n'],
		};
	}

	/**
	 * Handle CREATE clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleCreate(context, _body) {
		const node = this.engine.createNode([], {});
		const results = [{ n: node }];

		return {
			...context,
			results,
			columns: ['n'],
			stats: {
				...(context.stats || {}),
				nodesCreated: (context.stats?.nodesCreated || 0) + 1,
			},
		};
	}

	/**
	 * Handle MERGE clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleMerge(context, body) {
		return this.handleCreate(context, body);
	}

	/**
	 * Handle RETURN clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleReturn(context, _body) {
		return {
			...context,
			return: true,
		};
	}

	/**
	 * Handle WHERE clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleWhere(context, _body) {
		return context;
	}

	/**
	 * Handle DELETE clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleDelete(context, _body) {
		return context;
	}

	/**
	 * Handle SET clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleSet(context, _body) {
		return context;
	}

	/**
	 * Handle REMOVE clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleRemove(context, _body) {
		return context;
	}

	/**
	 * Handle WITH clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleWith(context, _body) {
		return context;
	}

	/**
	 * Handle UNWIND clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleUnwind(context, _body) {
		return context;
	}

	/**
	 * Handle ORDER BY clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleOrderBy(context, _body) {
		return context;
	}

	/**
	 * Handle SKIP clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleSkip(context, _body) {
		return context;
	}

	/**
	 * Handle LIMIT clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleLimit(context, _body) {
		return context;
	}
}

export default QueryExecutor;
