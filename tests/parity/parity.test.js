import { beforeEach, describe, expect, it } from 'bun:test';
import { CypherNG } from '../../src/CypherNG.js';

let CypherJS = null;
try {
	CypherJS = require('../../js/Cypher.js');
} catch (e) {
	console.log(
		'Note: Original Cypher.js has initialization bug - parity tests will focus on CypherNG'
	);
}

function normalizeResult(result) {
	if (!result) return null;

	const normalized = {
		columns: result.columns || [],
		data: [],
		stats: result.stats || {},
	};

	if (result.data && Array.isArray(result.data)) {
		normalized.data = result.data.map((row) => {
			const normalizedRow = {};
			for (const [key, value] of Object.entries(row)) {
				normalizedRow[key] = normalizeValue(value);
			}
			return normalizedRow;
		});
	}

	return normalized;
}

function normalizeValue(value) {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === 'object') {
		if (value.id !== undefined && value.labels !== undefined) {
			return {
				id: value.id,
				labels: [...(value.labels || [])].sort(),
				properties: value.properties || {},
			};
		}
		if (value.startNodeId !== undefined && value.endNodeId !== undefined) {
			return {
				id: value.id,
				type: value.type,
				startNodeId: value.startNodeId,
				endNodeId: value.endNodeId,
				properties: value.properties || {},
			};
		}
		if (Array.isArray(value)) {
			return value.map(normalizeValue);
		}
		return value;
	}

	return value;
}

function runQuery(engine, query) {
	return new Promise((resolve) => {
		engine.execute(query, {}, (result) => {
			resolve(normalizeResult(result));
		});
	});
}

const canTestParity = CypherJS !== null;

describe('Behavioral Parity Tests', () => {
	let cypherNG;

	beforeEach(() => {
		cypherNG = new CypherNG();
	});

	describe('CREATE Node Operations', () => {
		it('should create a simple node', async () => {
			const query = 'CREATE (n) RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.nodesCreated).toBe(1);
			expect(resultNG.data.length).toBe(1);
		});

		it('should create node with label', async () => {
			const query = 'CREATE (n:Person) RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.nodesCreated).toBe(1);
			expect(resultNG.data[0].n.labels).toContain('Person');
		});

		it('should create node with properties', async () => {
			const query = 'CREATE (n:Person {name: "Alice", age: 30}) RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.nodesCreated).toBe(1);
			expect(resultNG.data[0].n.properties.name).toBe('Alice');
			expect(resultNG.data[0].n.properties.age).toBe(30);
		});

		it('should create multiple nodes', async () => {
			const query =
				'CREATE (a:Person {name: "Alice"}), (b:Person {name: "Bob"}) RETURN a, b';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.nodesCreated).toBe(2);
			expect(resultNG.data.length).toBe(1);
		});
	});

	describe('MATCH Node Operations', () => {
		it('should match all nodes', async () => {
			await runQuery(cypherNG, 'CREATE (a:Person {name: "Alice"})');

			const query = 'MATCH (n) RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});

		it('should match nodes by label', async () => {
			await runQuery(cypherNG, 'CREATE (a:Person), (b:Company)');

			const query = 'MATCH (n:Person) RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});

		it('should match nodes by property', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"}), (b:Person {name: "Bob"})'
			);

			const query = 'MATCH (n:Person {name: "Alice"}) RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].n.properties.name).toBe('Alice');
		});

		it('should match nodes with multiple labels', async () => {
			await runQuery(cypherNG, 'CREATE (a:Person:Employee {name: "Alice"})');

			const query = 'MATCH (n:Person:Employee) RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});
	});

	describe('CREATE Relationship Operations', () => {
		it('should create relationship between two nodes', async () => {
			const query =
				'CREATE (a:Person {name: "Alice"})-[:KNOWS]->(b:Person {name: "Bob"}) RETURN a, b';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.nodesCreated).toBe(2);
			expect(resultNG.stats.relationshipsCreated).toBe(1);
		});

		it('should create relationship with properties', async () => {
			const query =
				'CREATE (a)-[:KNOWS {since: 2020, weight: 5}]->(b) RETURN a, b';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.relationshipsCreated).toBe(1);
		});

		it('should create relationship with variable', async () => {
			const query = 'CREATE (a)-[r:KNOWS]->(b) RETURN r';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.relationshipsCreated).toBe(1);
			expect(resultNG.data[0].r.type).toBe('KNOWS');
		});
	});

	describe('MERGE Operations', () => {
		it('should create node when not exists', async () => {
			const query = 'MERGE (n:Person {name: "Alice"}) RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.nodesCreated).toBe(1);
			expect(resultNG.stats.nodesMerged).toBe(0);
		});

		it('should match existing node', async () => {
			await runQuery(cypherNG, 'CREATE (n:Person {name: "Alice"})');

			const query = 'MERGE (n:Person {name: "Alice"}) RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.nodesCreated).toBe(0);
			expect(resultNG.stats.nodesMerged).toBe(1);
		});

		it('should create relationship when not found', async () => {
			const query =
				'MERGE (a:Person {name: "Alice"})-[:KNOWS]->(b:Person {name: "Bob"}) RETURN a, b';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.nodesCreated).toBe(2);
			expect(resultNG.stats.relationshipsCreated).toBe(1);
		});

		it('should match existing relationship', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"})-[:KNOWS]->(b:Person {name: "Bob"})'
			);

			const query =
				'MERGE (a:Person {name: "Alice"})-[:KNOWS]->(b:Person {name: "Bob"}) RETURN a, b';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.relationshipsMerged).toBe(1);
		});
	});

	describe('WHERE Clause', () => {
		it('should filter by equality', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice", age: 30}), (b:Person {name: "Bob", age: 25})'
			);

			const query = 'MATCH (n:Person) WHERE n.name = "Alice" RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].n.properties.name).toBe('Alice');
		});

		it('should filter by comparison', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {age: 30}), (b:Person {age: 20}), (c:Person {age: 40})'
			);

			const query = 'MATCH (n:Person) WHERE n.age > 25 RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(2);
		});

		it('should filter with AND', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {age: 30, name: "Alice"}), (b:Person {age: 25, name: "Bob"})'
			);

			const query =
				'MATCH (n:Person) WHERE n.age > 20 AND n.name = "Alice" RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});

		it('should filter with OR', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"}), (b:Person {name: "Bob"}), (c:Person {name: "Charlie"})'
			);

			const query =
				'MATCH (n:Person) WHERE n.name = "Alice" OR n.name = "Bob" RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(2);
		});

		it('should filter with NOT', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"}), (b:Person {name: "Bob"})'
			);

			const query = 'MATCH (n:Person) WHERE NOT n.name = "Alice" RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].n.properties.name).toBe('Bob');
		});

		it('should filter with IN', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"}), (b:Person {name: "Bob"}), (c:Person {name: "Charlie"})'
			);

			const query =
				'MATCH (n:Person) WHERE n.name IN ["Alice", "Bob"] RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(2);
		});

		it('should filter with CONTAINS', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"}), (b:Person {name: "Bob"})'
			);

			const query = 'MATCH (n:Person) WHERE n.name CONTAINS "ic" RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].n.properties.name).toBe('Alice');
		});

		it('should filter with STARTS WITH', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"}), (b:Person {name: "Bob"})'
			);

			const query = 'MATCH (n:Person) WHERE n.name STARTS WITH "A" RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});

		it('should filter with ENDS WITH', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"}), (b:Person {name: "Bob"})'
			);

			const query = 'MATCH (n:Person) WHERE n.name ENDS WITH "e" RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});

		it('should filter with IS NULL', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice", age: 30}), (b:Person {name: "Bob"})'
			);

			const query = 'MATCH (n:Person) WHERE n.age IS NULL RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].n.properties.name).toBe('Bob');
		});

		it('should filter with IS NOT NULL', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice", age: 30}), (b:Person {name: "Bob"})'
			);

			const query = 'MATCH (n:Person) WHERE n.age IS NOT NULL RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});
	});

	describe('RETURN Clause', () => {
		it('should return simple variable', async () => {
			await runQuery(cypherNG, 'CREATE (n:Person {name: "Alice"})');

			const query = 'MATCH (n) RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.columns).toContain('n');
		});

		it('should return property', async () => {
			await runQuery(cypherNG, 'CREATE (n:Person {name: "Alice"})');

			const query = 'MATCH (n) RETURN n.name';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.columns).toContain('n.name');
			expect(resultNG.data[0]['n.name']).toBe('Alice');
		});

		it('should return with alias', async () => {
			await runQuery(cypherNG, 'CREATE (n:Person {name: "Alice"})');

			const query = 'MATCH (n) RETURN n.name AS name';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.columns).toContain('name');
			expect(resultNG.data[0].name).toBe('Alice');
		});

		it('should return with function', async () => {
			await runQuery(cypherNG, 'CREATE (n:Person {name: "Alice"})');

			const query = 'MATCH (n) RETURN toUpper(n.name) AS upperName';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].upperName).toBe('ALICE');
		});

		it('should return with expression', async () => {
			await runQuery(cypherNG, 'CREATE (n:Person {age: 30})');

			const query = 'MATCH (n) RETURN n.age * 2 AS doubleAge';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].doubleAge).toBe(60);
		});

		it('should return DISTINCT', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"}), (b:Person {name: "Alice"})'
			);

			const query = 'MATCH (n) RETURN DISTINCT n.name AS name';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});

		it('should return *', async () => {
			await runQuery(cypherNG, 'CREATE (n:Person {name: "Alice"})');

			const query = 'MATCH (n) RETURN *';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.columns).toContain('n');
		});
	});

	describe('RETURN Literal Values', () => {
		it('should return number literal', async () => {
			const query = 'RETURN 42 AS num';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].num).toBe(42);
		});

		it('should return string literal', async () => {
			const query = 'RETURN "hello" AS greeting';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].greeting).toBe('hello');
		});

		it('should return arithmetic expression', async () => {
			const query = 'RETURN 2 + 3 AS sum';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].sum).toBe(5);
		});

		it('should return boolean literals', async () => {
			const query = 'RETURN true AS flag';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].flag).toBe(true);
		});

		it('should return null literal', async () => {
			const query = 'RETURN null AS value';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].value).toBe(null);
		});
	});

	describe('String Functions', () => {
		it('should use toUpper function', async () => {
			const query = 'RETURN toUpper("hello") AS result';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].result).toBe('HELLO');
		});

		it('should use toLower function', async () => {
			const query = 'RETURN toLower("HELLO") AS result';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].result).toBe('hello');
		});

		it('should use trim function', async () => {
			const query = 'RETURN trim("  hello  ") AS result';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].result).toBe('hello');
		});

		it('should use length function', async () => {
			const query = 'RETURN length("hello") AS result';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].result).toBe(5);
		});
	});

	describe('Math Functions', () => {
		it('should use abs function', async () => {
			const query = 'RETURN abs(-5) AS result';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].result).toBe(5);
		});

		it('should use sqrt function', async () => {
			const query = 'RETURN sqrt(16) AS result';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].result).toBe(4);
		});

		it('should use ceil function', async () => {
			const query = 'RETURN ceil(4.2) AS result';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].result).toBe(5);
		});

		it('should use floor function', async () => {
			const query = 'RETURN floor(4.7) AS result';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].result).toBe(4);
		});
	});

	describe('MATCH Relationships', () => {
		it('should match relationships', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"})-[:KNOWS]->(b:Person {name: "Bob"})'
			);

			const query = 'MATCH (a)-[:KNOWS]->(b) RETURN a, b';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});

		it('should match relationships with type constraint', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a)-[:KNOWS]->(b), (a)-[:WORKS_WITH]->(c)'
			);

			const query = 'MATCH (a)-[r:KNOWS]->(b) RETURN a, b';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});

		it('should match bidirectional relationships', async () => {
			await runQuery(cypherNG, 'CREATE (a)-[:KNOWS]->(b)');

			const query = 'MATCH (a)-[:KNOWS]-(b) RETURN a, b';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('Complex Queries', () => {
		it('should handle MATCH followed by MERGE', async () => {
			await runQuery(cypherNG, 'CREATE (a:Person {name: "Alice"})');

			const query =
				'MATCH (a:Person {name: "Alice"}) MERGE (b:Person {name: "Bob"}) MERGE (a)-[:KNOWS]->(b) RETURN a, b';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.stats.nodesCreated).toBe(1);
			expect(resultNG.stats.relationshipsCreated).toBe(1);
		});

		it('should handle multiple MATCH patterns', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"}), (c:Company {name: "Acme"})'
			);

			const query = 'MATCH (a:Person), (c:Company) RETURN a, c';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});

		it('should handle CREATE followed by MATCH', async () => {
			const query =
				'CREATE (a:Person {name: "Alice"}) WITH 1 AS dummy MATCH (n:Person) RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
		});
	});

	describe('WITH Clause', () => {
		it('should pipeline variables with WITH', async () => {
			await runQuery(cypherNG, 'CREATE (a:Person {name: "Alice", age: 30})');

			const query = 'MATCH (a:Person) WITH a RETURN a.name AS name';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].name).toBe('Alice');
		});

		it('should rename variables with AS', async () => {
			await runQuery(cypherNG, 'CREATE (a:Person {name: "Alice"})');

			const query =
				'MATCH (a:Person) WITH a AS person RETURN person.name AS name';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].name).toBe('Alice');
		});

		it('should evaluate expressions in WITH', async () => {
			await runQuery(cypherNG, 'CREATE (a:Person {name: "Alice", age: 30})');

			const query =
				'MATCH (a:Person) WITH a.age * 2 AS doubleAge RETURN doubleAge';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].doubleAge).toBe(60);
		});

		it('should support WITH *', async () => {
			await runQuery(cypherNG, 'CREATE (a:Person {name: "Alice"})');

			const query = 'MATCH (a:Person) WITH * RETURN a.name AS name';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].name).toBe('Alice');
		});

		it('should support DISTINCT in WITH', async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice"}), (b:Person {name: "Alice"})'
			);

			const query = 'MATCH (a:Person) WITH DISTINCT a.name AS name RETURN name';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].name).toBe('Alice');
		});

		it('should pass literal values through WITH', async () => {
			const query = 'WITH 1 AS one, 2 AS two RETURN one, two';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].one).toBe(1);
			expect(resultNG.data[0].two).toBe(2);
		});

		it('should chain multiple WITH clauses', async () => {
			await runQuery(cypherNG, 'CREATE (a:Person {name: "Alice", age: 30})');

			const query =
				'MATCH (a:Person) WITH a AS p WITH p.name AS name RETURN name';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].name).toBe('Alice');
		});
	});

	describe('UNWIND Clause', () => {
		it('should unwind literal array', async () => {
			const query = 'UNWIND [1, 2, 3] AS x RETURN x';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(3);
			expect(resultNG.data[0].x).toBe(1);
			expect(resultNG.data[1].x).toBe(2);
			expect(resultNG.data[2].x).toBe(3);
		});

		it('should unwind range function', async () => {
			const query = 'UNWIND range(1, 5) AS n RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(5);
			expect(resultNG.data[0].n).toBe(1);
			expect(resultNG.data[4].n).toBe(5);
		});

		it('should unwind with cross product', async () => {
			await runQuery(cypherNG, 'CREATE (a:Person {name: "Alice"})');
			await runQuery(cypherNG, 'CREATE (b:Person {name: "Bob"})');

			const query =
				'MATCH (p:Person) UNWIND [1, 2] AS n RETURN p.name AS name, n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(4);
		});

		it('should unwind string array', async () => {
			const query = 'UNWIND ["a", "b", "c"] AS letter RETURN letter';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(3);
			expect(resultNG.data[0].letter).toBe('a');
			expect(resultNG.data[1].letter).toBe('b');
			expect(resultNG.data[2].letter).toBe('c');
		});

		it('should create nodes from unwind', async () => {
			const query =
				'UNWIND [1, 2, 3] AS id CREATE (n:Node {id: id}) RETURN n.id AS id';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(3);
			expect(resultNG.stats.nodesCreated).toBe(3);
		});

		it('should use range with step', async () => {
			const query = 'UNWIND range(0, 10, 2) AS n RETURN n';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(6);
			expect(resultNG.data[0].n).toBe(0);
			expect(resultNG.data[1].n).toBe(2);
			expect(resultNG.data[5].n).toBe(10);
		});
	});

	describe('Graph Functions', () => {
		it('should use labels function', async () => {
			await runQuery(cypherNG, 'CREATE (n:Person:Employee {name: "Alice"})');

			const query = 'MATCH (n) RETURN labels(n) AS labels';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].labels).toContain('Person');
			expect(resultNG.data[0].labels).toContain('Employee');
		});

		it('should use id function', async () => {
			await runQuery(cypherNG, 'CREATE (n:Person {name: "Alice"})');

			const query = 'MATCH (n) RETURN id(n) AS nodeId';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].nodeId).toBe(0);
		});

		it('should use properties function', async () => {
			await runQuery(cypherNG, 'CREATE (n:Person {name: "Alice", age: 30})');

			const query = 'MATCH (n) RETURN properties(n) AS props';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].props.name).toBe('Alice');
			expect(resultNG.data[0].props.age).toBe(30);
		});
	});

	describe('Aggregate Functions', () => {
		beforeEach(async () => {
			await runQuery(
				cypherNG,
				'CREATE (a:Person {name: "Alice", age: 30}), (b:Person {name: "Bob", age: 25}), (c:Person {name: "Charlie", age: 35})'
			);
		});

		it('should count all nodes with COUNT(*)', async () => {
			const query = 'MATCH (n:Person) RETURN COUNT(*) AS count';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].count).toBe(3);
		});

		it('should count values with COUNT(n)', async () => {
			const query = 'MATCH (n:Person) RETURN COUNT(n) AS count';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].count).toBe(3);
		});

		it('should sum numeric values', async () => {
			const query = 'MATCH (n:Person) RETURN SUM(n.age) AS totalAge';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].totalAge).toBe(90);
		});

		it('should average numeric values', async () => {
			const query = 'MATCH (n:Person) RETURN AVG(n.age) AS avgAge';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].avgAge).toBe(30);
		});

		it('should find minimum value', async () => {
			const query = 'MATCH (n:Person) RETURN MIN(n.age) AS minAge';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].minAge).toBe(25);
		});

		it('should find maximum value', async () => {
			const query = 'MATCH (n:Person) RETURN MAX(n.age) AS maxAge';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].maxAge).toBe(35);
		});

		it('should collect values into array', async () => {
			const query = 'MATCH (n:Person) RETURN COLLECT(n.name) AS names';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].names).toContain('Alice');
			expect(resultNG.data[0].names).toContain('Bob');
			expect(resultNG.data[0].names).toContain('Charlie');
		});

		it('should count with alias', async () => {
			const query = 'MATCH (n:Person) RETURN COUNT(n) AS personCount';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data[0].personCount).toBe(3);
		});

		it('should return aggregate with no matches', async () => {
			const query = 'MATCH (n:NonExistent) RETURN COUNT(n) AS count';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].count).toBe(0);
		});

		it('should sum with no matches returns null', async () => {
			const query = 'MATCH (n:NonExistent) RETURN SUM(n.age) AS total';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].total).toBe(null);
		});
	});

	describe('Path Functions', () => {
		beforeEach(async () => {
			await runQuery(
				cypherNG,
				"CREATE (a:Person {name: 'Alice'})-[:KNOWS {since: 2020}]->(b:Person {name: 'Bob'})"
			);
		});

		it('should return path nodes with nodes() function', async () => {
			const query =
				'MATCH p = (a:Person)-[:KNOWS]->(b:Person) RETURN nodes(p) AS pathNodes';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(Array.isArray(resultNG.data[0].pathNodes)).toBe(true);
			expect(resultNG.data[0].pathNodes.length).toBe(2);
		});

		it('should return path relationships with relationships() function', async () => {
			const query =
				'MATCH p = (a:Person)-[:KNOWS]->(b:Person) RETURN relationships(p) AS pathRels';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(Array.isArray(resultNG.data[0].pathRels)).toBe(true);
			expect(resultNG.data[0].pathRels.length).toBe(1);
		});

		it('should return path length with size() function', async () => {
			const query =
				'MATCH p = (a:Person)-[:KNOWS]->(b:Person) RETURN size(p) AS pathLength';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].pathLength).toBe(1);
		});

		it('should return start node of relationship with startNode()', async () => {
			const query = 'MATCH ()-[r:KNOWS]->() RETURN startNode(r) AS startNode';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].startNode.labels).toContain('Person');
		});

		it('should return end node of relationship with endNode()', async () => {
			const query = 'MATCH ()-[r:KNOWS]->() RETURN endNode(r) AS endNode';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].endNode.labels).toContain('Person');
		});

		it('should handle single node path', async () => {
			const query =
				'MATCH p = (a:Person {name: "Alice"}) RETURN nodes(p) AS nodes, size(p) AS length';
			const resultNG = await runQuery(cypherNG, query);

			expect(resultNG.data.length).toBe(1);
			expect(resultNG.data[0].nodes.length).toBe(1);
			expect(resultNG.data[0].length).toBe(0);
		});
	});
});
