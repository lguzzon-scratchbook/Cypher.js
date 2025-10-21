/**
 * @description Extended tests for InMemoryAdapter
 * Tests advanced scenarios beyond basic parity tests
 */

const { runParityTests } = require("../parity");
const InMemoryAdapter = require("../../adapters/InMemoryAdapter");

async function testInMemoryAdapter() {
	console.log("\n=== Extended InMemoryAdapter Tests ===\n");

	const adapter = new InMemoryAdapter();

	try {
		await adapter.connect({});

		// Run parity tests
		console.log("=".repeat(50));
		console.log("Running Parity Tests");
		console.log("=".repeat(50));
		const parityResults = await runParityTests(adapter, "InMemoryAdapter");

		if (parityResults.failed > 0) {
			console.log("\n✗ Parity tests failed");
			process.exit(1);
		}

		// Run extended tests
		console.log("\n" + "=".repeat(50));
		console.log("Running Extended Tests");
		console.log("=".repeat(50) + "\n");

		await runExtendedTests(adapter);

		await adapter.disconnect();
		console.log("\n✅ All InMemoryAdapter tests passed!");
		process.exit(0);
	} catch (error) {
		console.error("\n✗ Test error:", error.message);
		process.exit(1);
	}
}

async function runExtendedTests(adapter) {
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

	// Test 1: Memory isolation between instances
	await test("Multiple adapter instances are isolated", async () => {
		const adapter1 = new InMemoryAdapter();
		const adapter2 = new InMemoryAdapter();
		await adapter1.connect({});
		await adapter2.connect({});

		await adapter1.createNode({ labels: ["Test"], properties: { id: 1 } });
		const nodes1 = await adapter1.getAllNodes();
		const nodes2 = await adapter2.getAllNodes();

		await adapter1.disconnect();
		await adapter2.disconnect();

		if (nodes1.length !== 1 || nodes2.length !== 0) {
			throw new Error("Adapters not isolated");
		}
	});

	// Test 2: Performance - large dataset
	await test("Performance - 1000 nodes in memory", async () => {
		await adapter.clear();
		const start = Date.now();

		for (let i = 0; i < 1000; i++) {
			await adapter.createNode({
				labels: ["Test"],
				properties: { index: i },
			});
		}

		const duration = Date.now() - start;
		const nodes = await adapter.getAllNodes();

		if (nodes.length !== 1000) {
			throw new Error("Not all nodes created");
		}

		console.log(`    → Created 1000 nodes in ${duration}ms`);
	});

	// Test 3: Complex graph traversal setup
	await test("Complex graph structure", async () => {
		await adapter.clear();

		// Create a small social network
		const alice = await adapter.createNode({
			labels: ["Person"],
			properties: { name: "Alice" },
		});
		const bob = await adapter.createNode({
			labels: ["Person"],
			properties: { name: "Bob" },
		});
		const charlie = await adapter.createNode({
			labels: ["Person"],
			properties: { name: "Charlie" },
		});
		const diana = await adapter.createNode({
			labels: ["Person"],
			properties: { name: "Diana" },
		});

		// Create relationships
		await adapter.createRelationship({
			type: "KNOWS",
			fromNodeId: alice.id,
			toNodeId: bob.id,
			properties: { since: 2020 },
		});
		await adapter.createRelationship({
			type: "KNOWS",
			fromNodeId: bob.id,
			toNodeId: charlie.id,
			properties: { since: 2021 },
		});
		await adapter.createRelationship({
			type: "KNOWS",
			fromNodeId: charlie.id,
			toNodeId: diana.id,
			properties: { since: 2022 },
		});
		await adapter.createRelationship({
			type: "LIKES",
			fromNodeId: alice.id,
			toNodeId: diana.id,
			properties: {},
		});

		// Verify structure
		const aliceOutgoing = await adapter.getOutgoingRelationships(alice.id);
		const dianaIncoming = await adapter.getIncomingRelationships(diana.id);

		if (aliceOutgoing.length !== 2 || dianaIncoming.length !== 2) {
			throw new Error("Graph structure incorrect");
		}
	});

	// Test 4: Duplicate label handling
	await test("Duplicate label handling", async () => {
		await adapter.clear();
		const node = await adapter.createNode({
			labels: ["Person"],
			properties: { name: "Test" },
		});

		// Try adding same label twice
		await adapter.addNodeLabel(node.id, "Employee");
		await adapter.addNodeLabel(node.id, "Employee");

		const updated = await adapter.getNodeById(node.id);
		const labels = Array.isArray(updated.labels) ? updated.labels : Array.from(updated.labels);
		const labelCount = labels.filter((l) => l === "Employee").length;

		if (labelCount !== 1) {
			throw new Error("Duplicate labels not prevented");
		}
	});

	// Test 5: Clear doesn't affect other instances
	await test("Clear operation is instance-specific", async () => {
		const adapter1 = new InMemoryAdapter();
		const adapter2 = new InMemoryAdapter();
		await adapter1.connect({});
		await adapter2.connect({});

		await adapter1.createNode({ labels: ["Test"], properties: {} });
		await adapter2.createNode({ labels: ["Test"], properties: {} });

		await adapter1.clear();

		const nodes1 = await adapter1.getAllNodes();
		const nodes2 = await adapter2.getAllNodes();

		await adapter1.disconnect();
		await adapter2.disconnect();

		if (nodes1.length !== 0 || nodes2.length !== 1) {
			throw new Error("Clear affected wrong instance");
		}
	});

	console.log(`\n✅ Extended tests: ${passed} passed, ${failed} failed\n`);

	if (failed > 0) {
		throw new Error(`${failed} extended tests failed`);
	}
}

testInMemoryAdapter();
