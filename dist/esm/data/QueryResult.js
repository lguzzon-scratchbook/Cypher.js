/**
 * QueryResult represents the result of a Cypher query execution
 */
export class QueryResult {
	/**
	 * @param {Object[]} columns - Column names
	 * @param {Object[]} data - Result rows
	 * @param {Object} [stats={}] - Query statistics
	 */
	constructor(columns = [], data = [], stats = {}) {
		this.columns = columns;
		this.data = data;
		this.stats = {
			nodesCreated: 0,
			nodesDeleted: 0,
			relationshipsCreated: 0,
			relationshipsDeleted: 0,
			propertiesSet: 0,
			...stats,
		};
	}

	/**
	 * Check if result is empty
	 * @returns {boolean}
	 */
	isEmpty() {
		return this.data.length === 0;
	}

	/**
	 * Get the first row
	 * @returns {Object|undefined}
	 */
	first() {
		return this.data[0];
	}

	/**
	 * Convert to plain object
	 * @returns {Object}
	 */
	toObject() {
		return {
			columns: [...this.columns],
			data: [...this.data],
			stats: { ...this.stats },
		};
	}

	/**
	 * Create QueryResult from plain object
	 * @param {Object} obj
	 * @returns {QueryResult}
	 */
	static fromObject(obj) {
		return new QueryResult(obj.columns, obj.data, obj.stats);
	}
}

export default QueryResult;
