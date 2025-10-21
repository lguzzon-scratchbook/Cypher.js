/**
 * @description Comprehensive tests for RedisAdapter
 * Requires Redis server running on localhost:6379
 * 
 * Test Coverage:
 * - Parity tests (DataAdapter interface compliance)
 * - Connection management
 * - Error handling and reconnection
 * - Concurrent operations
 * - Index operations
 * - Performance with larger datasets
 */

const { runParityTests } = require("../parity");

async function testRedisAdapter() {
	let RedisAdapter;
	try {
		RedisAdapter = require("../../adapters/RedisAdapter");
	} catch (_error) {
		console.log("\n⚠️  Redis module not installed. Run: npm install redis");
		console.log("Skipping RedisAdapter tests.\n");
		process.exit(0);
	}

	let adapter = null;

	try {
		console.log("Attempting to connect to Redis on localhost:6379...\n");

		adapter = new RedisAdapter({
			host: "localhost",
			port: 6379,
			socket: { reconnectStrategy: () => null },
		});

		try {
			await adapter.connect({ clearOnConnect: true });
		} catch (error) {
			console.log("\n⚠️  Redis server not available");
			console.log("Error:", error.message);
			console.log("\nTo run Redis tests:");
			console.log("  1. Install Redis: https://redis.io/download");
			console.log("  2. Start Redis server: redis-server");
			console.log("  3. Or use the manager: npm run redis:start\n");
			process.exit(0);
		}

		console.log("✓ Connected to Redis successfully\n");

		// Run parity tests
		console.log("=".repeat(50));
		console.log("Running Parity Tests (DataAdapter Interface)");
		console.log("=".repeat(50));
		const parityResults = await runParityTests(adapter, "RedisAdapter");

		if (parityResults.failed > 0) {
			console.log("\n✗ Parity tests failed");
			process.exit(1);
		}

		// Reconnect for Redis-specific tests (parity tests disconnect)
		await adapter.connect({ clearOnConnect: false });

		// Run Redis-specific tests
		console.log("\n" + "=".repeat(50));
		console.log("Running Redis-Specific Tests");
		console.log("=".repeat(50) + "\n");

		await runRedisSpecificTests(adapter);

		// Cleanup
		await adapter.clear();
		await adapter.disconnect();

		console.log("\n✅ All RedisAdapter tests passed!");
		process.exit(0);
	} catch (error) {
		console.error("\n✗ Test error:", error.message);
		console.error(error.stack);
		
		// Cleanup on error
		if (adapter) {
			try {
				await adapter.disconnect();
			} catch (e) {
				// Ignore cleanup errors
			}
		}
		
		process.exit(1);
	}
}

/**
 * Redis-specific test scenarios
 */
async function runRedisSpecificTests(adapter) {
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

	// Test 1: Connection state
	await test("Connection state management", async () => {
		if (!adapter.connected) {
			throw new Error("Adapter should be connected");
		}
	});

	// Test 2: Clear and verify empty state
	await test("Clear operation leaves database empty", async () => {
		await adapter.clear();
		const nodes = await adapter.getAllNodes();
		const rels = await adapter.getAllRelationships();
		if (nodes.length !== 0 || rels.length !== 0) {
			throw new Error("Database not empty after clear");
		}
	});

	// Test 3: Multiple label indexes
	await test("Multiple label indexes", async () => {
		await adapter.clear();
		const n1 = await adapter.createNode({
			labels: ["Person", "Employee"],
			properties: { name: "Alice" },
		});
		await adapter.addNodeLabel(n1.id, "Manager");

		const people = await adapter.getNodesByLabel("Person");
		const employees = await adapter.getNodesByLabel("Employee");
		const managers = await adapter.getNodesByLabel("Manager");

		if (people.length !== 1 || employees.length !== 1 || managers.length !== 1) {
			throw new Error("Label indexes not working correctly");
		}
	});

	// Test 4: Relationship type indexes
	await test("Relationship type indexes", async () => {
		await adapter.clear();
		const n1 = await adapter.createNode({ labels: ["A"], properties: {} });
		const n2 = await adapter.createNode({ labels: ["B"], properties: {} });
		const n3 = await adapter.createNode({ labels: ["C"], properties: {} });

		await adapter.createRelationship({
			type: "KNOWS",
			fromNodeId: n1.id,
			toNodeId: n2.id,
			properties: {},
		});
		await adapter.createRelationship({
			type: "LIKES",
			fromNodeId: n2.id,
			toNodeId: n3.id,
			properties: {},
		});
		await adapter.createRelationship({
			type: "KNOWS",
			fromNodeId: n3.id,
			toNodeId: n1.id,
			properties: {},
		});

		const knows = await adapter.getRelationshipsByType("KNOWS");
		const likes = await adapter.getRelationshipsByType("LIKES");

		if (knows.length !== 2 || likes.length !== 1) {
			throw new Error("Relationship type indexes incorrect");
		}
	});

	// Test 5: Adjacency indexes
	await test("Adjacency indexes (relationships between nodes)", async () => {
		await adapter.clear();
		const n1 = await adapter.createNode({ labels: ["A"], properties: {} });
		const n2 = await adapter.createNode({ labels: ["B"], properties: {} });

		await adapter.createRelationship({
			type: "KNOWS",
			fromNodeId: n1.id,
			toNodeId: n2.id,
			properties: {},
		});
		await adapter.createRelationship({
			type: "LIKES",
			fromNodeId: n1.id,
			toNodeId: n2.id,
			properties: {},
		});

		const rels = await adapter.getRelationshipsBetween(n1.id, n2.id);
		if (rels.length !== 2) {
			throw new Error(`Expected 2 relationships, got ${rels.length}`);
		}
	});

	// Test 6: Property value types
	await test("Property value types (string, number, boolean)", async () => {
		await adapter.clear();
		const node = await adapter.createNode({
			labels: ["Test"],
			properties: {
				str: "hello",
				num: 42,
				bool: true,
				float: 3.14,
			},
		});

		const fetched = await adapter.getNodeById(node.id);
		if (
			fetched.properties.get("str") !== "hello" ||
			fetched.properties.get("num") !== 42 ||
			fetched.properties.get("bool") !== true ||
			fetched.properties.get("float") !== 3.14
		) {
			throw new Error("Property types not preserved");
		}
	});

	// Test 7: Concurrent node creation
	await test("Concurrent node creation (unique IDs)", async () => {
		await adapter.clear();
		const promises = [];
		for (let i = 0; i < 10; i++) {
			promises.push(
				adapter.createNode({ labels: ["Test"], properties: { index: i } }),
			);
		}

		const nodes = await Promise.all(promises);
		const ids = new Set(nodes.map((n) => n.id));

		if (ids.size !== 10) {
			throw new Error("Duplicate IDs generated in concurrent creation");
		}
	});

	// Test 8: Concurrent relationship creation
	await test("Concurrent relationship creation", async () => {
		await adapter.clear();
		const n1 = await adapter.createNode({ labels: ["A"], properties: {} });
		const n2 = await adapter.createNode({ labels: ["B"], properties: {} });

		const promises = [];
		for (let i = 0; i < 10; i++) {
			promises.push(
				adapter.createRelationship({
					type: "TEST",
					fromNodeId: n1.id,
					toNodeId: n2.id,
					properties: { index: i },
				}),
			);
		}

		const rels = await Promise.all(promises);
		const ids = new Set(rels.map((r) => r.id));

		if (ids.size !== 10) {
			throw new Error("Duplicate relationship IDs generated");
		}
	});

	// Test 9: Large property object
	await test("Large property object", async () => {
		await adapter.clear();
		const largeProps = {};
		for (let i = 0; i < 100; i++) {
			largeProps[`key${i}`] = `value${i}`;
		}

		const node = await adapter.createNode({
			labels: ["Test"],
			properties: largeProps,
		});

		const fetched = await adapter.getNodeById(node.id);
		if (fetched.properties.size !== 100) {
			throw new Error("Large property object not stored correctly");
		}
	});

	// Test 10: Delete node with many relationships
	await test("Delete node with many relationships (cascade)", async () => {
		await adapter.clear();
		const center = await adapter.createNode({ labels: ["Center"], properties: {} });
		const nodes = [];

		for (let i = 0; i < 20; i++) {
			const n = await adapter.createNode({ labels: ["Outer"], properties: {} });
			nodes.push(n);
			await adapter.createRelationship({
				type: "CONNECTED",
				fromNodeId: center.id,
				toNodeId: n.id,
				properties: {},
			});
		}

		await adapter.deleteNode(center.id);

		const remaining = await adapter.getAllRelationships();
		if (remaining.length !== 0) {
			throw new Error("Relationships not deleted with node");
		}
	});

	// Test 11: Next ID sequence
	await test("ID sequence consistency", async () => {
		await adapter.clear();
		const n1 = await adapter.createNode({ labels: ["Test"], properties: {} });
		const n2 = await adapter.createNode({ labels: ["Test"], properties: {} });

		if (n2.id <= n1.id) {
			throw new Error("ID sequence not incrementing");
		}

		const nextId = await adapter.getNextNodeId();
		if (nextId <= n2.id) {
			throw new Error("getNextNodeId not consistent");
		}
	});

	// Test 12: Empty labels array
	await test("Node with empty labels array", async () => {
		await adapter.clear();
		const node = await adapter.createNode({
			labels: [],
			properties: { name: "test" },
		});

		const fetched = await adapter.getNodeById(node.id);
		if (!fetched || fetched.labels.length !== 0) {
			throw new Error("Empty labels not handled correctly");
		}
	});

	// Test 13: Empty properties
	await test("Node with empty properties", async () => {
		await adapter.clear();
		const node = await adapter.createNode({
			labels: ["Test"],
			properties: {},
		});

		const fetched = await adapter.getNodeById(node.id);
		if (!fetched || fetched.properties.size !== 0) {
			throw new Error("Empty properties not handled correctly");
		}
	});

	// Test 14: Update with new properties (merge behavior)
	await test("Update properties merges with existing", async () => {
		await adapter.clear();
		const node = await adapter.createNode({
			labels: ["Test"],
			properties: { a: 1, b: 2 },
		});

		await adapter.updateNodeProperties(node.id, { b: 20, c: 3 });

		const updated = await adapter.getNodeById(node.id);
		if (
			updated.properties.get("a") !== 1 ||
			updated.properties.get("b") !== 20 ||
			updated.properties.get("c") !== 3
		) {
			throw new Error("Properties not merged correctly");
		}
	});

	// Test 15: Stress test - moderate dataset
	await test("Stress test - 100 nodes and 200 relationships", async () => {
		await adapter.clear();
		const nodes = [];

		// Create 100 nodes
		for (let i = 0; i < 100; i++) {
			const n = await adapter.createNode({
				labels: ["TestNode"],
				properties: { index: i },
			});
			nodes.push(n);
		}

		// Create 200 relationships
		for (let i = 0; i < 200; i++) {
			const from = nodes[Math.floor(Math.random() * nodes.length)];
			const to = nodes[Math.floor(Math.random() * nodes.length)];
			await adapter.createRelationship({
				type: "CONNECTED",
				fromNodeId: from.id,
				toNodeId: to.id,
				properties: { weight: Math.random() },
			});
		}

		const allNodes = await adapter.getAllNodes();
		const allRels = await adapter.getAllRelationships();

		if (allNodes.length !== 100 || allRels.length !== 200) {
			throw new Error(
				`Expected 100 nodes and 200 rels, got ${allNodes.length} and ${allRels.length}`,
			);
		}
	});

	console.log(`\n✅ Redis-specific tests: ${passed} passed, ${failed} failed\n`);

	if (failed > 0) {
		throw new Error(`${failed} Redis-specific tests failed`);
	}
}

testRedisAdapter();
