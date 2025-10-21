/**
 * @description Query execution tests for CypherNG with all adapters
 */

const CypherNG = require("../CypherNG");
const InMemoryAdapter = require("../adapters/InMemoryAdapter");

async function testQueryExecution() {
	console.log("\n=== Query Execution Tests ===\n");

	const adapter = new InMemoryAdapter();
	const cypher = new CypherNG(adapter);

	let passed = 0;
	let failed = 0;

	const test = async (name, fn) => {
		try {
			await fn();
			console.log(`✓ ${name}`);
			passed++;
		} catch (error) {
			console.error(`✗ ${name}: ${error.message}`);
			failed++;
		}
	};

	try {
		await cypher.connect({});

		// Test 1: Create and retrieve data via queries
		await test("Create data and retrieve via adapter", async () => {
			const n1 = await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Alice", age: 30 },
			});
			const n2 = await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Bob", age: 25 },
			});
			const _rel = await adapter.createRelationship({
				type: "KNOWS",
				fromNodeId: n1.id,
				toNodeId: n2.id,
				properties: { since: 2020 },
			});

			const retrieved = await cypher.getNode(n1.id);
			if (!retrieved || retrieved.properties.get("name") !== "Alice") {
				throw new Error("Node retrieval failed");
			}
		});

		// Test 2: Get all nodes
		await test("Get all nodes", async () => {
			const nodes = await cypher.getAllNodes();
			if (nodes.length < 2) {
				throw new Error("Not enough nodes retrieved");
			}
		});

		// Test 3: Get all relationships
		await test("Get all relationships", async () => {
			const rels = await cypher.getAllRelationships();
			if (rels.length < 1) {
				throw new Error("No relationships retrieved");
			}
		});

		// Test 4: Get nodes by label
		await test("Get nodes by label", async () => {
			const people = await cypher.getNodesByLabel("Person");
			if (people.length !== 2) {
				throw new Error(`Expected 2 Person nodes, got ${people.length}`);
			}
		});

		// Test 5: Get nodes by property
		await test("Get nodes by property", async () => {
			const alice = await cypher.getNodesByProperty("name", "Alice");
			if (alice.length !== 1) {
				throw new Error("Property lookup failed");
			}
		});

		// Test 6: Direct query execution (if Cypher engine available)
		await test("Direct query execution", async () => {
			return new Promise((resolve, reject) => {
				cypher.execute(
					"MATCH (n:Person) RETURN n",
					(results) => {
						if (!results || !results.output) {
							reject(new Error("Query returned no results"));
						} else {
							resolve();
						}
					},
					(error) => {
						reject(error);
					},
				);
			});
		});

		// Test 7: Query with filters (basic execution)
		await test("Query with filters", async () => {
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("Query with filters timed out"));
				}, 5000);

				cypher.execute(
					"MATCH (n:Person) RETURN n LIMIT 1",
					(results) => {
						clearTimeout(timeout);
						if (!results) {
							reject(new Error("Query returned null"));
						} else {
							resolve();
						}
					},
					(error) => {
						clearTimeout(timeout);
						reject(error);
					},
				);
			});
		});

		// Test 8: Query relationships
		await test("Query relationships", async () => {
			return new Promise((resolve, reject) => {
				cypher.execute(
					"MATCH (n)-[r:KNOWS]->(m) RETURN n, r, m",
					(results) => {
						if (!results) {
							reject(new Error("Relationship query returned no results"));
						} else {
							resolve();
						}
					},
					(error) => {
						reject(error);
					},
				);
			});
		});

		// Test 9: Clear and verify
		await test("Clear data", async () => {
			await cypher.resetDatabase();
			const nodes = await cypher.getAllNodes();
			const rels = await cypher.getAllRelationships();

			if (nodes.length > 0 || rels.length > 0) {
				throw new Error("Data not cleared");
			}
		});

		await cypher.disconnect();

		console.log(`\n✅ Query Execution: ${passed} passed, ${failed} failed\n`);
		process.exit(failed === 0 ? 0 : 1);
	} catch (error) {
		console.error("Fatal error:", error.message);
		process.exit(1);
	}
}

testQueryExecution();
