import { QueryResult } from '../data/QueryResult.js';
import { QueryParser } from './QueryParser.js';

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
			const rawValue = this.consume();
			let value;

			if (
				(rawValue.startsWith('"') && rawValue.endsWith('"')) ||
				(rawValue.startsWith("'") && rawValue.endsWith("'"))
			) {
				value = rawValue.slice(1, -1);
			} else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
				value = parseFloat(rawValue);
			} else if (rawValue === 'true') {
				value = true;
			} else if (rawValue === 'false') {
				value = false;
			} else if (rawValue === 'null') {
				value = null;
			} else {
				value = { type: 'variable', variable: rawValue };
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
				const result = {
					[firstNode.variable || 'n']: node,
				};
				if (pattern.pathVariable) {
					result[pattern.pathVariable] = { nodes: [node], relationships: [] };
				}
				results.push(result);
			}
			return results;
		}

		for (const startNode of candidateNodes) {
			this.matchPath(
				pattern,
				0,
				{ [pattern.nodes[0].variable || `_n0`]: startNode },
				[startNode],
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

	pushResultWithPattern(pattern, bindings, pathNodes, pathRels, results) {
		const result = { ...bindings };
		if (pattern.pathVariable) {
			result[pattern.pathVariable] = {
				nodes: pathNodes,
				relationships: pathRels,
			};
		}
		results.push(result);
	}

	matchPath(
		pattern,
		nodeIndex,
		bindings,
		pathNodes,
		pathRels,
		results,
		context
	) {
		const graph = this.engine.getGraph();
		const nodePattern = pattern.nodes[nodeIndex];
		const varName = nodePattern.variable || `_n${nodeIndex}`;

		if (bindings[varName]) {
			if (nodeIndex === pattern.nodes.length - 1) {
				this.pushResultWithPattern(
					pattern,
					bindings,
					pathNodes,
					pathRels,
					results
				);
				return;
			}

			if (pattern.relationships.length > nodeIndex) {
				this.traverseRelationship(
					pattern,
					nodeIndex,
					bindings,
					pathNodes,
					pathRels,
					results,
					context
				);
			} else {
				this.pushResultWithPattern(
					pattern,
					bindings,
					pathNodes,
					pathRels,
					results
				);
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
				this.pushResultWithPattern(
					pattern,
					newBindings,
					[...pathNodes, node],
					pathRels,
					results
				);
				continue;
			}

			if (pattern.relationships.length > nodeIndex) {
				this.traverseRelationship(
					pattern,
					nodeIndex,
					newBindings,
					[...pathNodes, node],
					pathRels,
					results,
					context
				);
			} else {
				this.pushResultWithPattern(
					pattern,
					newBindings,
					[...pathNodes, node],
					pathRels,
					results
				);
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
		pathNodes,
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
				pathNodes,
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

			const newPathNodes = [...pathNodes, toNode];
			const newPathRels = [...pathRels, rel];

			if (nodeIndex + 1 === pattern.nodes.length - 1) {
				this.pushResultWithPattern(
					pattern,
					newBindings,
					newPathNodes,
					newPathRels,
					results
				);
			} else if (pattern.relationships.length > nodeIndex + 1) {
				this.traverseRelationship(
					pattern,
					nodeIndex + 1,
					newBindings,
					newPathNodes,
					newPathRels,
					results,
					context
				);
			} else {
				this.pushResultWithPattern(
					pattern,
					newBindings,
					newPathNodes,
					newPathRels,
					results
				);
			}
		}
	}

	matchVariableLengthPath(
		pattern,
		nodeIndex,
		bindings,
		pathNodes,
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
			pathNodes,
			[],
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
		pathNodes,
		pathRels,
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

			const newPathNodes = [...pathNodes, nextNode];
			const newPathRels = [...pathRels, rel];

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
				this.pushResultWithPattern(
					pattern,
					newBindings,
					newPathNodes,
					newPathRels,
					results
				);
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
					pathNodes,
					newPathRels,
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
		const row = context.results?.[0] || {};

		for (let i = 0; i < pattern.nodes.length; i++) {
			const nodePattern = pattern.nodes[i];
			const varName = nodePattern.variable || `_n${i}`;

			if (context[varName]) {
				bindings[varName] = context[varName];
			} else if (bindings[varName]) {
			} else {
				const evaluatedProps = this.evaluateProperties(
					nodePattern.properties || {},
					row
				);
				const node = this.engine.createNode(
					nodePattern.labels || [],
					evaluatedProps
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
			const evaluatedProps = this.evaluateProperties(
				relPattern.properties || {},
				row
			);
			let rel;

			if (relPattern.direction === 'left') {
				rel = this.engine.createRelationship(
					endNode.id,
					startNode.id,
					relType,
					evaluatedProps
				);
			} else {
				rel = this.engine.createRelationship(
					startNode.id,
					endNode.id,
					relType,
					evaluatedProps
				);
			}

			stats.relationshipsCreated++;

			if (relVar) {
				bindings[relVar] = rel;
			}
		}

		return { bindings, stats };
	}

	evaluateProperties(props, row) {
		const evaluated = {};
		for (const [key, value] of Object.entries(props)) {
			if (value && typeof value === 'object' && value.type === 'variable') {
				evaluated[key] = row[value.variable];
			} else {
				evaluated[key] = value;
			}
		}
		return evaluated;
	}

	resetStats() {
		this.nodesCreated = 0;
		this.relationshipsCreated = 0;
	}
}

class ReturnParser {
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

	parse() {
		const items = [];
		let distinct = false;

		if (this.peek() === 'DISTINCT') {
			this.consume();
			distinct = true;
		}

		while (this.peek()) {
			const expr = this.parseExpression();
			if (expr) {
				if (this.peek() === 'AS') {
					this.consume();
					const alias = this.consume();
					expr.alias = alias;
				}
				items.push(expr);
			}

			if (this.peek() === ',') {
				this.consume();
			} else {
				break;
			}
		}

		return { items, distinct };
	}

	parseExpression() {
		return this.parseOrExpression();
	}

	parseOrExpression() {
		let left = this.parseAndExpression();

		while (this.peek() === 'OR') {
			this.consume();
			const right = this.parseAndExpression();
			left = { type: 'binary', operator: 'OR', left, right };
		}

		return left;
	}

	parseAndExpression() {
		let left = this.parseNotExpression();

		while (this.peek() === 'AND') {
			this.consume();
			const right = this.parseNotExpression();
			left = { type: 'binary', operator: 'AND', left, right };
		}

		return left;
	}

	parseNotExpression() {
		if (this.peek() === 'NOT') {
			this.consume();
			const operand = this.parseNotExpression();
			return { type: 'unary', operator: 'NOT', operand };
		}
		return this.parseComparisonExpression();
	}

	parseComparisonExpression() {
		let left = this.parseAddExpression();

		const simpleOps = ['=', '<', '>'];
		const op = this.peek();

		if (op && simpleOps.includes(op)) {
			this.consume();
			let actualOp = op;

			if (this.peek() === '=' && (op === '<' || op === '>' || op === '!')) {
				actualOp = `${op}=`;
				this.consume();
			} else if (this.peek() === '>' && op === '<') {
				actualOp = '<>';
				this.consume();
			}

			const right = this.parseAddExpression();
			left = { type: 'binary', operator: actualOp, left, right };
		}

		if (this.peek() === 'CONTAINS') {
			this.consume();
			const right = this.parseAddExpression();
			left = { type: 'binary', operator: 'CONTAINS', left, right };
		}

		if (this.peek() === 'STARTS') {
			this.consume();
			if (this.peek() === 'WITH') {
				this.consume();
				const right = this.parseAddExpression();
				left = { type: 'binary', operator: 'STARTS WITH', left, right };
			}
		}

		if (this.peek() === 'ENDS') {
			this.consume();
			if (this.peek() === 'WITH') {
				this.consume();
				const right = this.parseAddExpression();
				left = { type: 'binary', operator: 'ENDS WITH', left, right };
			}
		}

		if (this.peek() === 'IN') {
			this.consume();
			const right = this.parseAddExpression();
			left = { type: 'binary', operator: 'IN', left, right };
		}

		if (this.peek() === 'IS') {
			this.consume();
			if (this.peek() === 'NOT') {
				this.consume();
				if (this.peek() === 'NULL') {
					this.consume();
					left = { type: 'unary', operator: 'IS NOT NULL', operand: left };
				}
			} else if (this.peek() === 'NULL') {
				this.consume();
				left = { type: 'unary', operator: 'IS NULL', operand: left };
			}
		}

		return left;
	}

	parseAddExpression() {
		let left = this.parseMulExpression();

		while (this.peek() === '+' || this.peek() === '-') {
			const op = this.consume();
			const right = this.parseMulExpression();
			left = { type: 'binary', operator: op, left, right };
		}

		return left;
	}

	parseMulExpression() {
		let left = this.parsePowerExpression();

		while (this.peek() === '*' || this.peek() === '/' || this.peek() === '%') {
			const op = this.consume();
			const right = this.parsePowerExpression();
			left = { type: 'binary', operator: op, left, right };
		}

		return left;
	}

	parsePowerExpression() {
		let left = this.parseUnaryExpression();

		while (this.peek() === '^') {
			this.consume();
			const right = this.parseUnaryExpression();
			left = { type: 'binary', operator: '^', left, right };
		}

		return left;
	}

	parseUnaryExpression() {
		if (this.peek() === '-') {
			const op = this.consume();
			const operand = this.parseUnaryExpression();
			return { type: 'unary', operator: op, operand };
		}
		return this.parsePrimaryExpression();
	}

	parsePrimaryExpression() {
		const token = this.peek();

		if (token === '*') {
			this.consume();
			return { type: 'star' };
		}

		if (token === '[') {
			this.consume();
			const elements = [];
			while (this.peek() && this.peek() !== ']') {
				const expr = this.parseExpression();
				if (expr) {
					elements.push(expr);
				}
				if (this.peek() === ',') {
					this.consume();
				}
			}
			if (this.peek() === ']') {
				this.consume();
			}
			return { type: 'array', elements };
		}

		if (token === '(') {
			this.consume();
			const expr = this.parseExpression();
			if (this.peek() === ')') {
				this.consume();
			}
			return expr;
		}

		if (
			(token?.startsWith('"') && token.endsWith('"')) ||
			(token?.startsWith("'") && token.endsWith("'"))
		) {
			this.consume();
			return { type: 'literal', literal: token.slice(1, -1) };
		}

		if (token === 'true' || token === 'false') {
			this.consume();
			return { type: 'literal', literal: token === 'true' };
		}

		if (token === 'null') {
			this.consume();
			return { type: 'literal', literal: null };
		}

		if (token && /^-?\d+(\.\d+)?$/.test(token)) {
			this.consume();
			return { type: 'literal', literal: parseFloat(token) };
		}

		if (token && this.isFunctionName(token)) {
			return this.parseFunctionCall();
		}

		if (token) {
			return this.parsePropertyOrVariable();
		}

		return null;
	}

	isFunctionName(token) {
		const functions = [
			'toUpper',
			'toLower',
			'trim',
			'length',
			'size',
			'abs',
			'ceil',
			'floor',
			'round',
			'sqrt',
			'rand',
			'toString',
			'toInteger',
			'toFloat',
			'type',
			'labels',
			'keys',
			'properties',
			'head',
			'last',
			'tail',
			'reverse',
			'coalesce',
			'id',
			'count',
			'sum',
			'avg',
			'min',
			'max',
			'collect',
			'range',
			'nodes',
			'relationships',
			'startNode',
			'endNode',
		];
		return functions.includes(token.toLowerCase()) || functions.includes(token);
	}

	parseFunctionCall() {
		const name = this.consume();
		const args = [];

		if (this.peek() === '(') {
			this.consume();
			while (this.peek() && this.peek() !== ')') {
				args.push(this.parseExpression());
				if (this.peek() === ',') {
					this.consume();
				} else {
					break;
				}
			}
			if (this.peek() === ')') {
				this.consume();
			}
		}

		const expr = { type: 'function', name, arguments: args };

		if (this.peek() === 'AS') {
			this.consume();
			const alias = this.consume();
			expr.alias = alias;
		}

		return expr;
	}

	parsePropertyOrVariable() {
		const name = this.consume();

		if (this.peek() === '.' || this.peek() === ':') {
			this.consume();
			const property = this.consume();
			const expr = { type: 'property', object: name, property };
			if (this.peek() === 'AS') {
				this.consume();
				const alias = this.consume();
				expr.alias = alias;
			}
			return expr;
		}

		if (this.peek() === 'AS') {
			this.consume();
			const alias = this.consume();
			return { type: 'variable', variable: name, alias };
		}

		return { type: 'variable', variable: name };
	}
}

export class QueryExecutor {
	static AGGREGATE_FUNCTIONS = new Set([
		'count',
		'sum',
		'avg',
		'min',
		'max',
		'collect',
	]);

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

		const returnModifiers = ['ORDER', 'SKIP', 'LIMIT'];

		for (let i = 0; i < plan.clauses.length; i++) {
			const clause = plan.clauses[i];
			context = clause.handler(context, clause.body);

			// Stop if error
			if (context.error) {
				break;
			}

			// Stop if early return, unless next clause is a return modifier
			if (context.return) {
				const nextClause = plan.clauses[i + 1];
				if (!nextClause || !returnModifiers.includes(nextClause.type)) {
					break;
				}
			}
		}

		// Build final result, projecting only the requested columns
		const columns = context.columns || [];
		const allResults = context.results || [];
		const stats = context.stats || {};

		// Project only the requested columns
		const data = allResults.map((row) => {
			const projectedRow = {};
			for (const col of columns) {
				projectedRow[col] = row[col];
			}
			return projectedRow;
		});

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

		let inputRows = context.results || [];
		if (inputRows.length === 0) {
			inputRows = [{}];
		}

		const results = [];
		for (const row of inputRows) {
			const bindings = {};
			const mergedContext = { ...context, results: [row] };

			for (const pattern of patterns) {
				const result = this.creator.createPattern(pattern, mergedContext);

				Object.assign(bindings, result.bindings);

				stats.nodesCreated += result.stats.nodesCreated;
				stats.relationshipsCreated += result.stats.relationshipsCreated;

				for (const node of pattern.nodes) {
					if (node.variable) columns.add(node.variable);
				}
				for (const rel of pattern.relationships) {
					if (rel.variable) columns.add(rel.variable);
				}
				if (pattern.pathVariable) columns.add(pattern.pathVariable);
			}

			results.push({ ...row, ...bindings });
		}

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
		const patternParser = new PatternParser(body);
		const patterns = patternParser.parsePatterns();

		const hasResults = context.results && context.results.length > 0;
		let results = hasResults ? context.results : [{}];
		const stats = {
			...(context.stats || {}),
			nodesCreated: context.stats?.nodesCreated || 0,
			relationshipsCreated: context.stats?.relationshipsCreated || 0,
			nodesMerged: context.stats?.nodesMerged || 0,
			relationshipsMerged: context.stats?.relationshipsMerged || 0,
		};

		for (const pattern of patterns) {
			const newResults = [];

			for (const row of results) {
				const mergedContext = { ...row, ...context };
				const matchResults = this.matcher.matchPattern(pattern, mergedContext);

				if (matchResults.length > 0) {
					for (const match of matchResults) {
						newResults.push({ ...row, ...match });
						stats.nodesMerged += pattern.nodes.length;
						stats.relationshipsMerged += pattern.relationships.length;
					}
				} else {
					const createResult = this.creator.createPattern(
						pattern,
						mergedContext
					);
					newResults.push({ ...row, ...createResult.bindings });
					stats.nodesCreated += createResult.stats.nodesCreated;
					stats.relationshipsCreated += createResult.stats.relationshipsCreated;
				}
			}

			results = newResults;
		}

		const columns = new Set(context.columns || []);
		for (const pattern of patterns) {
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
			stats,
		};
	}

	/**
	 * Handle RETURN clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleReturn(context, body) {
		const parser = new ReturnParser(body);
		const expressions = parser.parse();
		const columns = [];
		const distinct = expressions.distinct;
		const seenRows = new Set();

		const allVariables = this.getAllVariables(context);
		const results = [];

		let inputRows = context.results || [];
		const hasOnlyLiterals = this.hasOnlyLiterals(expressions.items);
		if (inputRows.length === 0 && hasOnlyLiterals) {
			inputRows = [{}];
		}

		const hasAggr = this.hasAggregates(expressions.items);

		if (hasAggr) {
			return this.handleReturnWithAggregates(
				context,
				expressions,
				inputRows,
				columns
			);
		}

		for (const row of inputRows) {
			const outputRow = { ...row };

			for (const expr of expressions.items) {
				if (expr.type === 'star') {
					for (const varName of allVariables) {
						const value = row[varName];
						outputRow[varName] = value;
						if (!columns.includes(varName)) {
							columns.push(varName);
						}
					}
				} else {
					const value = this.evaluateExpression(expr, row, context);
					const alias = expr.alias || this.getDefaultAlias(expr);
					outputRow[alias] = value;
					if (!columns.includes(alias)) {
						columns.push(alias);
					}
				}
			}

			if (distinct) {
				const key = JSON.stringify(
					Object.fromEntries(columns.map((c) => [c, outputRow[c]]))
				);
				if (seenRows.has(key)) continue;
				seenRows.add(key);
			}

			results.push(outputRow);
		}

		return {
			...context,
			results,
			columns,
			return: true,
		};
	}

	handleReturnWithAggregates(context, expressions, inputRows, columns) {
		const groups = new Map();

		const nonAggregateExprs = expressions.items.filter(
			(expr) => !this.containsAggregate(expr)
		);

		for (const row of inputRows) {
			const groupKey = this.getGroupKey(row, nonAggregateExprs, context);

			if (!groups.has(groupKey)) {
				groups.set(groupKey, []);
			}
			groups.get(groupKey).push(row);
		}

		const results = [];

		for (const [groupKey, groupRows] of groups) {
			const outputRow = {};

			for (const expr of expressions.items) {
				const alias = expr.alias || this.getDefaultAlias(expr);
				if (!columns.includes(alias)) {
					columns.push(alias);
				}

				if (this.containsAggregate(expr)) {
					const value = this.evaluateAggregateExpression(
						expr,
						groupRows,
						context
					);
					outputRow[alias] = value;
				} else {
					const value = this.evaluateNonAggregateExpression(
						expr,
						groupRows,
						context,
						groupKey
					);
					outputRow[alias] = value;
				}
			}

			results.push(outputRow);
		}

		return {
			...context,
			results,
			columns,
			return: true,
		};
	}

	getGroupKey(row, nonAggregateExprs, context) {
		if (nonAggregateExprs.length === 0) {
			return '__all__';
		}
		const keyParts = [];
		for (const expr of nonAggregateExprs) {
			const value = this.evaluateExpression(expr, row, context);
			keyParts.push(JSON.stringify(value));
		}
		return keyParts.join('|');
	}

	evaluateNonAggregateExpression(expr, groupRows, context, _groupKey) {
		if (groupRows.length === 0) return null;
		return this.evaluateExpression(expr, groupRows[0], context);
	}

	evaluateAggregateExpression(expr, rows, context) {
		if (expr.type === 'function' && this.isAggregateFunction(expr.name)) {
			return this.computeAggregate(expr.name, expr.arguments, rows, context);
		}

		if (expr.type === 'binary') {
			const left = this.evaluateAggregateExpression(expr.left, rows, context);
			const right = this.evaluateAggregateExpression(expr.right, rows, context);
			return this.evaluateBinaryOp(expr.operator, left, right);
		}

		if (expr.type === 'unary') {
			const operand = this.evaluateAggregateExpression(
				expr.operand,
				rows,
				context
			);
			return this.evaluateUnaryOp(expr.operator, operand);
		}

		if (rows.length > 0) {
			return this.evaluateExpression(expr, rows[0], context);
		}
		return null;
	}

	computeAggregate(name, args, rows, context) {
		const fn = name.toLowerCase();
		let distinct = false;
		let actualArgs = args;

		if (
			args.length > 0 &&
			args[0].type === 'function' &&
			args[0].name.toLowerCase() === 'distinct'
		) {
			distinct = true;
			actualArgs = args[0].arguments;
		}

		if (fn === 'count') {
			return this.computeCount(actualArgs, rows, context, distinct);
		}
		if (fn === 'sum') {
			return this.computeSum(actualArgs, rows, context, distinct);
		}
		if (fn === 'avg') {
			return this.computeAvg(actualArgs, rows, context, distinct);
		}
		if (fn === 'min') {
			return this.computeMin(actualArgs, rows, context);
		}
		if (fn === 'max') {
			return this.computeMax(actualArgs, rows, context);
		}
		if (fn === 'collect') {
			return this.computeCollect(actualArgs, rows, context, distinct);
		}
		return null;
	}

	computeCount(args, rows, context, distinct) {
		if (args.length === 0 || (args.length === 1 && args[0].type === 'star')) {
			return rows.length;
		}

		let values = [];
		for (const row of rows) {
			const val = this.evaluateExpression(args[0], row, context);
			if (val !== null && val !== undefined) {
				values.push(val);
			}
		}

		if (distinct) {
			values = [...new Set(values.map((v) => JSON.stringify(v)))].map((v) =>
				JSON.parse(v)
			);
		}

		return values.length;
	}

	computeSum(args, rows, context, distinct) {
		if (args.length === 0) return null;

		let values = [];
		for (const row of rows) {
			const val = this.evaluateExpression(args[0], row, context);
			if (typeof val === 'number' && !Number.isNaN(val)) {
				values.push(val);
			}
		}

		if (distinct) {
			values = [...new Set(values)];
		}

		if (values.length === 0) return null;
		return values.reduce((a, b) => a + b, 0);
	}

	computeAvg(args, rows, context, distinct) {
		if (args.length === 0) return null;

		let values = [];
		for (const row of rows) {
			const val = this.evaluateExpression(args[0], row, context);
			if (typeof val === 'number' && !Number.isNaN(val)) {
				values.push(val);
			}
		}

		if (distinct) {
			values = [...new Set(values)];
		}

		if (values.length === 0) return null;
		return values.reduce((a, b) => a + b, 0) / values.length;
	}

	computeMin(args, rows, context) {
		if (args.length === 0) return null;

		let min = null;
		for (const row of rows) {
			const val = this.evaluateExpression(args[0], row, context);
			if (val !== null && val !== undefined) {
				if (min === null || val < min) {
					min = val;
				}
			}
		}
		return min;
	}

	computeMax(args, rows, context) {
		if (args.length === 0) return null;

		let max = null;
		for (const row of rows) {
			const val = this.evaluateExpression(args[0], row, context);
			if (val !== null && val !== undefined) {
				if (max === null || val > max) {
					max = val;
				}
			}
		}
		return max;
	}

	computeCollect(args, rows, context, distinct) {
		if (args.length === 0) return [];

		let values = [];
		for (const row of rows) {
			const val = this.evaluateExpression(args[0], row, context);
			values.push(val);
		}

		if (distinct) {
			const seen = new Set();
			values = values.filter((v) => {
				const key = JSON.stringify(v);
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
		}

		return values;
	}

	hasOnlyLiterals(items) {
		for (const item of items) {
			if (
				item.type !== 'literal' &&
				item.type !== 'star' &&
				item.type !== 'function' &&
				item.type !== 'binary' &&
				item.type !== 'unary'
			) {
				return false;
			}
		}
		return items.length > 0;
	}

	getDefaultAlias(expr) {
		if (expr.alias) return expr.alias;
		if (expr.type === 'property') {
			return `${expr.object}.${expr.property}`;
		}
		if (expr.type === 'variable') {
			return expr.variable;
		}
		if (expr.type === 'literal') {
			return String(expr.literal);
		}
		if (expr.type === 'function') {
			return `${expr.name}()`;
		}
		if (expr.type === 'binary') {
			return 'expr';
		}
		return 'result';
	}

	getAllVariables(context) {
		const vars = new Set();
		for (const row of context.results || []) {
			for (const key of Object.keys(row)) {
				vars.add(key);
			}
		}
		return Array.from(vars);
	}

	isAggregateFunction(name) {
		return QueryExecutor.AGGREGATE_FUNCTIONS.has(name.toLowerCase());
	}

	containsAggregate(expr) {
		if (!expr || typeof expr !== 'object') return false;
		if (expr.type === 'function' && this.isAggregateFunction(expr.name)) {
			return true;
		}
		if (expr.type === 'binary') {
			return (
				this.containsAggregate(expr.left) || this.containsAggregate(expr.right)
			);
		}
		if (expr.type === 'unary') {
			return this.containsAggregate(expr.operand);
		}
		if (expr.type === 'property') {
			return false;
		}
		if (expr.type === 'variable') {
			return false;
		}
		if (expr.type === 'literal') {
			return false;
		}
		if (expr.type === 'array') {
			return expr.elements.some((e) => this.containsAggregate(e));
		}
		return false;
	}

	hasAggregates(expressions) {
		return expressions.some((expr) => this.containsAggregate(expr));
	}

	extractAggregateExpr(expr) {
		if (expr.type === 'function' && this.isAggregateFunction(expr.name)) {
			return [expr];
		}
		const aggregates = [];
		if (expr.type === 'binary') {
			aggregates.push(...this.extractAggregateExpr(expr.left));
			aggregates.push(...this.extractAggregateExpr(expr.right));
		}
		if (expr.type === 'unary') {
			aggregates.push(...this.extractAggregateExpr(expr.operand));
		}
		if (expr.type === 'array') {
			for (const elem of expr.elements) {
				aggregates.push(...this.extractAggregateExpr(elem));
			}
		}
		return aggregates;
	}

	evaluateExpression(expr, row, _context) {
		if (expr.type === 'variable') {
			return row[expr.variable];
		}

		if (expr.type === 'property') {
			const obj = row[expr.object];
			if (obj && typeof obj.get === 'function') {
				return obj.get(expr.property);
			}
			return obj?.[expr.property];
		}

		if (expr.type === 'literal') {
			return expr.literal;
		}

		if (expr.type === 'function') {
			const args = expr.arguments.map((arg) =>
				this.evaluateExpression(arg, row, _context)
			);
			return this.callFunction(expr.name, args);
		}

		if (expr.type === 'binary') {
			const left = this.evaluateExpression(expr.left, row, _context);
			const right = this.evaluateExpression(expr.right, row, _context);
			return this.evaluateBinaryOp(expr.operator, left, right);
		}

		if (expr.type === 'unary') {
			const operand = this.evaluateExpression(expr.operand, row, _context);
			return this.evaluateUnaryOp(expr.operator, operand);
		}

		if (expr.type === 'array') {
			return expr.elements.map((e) =>
				this.evaluateExpression(e, row, _context)
			);
		}

		return null;
	}

	callFunction(name, args) {
		const graph = this.engine?.getGraph();
		const functions = {
			toUpper: (s) => String(s).toUpperCase(),
			toLower: (s) => String(s).toLowerCase(),
			trim: (s) => String(s).trim(),
			length: (s) => String(s).length,
			size: (obj) => {
				if (Array.isArray(obj)) return obj.length;
				if (obj?.relationships) return obj.relationships.length;
				return 0;
			},
			abs: (n) => Math.abs(n),
			ceil: (n) => Math.ceil(n),
			floor: (n) => Math.floor(n),
			round: (n) => Math.round(n),
			sqrt: (n) => Math.sqrt(n),
			rand: () => Math.random(),
			toString: (v) => String(v),
			toInteger: (v) => parseInt(v, 10),
			toFloat: (v) => parseFloat(v),
			type: (v) => typeof v,
			labels: (node) => node?.labels || [],
			keys: (obj) => {
				if (obj && typeof obj.getProperties === 'function') {
					return Object.keys(obj.getProperties());
				}
				return Object.keys(obj || {});
			},
			properties: (obj) => {
				if (obj && typeof obj.getProperties === 'function') {
					return obj.getProperties();
				}
				if (obj && obj.properties !== undefined) {
					return { ...obj.properties };
				}
				return obj ? { ...obj } : null;
			},
			head: (arr) => arr?.[0],
			last: (arr) => arr?.[arr?.length - 1],
			tail: (arr) => arr?.slice(1),
			reverse: (arr) => [...(arr || [])].reverse(),
			coalesce: (...args) => args.find((a) => a !== null && a !== undefined),
			id: (node) => node?.id,
			range: (start, end, step = 1) => {
				const result = [];
				if (step > 0) {
					for (let i = start; i <= end; i += step) {
						result.push(i);
					}
				} else if (step < 0) {
					for (let i = start; i >= end; i += step) {
						result.push(i);
					}
				}
				return result;
			},
			nodes: (path) => path?.nodes || [],
			relationships: (path) => path?.relationships || [],
			startNode: (rel) => {
				if (!rel || !graph) return null;
				return graph.getNode(rel.startNodeId);
			},
			endNode: (rel) => {
				if (!rel || !graph) return null;
				return graph.getNode(rel.endNodeId);
			},
		};

		const fn = functions[name];
		if (fn) {
			return fn.apply(null, args);
		}
		return null;
	}

	evaluateBinaryOp(operator, left, right) {
		if (
			left === null ||
			left === undefined ||
			right === null ||
			right === undefined
		) {
			return null;
		}
		switch (operator) {
			case '+':
				return left + right;
			case '-':
				return left - right;
			case '*':
				return left * right;
			case '/':
				return left / right;
			case '%':
				return left % right;
			case '^':
				return left ** right;
			case '=':
			case '==':
				return left === right;
			case '<>':
			case '!=':
				return left !== right;
			case '<':
				return left < right;
			case '>':
				return left > right;
			case '<=':
				return left <= right;
			case '>=':
				return left >= right;
			case 'AND':
				return left && right;
			case 'OR':
				return left || right;
			case 'CONTAINS':
				return String(left).includes(String(right));
			case 'STARTS WITH':
				return String(left).startsWith(String(right));
			case 'ENDS WITH':
				return String(left).endsWith(String(right));
			case 'IN':
				return Array.isArray(right) && right.includes(left);
			default:
				return null;
		}
	}

	evaluateUnaryOp(operator, operand) {
		if (operand === null || operand === undefined) {
			if (operator === 'IS NULL') return true;
			if (operator === 'IS NOT NULL') return false;
			return null;
		}
		switch (operator) {
			case '-':
				return -operand;
			case 'NOT':
				return !operand;
			case 'IS NULL':
				return false;
			case 'IS NOT NULL':
				return true;
			default:
				return null;
		}
	}

	/**
	 * Handle WHERE clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleWhere(context, body) {
		const parser = new ReturnParser(body);
		const expr = parser.parseExpression();

		const results = (context.results || []).filter((row) => {
			const value = this.evaluateExpression(expr, row, context);
			return value === true;
		});

		return {
			...context,
			results,
		};
	}

	/**
	 * Handle DELETE clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleDelete(context, body) {
		const graph = this.engine.getGraph();
		let deletedCount = 0;

		for (const token of body) {
			const varName = token;
			const entity = this.resolveVariable(varName, context);

			if (!entity) continue;

			if (entity.startNodeId !== undefined && entity.endNodeId !== undefined) {
				graph.deleteRelationship(entity.id);
				deletedCount++;
			} else if (entity.id !== undefined) {
				const rels = graph.getRelationshipsFrom(entity.id);
				for (const rel of rels) {
					graph.deleteRelationship(rel.id);
					deletedCount++;
				}
				const relsTo = graph.getRelationshipsTo(entity.id);
				for (const rel of relsTo) {
					graph.deleteRelationship(rel.id);
					deletedCount++;
				}
				graph.deleteNode(entity.id);
				deletedCount++;
			}
		}

		return {
			...context,
			statistics: {
				...context.statistics,
				relationshipsDeleted:
					(context.statistics?.relationshipsDeleted || 0) + deletedCount,
			},
		};
	}

	/**
	 * Handle SET clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleSet(context, body) {
		let setCount = 0;

		for (let i = 0; i < body.length; i++) {
			const token = body[i];
			if (token === '.') continue;

			const entity = this.resolveVariable(token, context);
			if (!entity || typeof entity.set !== 'function') continue;

			i++;
			while (i < body.length && body[i] !== ',') {
				const key = body[i];
				if (key === '=') {
					i++;
					const valueToken = body[i];
					const value = this.parseLiteralValue(valueToken);
					entity.set(key, value);
					setCount++;
				}
				i++;
			}
		}

		return {
			...context,
			statistics: {
				...context.statistics,
				propertiesSet: (context.statistics?.propertiesSet || 0) + setCount,
			},
		};
	}

	/**
	 * Handle REMOVE clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleRemove(context, body) {
		let removedCount = 0;

		for (let i = 0; i < body.length; i++) {
			const varName = body[i];
			const entity = this.resolveVariable(varName, context);

			if (!entity || typeof entity.removeLabel !== 'function') continue;

			i++;
			while (i < body.length && body[i] !== ',') {
				if (body[i] === ':') {
					i++;
					if (body[i]) {
						entity.removeLabel(body[i]);
						removedCount++;
					}
				}
				i++;
			}
		}

		return {
			...context,
			statistics: {
				...context.statistics,
				labelsRemoved: (context.statistics?.labelsRemoved || 0) + removedCount,
			},
		};
	}

	resolveVariable(varName, context) {
		if (!varName) return null;
		const results = context.results || [];
		for (const row of results) {
			if (row[varName] !== undefined) {
				return row[varName];
			}
		}
		return null;
	}

	parseLiteralValue(token) {
		if (!token) return null;
		if (token.startsWith('"') && token.endsWith('"')) {
			return token.slice(1, -1);
		}
		if (token.startsWith("'") && token.endsWith("'")) {
			return token.slice(1, -1);
		}
		if (/^-?\d+(\.\d+)?$/.test(token)) {
			return parseFloat(token);
		}
		if (token === 'true') return true;
		if (token === 'false') return false;
		if (token === 'null') return null;
		return null;
	}

	/**
	 * Handle WITH clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleWith(context, body) {
		const parser = new ReturnParser(body);
		const expressions = parser.parse();
		const columns = [];
		const distinct = expressions.distinct;
		const seenRows = new Set();

		const allVariables = this.getAllVariables(context);
		const results = [];

		let inputRows = context.results || [];
		const hasOnlyLiterals = this.hasOnlyLiterals(expressions.items);
		if (inputRows.length === 0 && hasOnlyLiterals) {
			inputRows = [{}];
		}

		for (const row of inputRows) {
			const outputRow = {};

			for (const expr of expressions.items) {
				if (expr.type === 'star') {
					for (const varName of allVariables) {
						const value = row[varName];
						outputRow[varName] = value;
						if (!columns.includes(varName)) {
							columns.push(varName);
						}
					}
				} else {
					const value = this.evaluateExpression(expr, row, context);
					const alias = expr.alias || this.getDefaultAlias(expr);
					outputRow[alias] = value;
					if (!columns.includes(alias)) {
						columns.push(alias);
					}
				}
			}

			if (distinct) {
				const key = JSON.stringify(outputRow);
				if (seenRows.has(key)) continue;
				seenRows.add(key);
			}

			results.push(outputRow);
		}

		return {
			...context,
			results,
			columns,
		};
	}

	/**
	 * Handle UNWIND clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleUnwind(context, body) {
		const parser = new ReturnParser(body);
		const expr = parser.parseExpression();

		let varName = expr.alias;
		if (!varName) {
			const remaining = parser.tokens.slice(parser.pos);
			if (remaining[0] === 'AS' && remaining[1]) {
				varName = remaining[1];
			}
		}

		if (!varName) {
			throw new Error('UNWIND requires AS clause');
		}

		let inputRows = context.results || [];
		if (inputRows.length === 0) {
			inputRows = [{}];
		}

		const results = [];
		const columns = context.columns ? [...context.columns] : [];
		if (!columns.includes(varName)) {
			columns.push(varName);
		}

		for (const row of inputRows) {
			const collection = this.evaluateExpression(expr, row, context);

			if (!Array.isArray(collection)) {
				throw new Error('UNWIND expects list expression');
			}

			for (const item of collection) {
				results.push({
					...row,
					[varName]: item,
				});
			}
		}

		return {
			...context,
			results,
			columns,
		};
	}

	/**
	 * Handle ORDER BY clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleOrderBy(context, body) {
		const results = context.results || [];
		if (results.length === 0) {
			return context;
		}

		const sortItems = this.parseOrderByItems(body);

		results.sort((a, b) => {
			for (const item of sortItems) {
				const aVal = this.evaluateOrderByExpression(item.expr, a, context);
				const bVal = this.evaluateOrderByExpression(item.expr, b, context);

				const cmp = this.compareValues(aVal, bVal);
				if (cmp !== 0) {
					return item.descending ? -cmp : cmp;
				}
			}
			return 0;
		});

		return {
			...context,
			results,
		};
	}

	/**
	 * Parse ORDER BY items
	 * @param {string[]} body
	 * @returns {Array<{expr: Object, descending: boolean}>}
	 */
	parseOrderByItems(body) {
		const items = [];
		let i = 0;

		// Skip 'BY' token if present
		if (body[0] && body[0].toUpperCase() === 'BY') {
			i = 1;
		}

		while (i < body.length) {
			const item = { expr: null, descending: false };

			const exprTokens = [];
			while (
				i < body.length &&
				body[i] !== ',' &&
				body[i].toUpperCase() !== 'ASC' &&
				body[i].toUpperCase() !== 'DESC'
			) {
				exprTokens.push(body[i]);
				i++;
			}

			if (exprTokens.length > 0) {
				item.expr = this.parseOrderByExpression(exprTokens);
			}

			if (
				i < body.length &&
				(body[i].toUpperCase() === 'ASC' || body[i].toUpperCase() === 'DESC')
			) {
				item.descending = body[i].toUpperCase() === 'DESC';
				i++;
			}

			if (i < body.length && body[i] === ',') {
				i++;
			}

			if (item.expr) {
				items.push(item);
			}
		}

		return items;
	}

	/**
	 * Parse a single ORDER BY expression
	 * @param {string[]} tokens
	 * @returns {Object}
	 */
	parseOrderByExpression(tokens) {
		if (tokens.length === 1) {
			const token = tokens[0];
			if (/^\d+$/.test(token)) {
				return { type: 'columnIndex', index: parseInt(token, 10) - 1 };
			}
			return { type: 'property', path: [token] };
		}

		const path = [];
		for (const token of tokens) {
			if (token !== '.') {
				path.push(token);
			}
		}

		if (path.length === 1) {
			return { type: 'property', path };
		}
		return { type: 'property', path };
	}

	/**
	 * Evaluate ORDER BY expression for a row
	 * @param {Object} expr
	 * @param {Object} row
	 * @param {Object} context
	 * @returns {*}
	 */
	evaluateOrderByExpression(expr, row, context) {
		if (expr.type === 'columnIndex') {
			const columns = context.columns || [];
			const colName = columns[expr.index];
			return colName ? row[colName] : null;
		}

		if (expr.type === 'property') {
			const path = expr.path;
			if (path.length === 1) {
				return row[path[0]];
			}

			let val = row[path[0]];
			for (let i = 1; i < path.length && val != null; i++) {
				if (typeof val === 'object' && val !== null) {
					val = val.properties ? val.properties[path[i]] : val[path[i]];
				} else {
					return null;
				}
			}
			return val;
		}

		return null;
	}

	/**
	 * Compare two values for sorting
	 * @param {*} a
	 * @param {*} b
	 * @returns {number}
	 */
	compareValues(a, b) {
		if (a === null || a === undefined) return 1;
		if (b === null || b === undefined) return -1;

		if (typeof a === 'number' && typeof b === 'number') {
			return a - b;
		}

		if (typeof a === 'string' && typeof b === 'string') {
			return a.localeCompare(b);
		}

		if (typeof a === 'boolean' && typeof b === 'boolean') {
			return a === b ? 0 : a ? 1 : -1;
		}

		return String(a).localeCompare(String(b));
	}

	/**
	 * Handle SKIP clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleSkip(context, body) {
		const results = context.results || [];
		const skip = body.length > 0 ? parseInt(body[0], 10) : 0;

		if (skip > 0 && skip < results.length) {
			return {
				...context,
				results: results.slice(skip),
			};
		} else if (skip >= results.length) {
			return {
				...context,
				results: [],
			};
		}
		return context;
	}

	/**
	 * Handle LIMIT clause
	 * @param {Object} context
	 * @param {string[]} body
	 * @returns {Object}
	 */
	handleLimit(context, body) {
		const results = context.results || [];
		const limit = body.length > 0 ? parseInt(body[0], 10) : results.length;

		if (limit >= 0 && limit < results.length) {
			return {
				...context,
				results: results.slice(0, limit),
			};
		}
		return context;
	}
}

export default QueryExecutor;
