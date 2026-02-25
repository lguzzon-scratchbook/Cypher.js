


class PatternParser {
	constructor(tokens) {
		this.tokens = tokens;
		this.pos = 0;
	}

	peek() {
		return this.tokens[this.pos];
	}

	consume() {
		return this.tokens[this.pos++];
	}

	expect(token) {
		const current = this.consume();
		if (current !== token) {
			throw new Error(`Expected '${token}' but got '${current}'`);
		}
	}

	parsePatterns() {
		const patterns = [];
		patterns.push(this.parsePattern());
		while (this.peek() === ',') {
			this.consume();
			patterns.push(this.parsePattern());
		}
		return patterns;
	}

	parsePattern() {
		const pathVar = this.parsePathVariable();
		const pattern = {
			pathVariable: pathVar,
			nodes: [],
			relationships: [],
		};

		const nodePattern = this.parseNodePattern();
		if (nodePattern) {
			pattern.nodes.push(nodePattern);

			while (true) {
				const relPattern = this.parseRelationshipPattern();
				if (!relPattern) break;

				const nextNodePattern = this.parseNodePattern();
				if (!nextNodePattern) {
					throw new Error('Expected node pattern after relationship');
				}

				pattern.relationships.push(relPattern);
				pattern.nodes.push(nextNodePattern);
			}
		}

		return pattern;
	}

	parsePathVariable() {
		if (!this.peek()) return null;

		const firstToken = this.peek();
		if (firstToken === '(') return null;

		this.consume();
		if (this.peek() === '=') {
			this.consume();
			return firstToken;
		}
		this.pos--;
		return null;
	}

	parseNodePattern() {
		if (this.peek() !== '(') return null;

		this.consume();
		const node = {
			variable: null,
			labels: [],
			properties: {},
		};

		if (this.peek() && this.peek() !== ')' && this.peek() !== ':') {
			node.variable = this.consume();
		}

		while (this.peek() === ':') {
			this.consume();
			if (
				this.peek() &&
				this.peek() !== ':' &&
				this.peek() !== ')' &&
				this.peek() !== '{'
			) {
				node.labels.push(this.consume());
			}
		}

		if (this.peek() === '{') {
			node.properties = this.parseProperties();
		}

		this.expect(')');
		return node;
	}

	parseRelationshipPattern() {
		const leftDir = this.peek() === '<';
		if (leftDir) this.consume();

		if (this.peek() !== '-' && this.peek() !== '[') return null;

		if (this.peek() === '-') {
			this.consume();
			if (this.peek() === '[') {
				const rel = this.parseRelationshipDetail();
				const rightDir = this.peek() === '>';
				if (rightDir) this.consume();
				rel.direction = rightDir ? 'right' : leftDir ? 'left' : 'both';
				return rel;
			}

			if (this.peek() === '-' || this.peek() === '>') {
				this.consume();
			}

			const rightDir = this.peek() === '>';
			if (rightDir) this.consume();

			return {
				variable: null,
				type: null,
				properties: {},
				direction: rightDir ? 'right' : leftDir ? 'left' : 'both',
				variableLength: false,
				minHops: null,
				maxHops: null,
			};
		}

		return null;
	}

	parseRelationshipDetail() {
		this.expect('[');
		const rel = {
			variable: null,
			type: null,
			properties: {},
			variableLength: false,
			minHops: null,
			maxHops: null,
		};

		if (
			this.peek() &&
			this.peek() !== ':' &&
			this.peek() !== ']' &&
			this.peek() !== '{' &&
			this.peek() !== '*'
		) {
			rel.variable = this.consume();
		}

		if (this.peek() === ':') {
			this.consume();
			if (
				this.peek() &&
				this.peek() !== ']' &&
				this.peek() !== '{' &&
				this.peek() !== '*'
			) {
				rel.type = this.consume();
			}
		}

		if (this.peek() === '*') {
			this.consume();
			rel.variableLength = true;
			if (this.peek() && /^\d+$/.test(this.peek())) {
				rel.minHops = parseInt(this.consume(), 10);
			}
			if (this.peek() === '.' && this.tokens[this.pos + 1] === '.') {
				this.pos += 2;
				if (this.peek() && /^\d+$/.test(this.peek())) {
					rel.maxHops = parseInt(this.consume(), 10);
				}
			}
		}

		if (this.peek() === '{') {
			rel.properties = this.parseProperties();
		}

		this.expect(']');
		if (this.peek() === '-') this.consume();
		return rel;
	}

	parseProperties() {
		this.expect('{');
		const props = {};

		while (this.peek() && this.peek() !== '}') {
			const key = this.consume();
			this.expect(':');
			let value = this.consume();

			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			} else if (/^-?\d+(\.\d+)?$/.test(value)) {
				value = parseFloat(value);
			} else if (value === 'true') {
				value = true;
			} else if (value === 'false') {
				value = false;
			} else if (value === 'null') {
				value = null;
			}

			props[key] = value;

			if (this.peek() === ',') this.consume();
		}

		this.expect('}');
		return props;
	}
}

class PatternMatcher {
	constructor(engine) {
		this.engine = engine;
	}

	matchPattern(pattern, context = {}) {
		const results = [];
		const graph = this.engine.getGraph();

		if (pattern.nodes.length === 0) {
			return results;
		}

		const firstNode = pattern.nodes[0];
		const candidateNodes = this.matchSingleNode(firstNode, graph);

		if (pattern.relationships.length === 0) {
			for (const node of candidateNodes) {
				results.push({
					[firstNode.variable || 'n']: node,
				});
			}
			return results;
		}

		for (const startNode of candidateNodes) {
			this.matchPath(
				pattern,
				0,
				{ [pattern.nodes[0].variable || `_n0`]: startNode },
				[],
				results,
				context
			);
		}

		return results;
	}

	matchSingleNode(nodePattern, graph) {
		let nodes = graph.getNodes();

		if (nodePattern.labels && nodePattern.labels.length > 0) {
			nodes = nodes.filter((n) =>
				nodePattern.labels.every((label) => n.hasLabel(label))
			);
		}

		if (nodePattern.properties) {
			nodes = nodes.filter((n) => {
				for (const [key, value] of Object.entries(nodePattern.properties)) {
					if (n.get(key) !== value) {
						return false;
					}
				}
				return true;
			});
		}

		return nodes;
	}

	matchPath(pattern, nodeIndex, bindings, pathRels, results, context) {
		const graph = this.engine.getGraph();
		const nodePattern = pattern.nodes[nodeIndex];
		const varName = nodePattern.variable || `_n${nodeIndex}`;

		if (bindings[varName]) {
			if (nodeIndex === pattern.nodes.length - 1) {
				results.push({ ...bindings });
				return;
			}

			if (pattern.relationships.length > nodeIndex) {
				this.traverseRelationship(
					pattern,
					nodeIndex,
					bindings,
					pathRels,
					results,
					context
				);
			} else {
				results.push({ ...bindings });
			}
			return;
		}

		const matchedNodes = this.matchNodesWithBindings(
			nodePattern,
			bindings,
			graph
		);

		for (const node of matchedNodes) {
			const newBindings = { ...bindings, [varName]: node };

			if (nodeIndex === pattern.nodes.length - 1) {
				results.push(newBindings);
				continue;
			}

			if (pattern.relationships.length > nodeIndex) {
				this.traverseRelationship(
					pattern,
					nodeIndex,
					newBindings,
					pathRels,
					results,
					context
				);
			} else {
				results.push(newBindings);
			}
		}
	}

	matchNodesWithBindings(nodePattern, _bindings, graph) {
		let nodes = graph.getNodes();

		if (nodePattern.labels && nodePattern.labels.length > 0) {
			nodes = nodes.filter((n) =>
				nodePattern.labels.every((label) => n.hasLabel(label))
			);
		}

		if (nodePattern.properties) {
			nodes = nodes.filter((n) => {
				for (const [key, value] of Object.entries(nodePattern.properties)) {
					if (n.get(key) !== value) {
						return false;
					}
				}
				return true;
			});
		}

		return nodes;
	}

	traverseRelationship(
		pattern,
		nodeIndex,
		bindings,
		pathRels,
		results,
		context
	) {
		const graph = this.engine.getGraph();
		const relPattern = pattern.relationships[nodeIndex];
		const fromNode =
			bindings[pattern.nodes[nodeIndex].variable || `_n${nodeIndex}`];

		if (!fromNode) return;

		let rels = graph.getRelationshipsFrom(fromNode.id);

		if (relPattern.type) {
			rels = rels.filter((r) => r.type === relPattern.type);
		}

		if (relPattern.properties) {
			rels = rels.filter((r) => {
				for (const [key, value] of Object.entries(relPattern.properties)) {
					if (r.get(key) !== value) {
						return false;
					}
				}
				return true;
			});
		}

		if (relPattern.direction === 'left') {
			rels = graph.getRelationshipsTo(fromNode.id);
		} else if (relPattern.direction === 'both') {
			rels = [
				...graph.getRelationshipsFrom(fromNode.id),
				...graph.getRelationshipsTo(fromNode.id),
			];
		}

		if (relPattern.variableLength) {
			this.matchVariableLengthPath(
				pattern,
				nodeIndex,
				bindings,
				relPattern,
				results,
				context
			);
			return;
		}

		for (const rel of rels) {
			const toNodeId =
				rel.endNodeId === fromNode.id ? rel.startNodeId : rel.endNodeId;
			const toNode = graph.getNode(toNodeId);

			if (!toNode) continue;

			const nextNodePattern = pattern.nodes[nodeIndex + 1];
			if (!this.nodeMatchesPattern(toNode, nextNodePattern)) continue;

			const relVar = relPattern.variable;
			const nextNodeVar = nextNodePattern.variable || `_n${nodeIndex + 1}`;
			const newBindings = {
				...bindings,
				[nextNodeVar]: toNode,
			};
			if (relVar) {
				newBindings[relVar] = rel;
			}

			if (nodeIndex + 1 === pattern.nodes.length - 1) {
				results.push(newBindings);
			} else if (pattern.relationships.length > nodeIndex + 1) {
				this.traverseRelationship(
					pattern,
					nodeIndex + 1,
					newBindings,
					[...pathRels, rel],
					results,
					context
				);
			} else {
				results.push(newBindings);
			}
		}
	}

	matchVariableLengthPath(
		pattern,
		nodeIndex,
		bindings,
		relPattern,
		results,
		context
	) {
		const graph = this.engine.getGraph();
		const fromNode =
			bindings[pattern.nodes[nodeIndex].variable || `_n${nodeIndex}`];
		const targetNodePattern = pattern.nodes[nodeIndex + 1];
		const minHops = relPattern.minHops ?? 1;
		const maxHops = relPattern.maxHops ?? Infinity;

		this.expandVariablePath(
			graph,
			fromNode,
			relPattern,
			minHops,
			maxHops,
			new Set([fromNode.id]),
			bindings,
			pattern,
			nodeIndex,
			targetNodePattern,
			results,
			context
		);
	}

	expandVariablePath(
		graph,
		currentNode,
		relPattern,
		remainingHops,
		maxHops,
		visited,
		bindings,
		pattern,
		nodeIndex,
		targetPattern,
		results,
		context
	) {
		if (remainingHops < 0) return;

		const rels = graph
			.getRelationshipsFrom(currentNode.id)
			.filter((r) => !relPattern.type || r.type === relPattern.type);

		for (const rel of rels) {
			const nextNodeId = rel.endNodeId;
			if (visited.has(nextNodeId)) continue;

			const nextNode = graph.getNode(nextNodeId);
			if (!nextNode) continue;

			const newVisited = new Set(visited);
			newVisited.add(nextNodeId);

			if (this.nodeMatchesPattern(nextNode, targetPattern)) {
				const nextNodeVar = targetPattern.variable || `_n${nodeIndex + 1}`;
				const relVar = relPattern.variable;
				const newBindings = {
					...bindings,
					[nextNodeVar]: nextNode,
				};
				if (relVar) {
					newBindings[relVar] = rel;
				}
				results.push(newBindings);
			}

			if (remainingHops > 1) {
				this.expandVariablePath(
					graph,
					nextNode,
					relPattern,
					remainingHops - 1,
					maxHops,
					newVisited,
					bindings,
					pattern,
					nodeIndex,
					targetPattern,
					results,
					context
				);
			}
		}
	}

	nodeMatchesPattern(node, pattern) {
		if (pattern.labels && pattern.labels.length > 0) {
			if (!pattern.labels.every((label) => node.hasLabel(label))) {
				return false;
			}
		}

		if (pattern.properties) {
			for (const [key, value] of Object.entries(pattern.properties)) {
				if (node.get(key) !== value) {
					return false;
				}
			}
		}

		return true;
	}
}

class PatternCreator {
	constructor(engine) {
		this.engine = engine;
		this.nodesCreated = 0;
		this.relationshipsCreated = 0;
	}

	createPattern(pattern, context = {}) {
		const bindings = {};
		const stats = { nodesCreated: 0, relationshipsCreated: 0 };

		for (let i = 0; i < pattern.nodes.length; i++) {
			const nodePattern = pattern.nodes[i];
			const varName = nodePattern.variable || `_n${i}`;

			if (context[varName]) {
				bindings[varName] = context[varName];
			} else if (bindings[varName]) {
			} else {
				const node = this.engine.createNode(
					nodePattern.labels || [],
					nodePattern.properties || {}
				);
				bindings[varName] = node;
				stats.nodesCreated++;
			}
		}

		for (let i = 0; i < pattern.relationships.length; i++) {
			const relPattern = pattern.relationships[i];
			const relVar = relPattern.variable;

			const startNodePattern = pattern.nodes[i];
			const endNodePattern = pattern.nodes[i + 1];

			const startVar = startNodePattern.variable || `_n${i}`;
			const endVar = endNodePattern.variable || `_n${i + 1}`;

			const startNode = bindings[startVar];
			const endNode = bindings[endVar];

			if (!startNode || !endNode) {
				throw new Error('Cannot create relationship without bound nodes');
			}

			const relType = relPattern.type || 'RELATED';
			let rel;

			if (relPattern.direction === 'left') {
				rel = this.engine.createRelationship(
					endNode.id,
					startNode.id,
					relType,
					relPattern.properties || {}
				);
			} else {
				rel = this.engine.createRelationship(
					startNode.id,
					endNode.id,
					relType,
					relPattern.properties || {}
				);
			}

			stats.relationshipsCreated++;

			if (relVar) {
				bindings[relVar] = rel;
			}
		}

		return { bindings, stats };
	}

	resetStats() {
		this.nodesCreated = 0;
		this.relationshipsCreated = 0;
	}
}

class QueryExecutor {
	constructor(engine) {
		this.engine = engine;
		this.parser = new QueryParser();
		this.matcher = new PatternMatcher(engine);
		this.creator = new PatternCreator(engine);
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
	handleMatch(context, body) {
		const patternParser = new PatternParser(body);
		const patterns = patternParser.parsePatterns();

		let results = [];
		const columns = new Set();

		for (const pattern of patterns) {
			const patternResults = this.matcher.matchPattern(pattern, context);

			if (results.length === 0) {
				results = patternResults;
			} else {
				const combined = [];
				for (const r1 of results) {
					for (const r2 of patternResults) {
						combined.push({ ...r1, ...r2 });
					}
				}
				results = combined;
			}

			for (const node of pattern.nodes) {
				if (node.variable) columns.add(node.variable);
			}
			for (const rel of pattern.relationships) {
				if (rel.variable) columns.add(rel.variable);
			}
		}

		return {
			...context,
			results,
			columns: Array.from(columns),
		};
	}

	/**
	 * Handle CREATE clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleCreate(context, body) {
		const patternParser = new PatternParser(body);
		const patterns = patternParser.parsePatterns();

		const columns = new Set(context.columns || []);
		const stats = {
			...(context.stats || {}),
			nodesCreated: context.stats?.nodesCreated || 0,
			relationshipsCreated: context.stats?.relationshipsCreated || 0,
		};

		const bindings = {};
		for (const pattern of patterns) {
			const result = this.creator.createPattern(pattern, context);

			Object.assign(bindings, result.bindings);

			stats.nodesCreated += result.stats.nodesCreated;
			stats.relationshipsCreated += result.stats.relationshipsCreated;

			for (const node of pattern.nodes) {
				if (node.variable) columns.add(node.variable);
			}
			for (const rel of pattern.relationships) {
				if (rel.variable) columns.add(rel.variable);
			}
		}

		const results =
			context.results && context.results.length > 0
				? context.results.map((r) => ({ ...r, ...bindings }))
				: [bindings];

		return {
			...context,
			results,
			columns: Array.from(columns),
			stats,
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

module.exports = QueryExecutor;

module.exports.PatternParser = PatternParser;
module.exports.PatternMatcher = PatternMatcher;
module.exports.PatternCreator = PatternCreator;
module.exports.QueryExecutor = QueryExecutor;