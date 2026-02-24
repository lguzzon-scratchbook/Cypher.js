import { beforeEach, describe, expect, it } from 'bun:test';
import { CypherNG } from '../../src/CypherNG.js';
import { GraphEngine } from '../../src/core/GraphEngine.js';
import { ExpressionEvaluator } from '../../src/core/ExpressionEvaluator.js';
import { QueryExecutor } from '../../src/core/QueryExecutor.js';
import { QueryParser } from '../../src/core/QueryParser.js';
import { Graph } from '../../src/data/Graph.js';
import { Node } from '../../src/data/Node.js';
import { QueryResult } from '../../src/data/QueryResult.js';
import { Relationship } from '../../src/data/Relationship.js';
import { StorageAdapter } from '../../src/storage/Adapter.js';
import { Registry } from '../../src/storage/Registry.js';
import { StringRecoder } from '../../src/utils/StringRecoder.js';

describe('Node', () => {
	let node;

	beforeEach(() => {
		node = new Node(1, ['Person'], { name: 'Alice', age: 30 });
	});

	it('should create a node with id, labels, and properties', () => {
		expect(node.id).toBe(1);
		expect(node.labels).toEqual(['Person']);
		expect(node.properties).toEqual({ name: 'Alice', age: 30 });
	});

	it('should add labels', () => {
		node.addLabel('Developer');
		expect(node.labels).toContain('Person');
		expect(node.labels).toContain('Developer');
	});

	it('should not add duplicate labels', () => {
		node.addLabel('Person');
		expect(node.labels.length).toBe(1);
	});

	it('should check for labels', () => {
		expect(node.hasLabel('Person')).toBe(true);
		expect(node.hasLabel('Developer')).toBe(false);
	});

	it('should get and set properties', () => {
		expect(node.get('name')).toBe('Alice');
		node.set('city', 'NYC');
		expect(node.get('city')).toBe('NYC');
	});

	it('should serialize to object', () => {
		const obj = node.toObject();
		expect(obj.id).toBe(1);
		expect(obj.labels).toEqual(['Person']);
		expect(obj.properties).toEqual({ name: 'Alice', age: 30 });
	});

	it('should deserialize from object', () => {
		const obj = { id: 2, labels: ['Company'], properties: { name: 'Acme' } };
		const newNode = Node.fromObject(obj);
		expect(newNode.id).toBe(2);
		expect(newNode.labels).toEqual(['Company']);
		expect(newNode.properties).toEqual({ name: 'Acme' });
	});
});

describe('Relationship', () => {
	let relationship;

	beforeEach(() => {
		relationship = new Relationship(1, 'KNOWS', 1, 2, { since: 2020 });
	});

	it('should create a relationship with id, type, start, end, and properties', () => {
		expect(relationship.id).toBe(1);
		expect(relationship.type).toBe('KNOWS');
		expect(relationship.startNodeId).toBe(1);
		expect(relationship.endNodeId).toBe(2);
		expect(relationship.properties).toEqual({ since: 2020 });
	});

	it('should serialize to object', () => {
		const obj = relationship.toObject();
		expect(obj.id).toBe(1);
		expect(obj.type).toBe('KNOWS');
		expect(obj.startNodeId).toBe(1);
		expect(obj.endNodeId).toBe(2);
	});

	it('should deserialize from object', () => {
		const obj = {
			id: 2,
			type: 'WORKS_AT',
			startNodeId: 1,
			endNodeId: 3,
			properties: {},
		};
		const rel = Relationship.fromObject(obj);
		expect(rel.id).toBe(2);
		expect(rel.type).toBe('WORKS_AT');
	});
});

describe('Graph', () => {
	let graph;

	beforeEach(() => {
		graph = new Graph();
	});

	it('should start empty', () => {
		expect(graph.getNodes()).toEqual([]);
		expect(graph.getRelationships()).toEqual([]);
		expect(graph.nodeCount).toBe(0);
		expect(graph.relationshipCount).toBe(0);
	});

	it('should add and get nodes', () => {
		const node = new Node(1, ['Person'], { name: 'Bob' });
		graph.addNode(node);
		expect(graph.getNodes()).toHaveLength(1);
		expect(graph.getNode(1)).toBe(node);
	});

	it('should get nodes by label', () => {
		const node1 = new Node(1, ['Person'], {});
		const node2 = new Node(2, ['Company'], {});
		const node3 = new Node(3, ['Person'], {});
		graph.addNode(node1);
		graph.addNode(node2);
		graph.addNode(node3);

		const people = graph.getNodesByLabel('Person');
		expect(people).toHaveLength(2);
	});

	it('should delete nodes', () => {
		const node = new Node(1, ['Person'], {});
		graph.addNode(node);
		expect(graph.deleteNode(1)).toBe(true);
		expect(graph.getNode(1)).toBeUndefined();
	});

	it('should add and get relationships', () => {
		const node1 = new Node(1, ['Person'], {});
		const node2 = new Node(2, ['Person'], {});
		graph.addNode(node1);
		graph.addNode(node2);

		const rel = new Relationship(1, 'KNOWS', 1, 2, {});
		graph.addRelationship(rel);
		expect(graph.getRelationships()).toHaveLength(1);
		expect(graph.getRelationship(1)).toBe(rel);
	});

	it('should get relationships from/to a node', () => {
		const node1 = new Node(1, ['Person'], {});
		const node2 = new Node(2, ['Person'], {});
		const node3 = new Node(3, ['Person'], {});
		graph.addNode(node1);
		graph.addNode(node2);
		graph.addNode(node3);

		graph.addRelationship(new Relationship(1, 'KNOWS', 1, 2, {}));
		graph.addRelationship(new Relationship(2, 'KNOWS', 1, 3, {}));
		graph.addRelationship(new Relationship(3, 'KNOWS', 2, 3, {}));

		const from1 = graph.getRelationshipsFrom(1);
		const to3 = graph.getRelationshipsTo(3);

		expect(from1).toHaveLength(2);
		expect(to3).toHaveLength(2);
	});

	it('should clear the graph', () => {
		const node = new Node(1, ['Person'], {});
		graph.addNode(node);
		graph.clear();
		expect(graph.nodeCount).toBe(0);
	});

	it('should serialize to object', () => {
		const node = new Node(1, ['Person'], { name: 'Test' });
		graph.addNode(node);
		const obj = graph.toObject();
		expect(obj.nodes).toHaveLength(1);
		expect(obj.relationships).toHaveLength(0);
	});
});

describe('QueryParser', () => {
	let parser;

	beforeEach(() => {
		parser = new QueryParser();
	});

	it('should normalize query string', () => {
		const normalized = parser.normalize('  MATCH   (n)  RETURN  n  ');
		expect(normalized).toBe('MATCH (n) RETURN n');
	});

	it('should tokenize simple query', () => {
		const tokens = parser.tokenize('MATCH (n) RETURN n');
		expect(tokens).toContain('MATCH');
		expect(tokens).toContain('(');
		expect(tokens).toContain('n');
		expect(tokens).toContain(')');
	});

	it('should handle string literals', () => {
		const tokens = parser.tokenize("MATCH (n) WHERE n.name = 'Alice'");
		expect(tokens).toContain("'Alice'");
	});

	it('should parse simple MATCH RETURN query', () => {
		const ast = parser.parse('MATCH (n) RETURN n');
		expect(ast.type).toBe('Query');
		expect(ast.clauses).toHaveLength(2);
		expect(ast.clauses[0].type).toBe('MATCH');
		expect(ast.clauses[1].type).toBe('RETURN');
	});

	it('should parse CREATE query', () => {
		const ast = parser.parse('CREATE (n) RETURN n');
		expect(ast.clauses[0].type).toBe('CREATE');
	});

	it('should parse MERGE query', () => {
		const ast = parser.parse('MERGE (n:Person) RETURN n');
		expect(ast.clauses[0].type).toBe('MERGE');
	});
});

describe('GraphEngine', () => {
	let engine;

	beforeEach(() => {
		engine = new GraphEngine();
	});

	it('should create nodes with sequential IDs', () => {
		const node1 = engine.createNode(['Person'], { name: 'Alice' });
		const node2 = engine.createNode(['Person'], { name: 'Bob' });

		expect(node1.id).toBe(0);
		expect(node2.id).toBe(1);
	});

	it('should get nodes by ID', () => {
		const node = engine.createNode(['Person'], {});
		const found = engine.getNode(node.id);
		expect(found).toBe(node);
	});

	it('should get all nodes', () => {
		engine.createNode(['Person'], {});
		engine.createNode(['Company'], {});
		const nodes = engine.getNodes();
		expect(nodes).toHaveLength(2);
	});

	it('should get nodes by label', () => {
		engine.createNode(['Person', 'Developer'], {});
		engine.createNode(['Company'], {});
		const people = engine.getNodesByLabel('Person');
		expect(people).toHaveLength(1);
	});

	it('should delete nodes', () => {
		const node = engine.createNode(['Person'], {});
		const id = node.id;
		expect(engine.deleteNode(id)).toBe(true);
		expect(engine.getNode(id)).toBeUndefined();
	});

	it('should create relationships', () => {
		const node1 = engine.createNode(['Person'], {});
		const node2 = engine.createNode(['Person'], {});
		const rel = engine.createRelationship(node1.id, node2.id, 'KNOWS', {
			since: 2020,
		});

		expect(rel).toBeDefined();
		expect(rel.type).toBe('KNOWS');
		expect(engine.relationshipCount).toBe(1);
	});

	it('should fail to create relationship with invalid nodes', () => {
		const rel = engine.createRelationship(999, 888, 'KNOWS', {});
		expect(rel).toBeUndefined();
	});

	it('should delete relationships', () => {
		const node1 = engine.createNode(['Person'], {});
		const node2 = engine.createNode(['Person'], {});
		const rel = engine.createRelationship(node1.id, node2.id, 'KNOWS');
		const relId = rel.id;

		expect(engine.deleteRelationship(relId)).toBe(true);
		expect(engine.getRelationship(relId)).toBeUndefined();
	});

	it('should clear the engine', () => {
		engine.createNode(['Person'], {});
		engine.clear();
		expect(engine.nodeCount).toBe(0);
		expect(engine.relationshipCount).toBe(0);
	});
});

describe('QueryResult', () => {
	it('should create a query result', () => {
		const result = new QueryResult(['n'], [{ n: { id: 1 } }], {
			nodesCreated: 1,
		});
		expect(result.columns).toEqual(['n']);
		expect(result.data).toHaveLength(1);
		expect(result.stats.nodesCreated).toBe(1);
	});
});

describe('CypherNG', () => {
	let cypher;

	beforeEach(() => {
		cypher = new CypherNG();
	});

	it('should create a CypherNG instance', () => {
		expect(cypher).toBeDefined();
		expect(cypher.engine).toBeDefined();
		expect(cypher.parser).toBeDefined();
	});

	it('should execute RETURN query', (done) => {
		const _result = cypher.execute('RETURN 1 as num', {}, (res) => {
			expect(res).toBeDefined();
			done();
		});
	});

	it('should execute RETURN with callback', (done) => {
		cypher.execute('RETURN 42', {}, (result) => {
			expect(result).toBeInstanceOf(QueryResult);
			done();
		});
	});

	it('should parse a query', () => {
		const ast = cypher.parse('MATCH (n) RETURN n');
		expect(ast.type).toBe('Query');
		expect(ast.clauses).toBeDefined();
	});

	it('should set and get storage adapter', () => {
		class MockAdapter extends StorageAdapter {
			async save() {}
			async load() {
				return null;
			}
			async delete() {}
			async exists() {
				return false;
			}
			async listKeys() {
				return [];
			}
			async clear() {}
		}
		const mockAdapter = new MockAdapter();
		cypher.setStorage('test', mockAdapter);
		const storage = cypher.getStorage();
		expect(storage).toBeDefined();
	});

	it('should export graph to JSON', () => {
		cypher.execute('CREATE (n:Person {name: "Test"}) RETURN n');
		const json = cypher.toJSON();
		expect(json).toBeDefined();
		expect(json.nodes).toBeDefined();
	});

	it('should clear graph data', () => {
		cypher.execute('CREATE (n) RETURN n');
		expect(cypher.getGraph().nodeCount).toBeGreaterThan(0);
		cypher.clear();
		expect(cypher.getGraph().nodeCount).toBe(0);
	});

	it('should support async execution', async () => {
		const result = await cypher.executeAsync('RETURN "hello" as greeting');
		expect(result).toBeInstanceOf(QueryResult);
	});
});

describe('StringRecoder', () => {
	let recoder;

	beforeEach(() => {
		recoder = new StringRecoder();
	});

	it('should recode a string to an integer', () => {
		const code = recoder.recode('hello');
		expect(typeof code).toBe('number');
	});

	it('should return same code for same string', () => {
		const code1 = recoder.recode('hello');
		const code2 = recoder.recode('hello');
		expect(code1).toBe(code2);
	});

	it('should return different codes for different strings', () => {
		const code1 = recoder.recode('hello');
		const code2 = recoder.recode('world');
		expect(code1).not.toBe(code2);
	});

	it('should handle null values', () => {
		expect(recoder.recode(null)).toBe(null);
	});

	it('should handle undefined values', () => {
		expect(recoder.recode(undefined)).toBe(undefined);
	});

	it('should handle empty string', () => {
		expect(recoder.recode('')).toBe('');
	});

	it('should handle numbers', () => {
		const code = recoder.recode(123);
		expect(typeof code).toBe('number');
	});

	it('should reset the recoder', () => {
		recoder.recode('test');
		recoder.reset();
		const code = recoder.recode('test');
		expect(code).toBe(1);
	});
});

describe('ExpressionEvaluator', () => {
	let evaluator;

	beforeEach(() => {
		evaluator = new ExpressionEvaluator({ x: 10, y: 5 });
	});

	it('should evaluate null/undefined', () => {
		expect(evaluator.evaluate(null)).toBe(null);
		expect(evaluator.evaluate(undefined)).toBe(null);
	});

	it('should evaluate object without type', () => {
		const result = evaluator.evaluate({ foo: 'bar' });
		expect(result.foo).toBe('bar');
	});

	it('should evaluate Identifier', () => {
		expect(evaluator.evaluate({ type: 'Identifier', name: 'x' })).toBe(10);
		expect(evaluator.evaluate({ type: 'Identifier', name: 'unknown' })).toBe(null);
	});

	it('should evaluate Literal', () => {
		expect(evaluator.evaluate({ type: 'Literal', value: 42 })).toBe(42);
	});

	it('should evaluate PropertyAccess', () => {
		const obj = { type: 'PropertyAccess', object: { type: 'Identifier', name: 'x' }, property: 'toString' };
		const result = evaluator.evaluate(obj);
		expect(result).toBeDefined();
	});

	it('should evaluate FunctionCall', () => {
		const expr = { type: 'FunctionCall', name: 'toUpper', arguments: [{ type: 'Literal', value: 'hello' }] };
		expect(evaluator.evaluate(expr)).toBe('HELLO');
	});

	it('should evaluate unknown function', () => {
		const expr = { type: 'FunctionCall', name: 'unknown', arguments: [] };
		expect(evaluator.evaluate(expr)).toBe(null);
	});

	it('should evaluate BinaryExpression - math operators', () => {
		const expr = { type: 'BinaryExpression', operator: '+', left: { type: 'Literal', value: 2 }, right: { type: 'Literal', value: 3 } };
		expect(evaluator.evaluate(expr)).toBe(5);

		expr.operator = '-';
		expect(evaluator.evaluate(expr)).toBe(-1);

		expr.operator = '*';
		expect(evaluator.evaluate(expr)).toBe(6);

		expr.operator = '/';
		expect(evaluator.evaluate(expr)).toBe(2 / 3);

		expr.operator = '%';
		expect(evaluator.evaluate(expr)).toBe(2);
	});

	it('should evaluate BinaryExpression - comparison operators', () => {
		const expr = { type: 'BinaryExpression', operator: '=', left: { type: 'Literal', value: 5 }, right: { type: 'Literal', value: 5 } };
		expect(evaluator.evaluate(expr)).toBe(true);

		expr.operator = '==';
		expect(evaluator.evaluate(expr)).toBe(true);

		expr.operator = '!=';
		expect(evaluator.evaluate(expr)).toBe(false);

		expr.operator = '<';
		expect(evaluator.evaluate(expr)).toBe(false);

		expr.operator = '>';
		expect(evaluator.evaluate(expr)).toBe(false);

		expr.operator = '<=';
		expect(evaluator.evaluate(expr)).toBe(true);

		expr.operator = '>=';
		expect(evaluator.evaluate(expr)).toBe(true);
	});

	it('should evaluate BinaryExpression - logical operators', () => {
		const expr = { type: 'BinaryExpression', operator: 'AND', left: { type: 'Literal', value: true }, right: { type: 'Literal', value: true } };
		expect(evaluator.evaluate(expr)).toBe(true);

		expr.operator = 'OR';
		expect(evaluator.evaluate(expr)).toBe(true);

		expr.left = { type: 'Literal', value: false };
		expect(evaluator.evaluate(expr)).toBe(true);
	});

	it('should evaluate BinaryExpression - string operators', () => {
		const expr = { type: 'BinaryExpression', operator: 'CONTAINS', left: { type: 'Literal', value: 'hello world' }, right: { type: 'Literal', value: 'world' } };
		expect(evaluator.evaluate(expr)).toBe(true);

		expr.operator = 'STARTS WITH';
		expect(evaluator.evaluate(expr)).toBe(false);

		expr.operator = 'ENDS WITH';
		expect(evaluator.evaluate(expr)).toBe(true);
	});

	it('should evaluate BinaryExpression - IN operator', () => {
		const expr = { type: 'BinaryExpression', operator: 'IN', left: { type: 'Literal', value: 2 }, right: { type: 'Literal', value: [1, 2, 3] } };
		expect(evaluator.evaluate(expr)).toBe(true);
	});

	it('should evaluate unknown binary operator', () => {
		const expr = { type: 'BinaryExpression', operator: 'UNKNOWN', left: {}, right: {} };
		expect(evaluator.evaluate(expr)).toBe(null);
	});

	it('should evaluate UnaryExpression - NOT', () => {
		const expr = { type: 'UnaryExpression', operator: 'NOT', operand: { type: 'Literal', value: false } };
		expect(evaluator.evaluate(expr)).toBe(true);
	});

	it('should evaluate UnaryExpression - negation', () => {
		const expr = { type: 'UnaryExpression', operator: '-', operand: { type: 'Literal', value: 5 } };
		expect(evaluator.evaluate(expr)).toBe(-5);
	});

	it('should evaluate unknown unary operator', () => {
		const expr = { type: 'UnaryExpression', operator: 'UNKNOWN', operand: {} };
		expect(evaluator.evaluate(expr)).toBe(null);
	});

	it('should evaluate string literals', () => {
		expect(evaluator.evaluate("'hello'")).toBe('hello');
		expect(evaluator.evaluate('"world"')).toBe('world');
	});

	it('should evaluate numeric strings', () => {
		expect(evaluator.evaluate('42')).toBe(42);
		expect(evaluator.evaluate('3.14')).toBe(3.14);
	});

	it('should evaluate boolean literals', () => {
		expect(evaluator.evaluate('true')).toBe(true);
		expect(evaluator.evaluate('false')).toBe(false);
		expect(evaluator.evaluate('null')).toBe(null);
	});

	it('should evaluate string functions', () => {
		let expr = { type: 'FunctionCall', name: 'toLower', arguments: [{ type: 'Literal', value: 'HELLO' }] };
		expect(evaluator.evaluate(expr)).toBe('hello');

		expr = { type: 'FunctionCall', name: 'trim', arguments: [{ type: 'Literal', value: '  HELLO  ' }] };
		expect(evaluator.evaluate(expr)).toBe('HELLO');

		expr = { type: 'FunctionCall', name: 'left', arguments: [{ type: 'Literal', value: 'HELLO' }, { type: 'Literal', value: 2 }] };
		expect(evaluator.evaluate(expr)).toBe('HE');

		expr = { type: 'FunctionCall', name: 'right', arguments: [{ type: 'Literal', value: 'HELLO' }, { type: 'Literal', value: 2 }] };
		expect(evaluator.evaluate(expr)).toBe('LO');

		expr = { type: 'FunctionCall', name: 'replace', arguments: [{ type: 'Literal', value: 'HELLO' }, { type: 'Literal', value: 'EL' }, { type: 'Literal', value: 'XX' }] };
		expect(evaluator.evaluate(expr)).toBe('HXXLO');
	});

	it('should evaluate math functions', () => {
		let expr = { type: 'FunctionCall', name: 'abs', arguments: [{ type: 'Literal', value: -5 }] };
		expect(evaluator.evaluate(expr)).toBe(5);

		expr = { type: 'FunctionCall', name: 'ceil', arguments: [{ type: 'Literal', value: 4.2 }] };
		expect(evaluator.evaluate(expr)).toBe(5);

		expr = { type: 'FunctionCall', name: 'floor', arguments: [{ type: 'Literal', value: 4.7 }] };
		expect(evaluator.evaluate(expr)).toBe(4);

		expr = { type: 'FunctionCall', name: 'round', arguments: [{ type: 'Literal', value: 4.5 }] };
		expect(evaluator.evaluate(expr)).toBe(5);

		expr = { type: 'FunctionCall', name: 'sqrt', arguments: [{ type: 'Literal', value: 5 }] };
		expect(evaluator.evaluate(expr)).toBeCloseTo(2.236);
	});

	it('should evaluate type functions', () => {
		const expr = { type: 'FunctionCall', name: 'toString', arguments: [{ type: 'Literal', value: 42 }] };
		expect(evaluator.evaluate(expr)).toBe('42');

		expr.name = 'type';
		expect(evaluator.evaluate(expr)).toBe('number');
	});

	it('should evaluate collection functions', () => {
		let expr = { type: 'FunctionCall', name: 'size', arguments: [{ type: 'Literal', value: [1, 2, 3] }] };
		expect(evaluator.evaluate(expr)).toBe(3);

		expr = { type: 'FunctionCall', name: 'head', arguments: [{ type: 'Literal', value: [1, 2, 3] }] };
		expect(evaluator.evaluate(expr)).toBe(1);

		expr = { type: 'FunctionCall', name: 'last', arguments: [{ type: 'Literal', value: [1, 2, 3] }] };
		expect(evaluator.evaluate(expr)).toBe(3);

		expr = { type: 'FunctionCall', name: 'collect', arguments: [{ type: 'Literal', value: 5 }] };
		expect(evaluator.evaluate(expr)).toEqual([5]);

		expr = { type: 'FunctionCall', name: 'reverse', arguments: [{ type: 'Literal', value: [1, 2, 3] }] };
		expect(evaluator.evaluate(expr)).toEqual([3, 2, 1]);
	});

	it('should evaluate expression with custom context', () => {
		const result = evaluator.evaluate({ type: 'Identifier', name: 'x' }, { x: 100 });
		expect(result).toBe(100);
	});
});

describe('Registry', () => {
	let registry;

	beforeEach(() => {
		registry = new Registry();
	});

	it('should create a registry', () => {
		expect(registry).toBeDefined();
	});

	it('should register and get a storage adapter', () => {
		class MockAdapter extends StorageAdapter {
			async save() {}
			async load() { return null; }
			async delete() {}
			async exists() { return false; }
			async listKeys() { return []; }
			async clear() {}
		}
		const adapter = new MockAdapter();
		registry.register('test', adapter);
		expect(registry.get('test')).toBe(adapter);
	});

	it('should return undefined for unregistered key', () => {
		expect(registry.get('unknown')).toBeUndefined();
	});

	it('should check if adapter exists', () => {
		class MockAdapter extends StorageAdapter {
			async save() {}
			async load() { return null; }
			async delete() {}
			async exists() { return false; }
			async listKeys() { return []; }
			async clear() {}
		}
		const adapter = new MockAdapter();
		registry.register('test', adapter);
		expect(registry.has('test')).toBe(true);
		expect(registry.has('unknown')).toBe(false);
	});

	it('should unregister an adapter', () => {
		class MockAdapter extends StorageAdapter {
			async save() {}
			async load() { return null; }
			async delete() {}
			async exists() { return false; }
			async listKeys() { return []; }
			async clear() {}
		}
		const adapter = new MockAdapter();
		registry.register('test', adapter);
		registry.unregister('test');
		expect(registry.get('test')).toBeUndefined();
	});

	it('should list registered adapters', () => {
		class MockAdapter extends StorageAdapter {
			async save() {}
			async load() { return null; }
			async delete() {}
			async exists() { return false; }
			async listKeys() { return []; }
			async clear() {}
		}
		registry.register('test1', new MockAdapter());
		registry.register('test2', new MockAdapter());
		const keys = registry.list();
		expect(keys).toContain('test1');
		expect(keys).toContain('test2');
	});
});

describe('QueryExecutor', () => {
	let executor;
	let engine;

	beforeEach(() => {
		engine = new GraphEngine();
		executor = new QueryExecutor(engine);
	});

	it('should execute MATCH query', () => {
		const result = executor.executeSync('MATCH (n) RETURN n');
		expect(result).toBeInstanceOf(QueryResult);
	});

	it('should execute CREATE query', () => {
		const result = executor.executeSync('CREATE (n) RETURN n');
		expect(result.stats.nodesCreated).toBe(1);
	});

	it('should execute with callback', () => {
		executor.execute('RETURN 1', {}, (result) => {
			expect(result).toBeInstanceOf(QueryResult);
		});
	});

	it('should execute async', async () => {
		const result = await executor.executeAsync('RETURN 1');
		expect(result).toBeInstanceOf(QueryResult);
	});
});
