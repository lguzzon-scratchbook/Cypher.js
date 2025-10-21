/**
 * @description Parity tests for FilesystemAdapter
 */

const FilesystemAdapter = require("../../adapters/FilesystemAdapter");
const { runParityTests } = require("../parity");
const fs = require("node:fs").promises;
const path = require("node:path");

async function testFilesystemAdapter() {
	const testDir = path.join(__dirname, "../../test-data-fs");

	try {
		// Clean up before starting
		await fs.rm(testDir, { recursive: true, force: true });

		// Test 1: Parity tests
		const adapter = new FilesystemAdapter(testDir);
		const results = await runParityTests(adapter, "FilesystemAdapter");

		if (results.failed !== 0) {
			console.log("✗ Parity tests failed");
			process.exit(1);
		}

		// Test 2: Persistence - create fresh data and verify reload
		console.log("=== Testing Persistence ===\n");

		await fs.rm(testDir, { recursive: true, force: true });
		const adapter2 = new FilesystemAdapter(testDir);
		await adapter2.connect({});

		// Create test data
		const n1 = await adapter2.createNode({
			labels: ["Person"],
			properties: { name: "Alice" },
		});
		const n2 = await adapter2.createNode({
			labels: ["Person"],
			properties: { name: "Bob" },
		});
		const rel = await adapter2.createRelationship({
			type: "KNOWS",
			fromNodeId: n1.id,
			toNodeId: n2.id,
			properties: { since: 2020 },
		});

		await adapter2.disconnect();

		// Reload from disk
		const adapter3 = new FilesystemAdapter(testDir);
		await adapter3.connect({});

		const nodes = await adapter3.getAllNodes();
		const rels = await adapter3.getAllRelationships();

		console.log(
			`✓ Data persisted: ${nodes.length} nodes, ${rels.length} relationships`,
		);

		const persistedNode = await adapter3.getNodeById(n1.id);
		const persistedRel = await adapter3.getRelationshipById(rel.id);

		if (!persistedNode || !persistedRel) {
			console.log("✗ Persistence test failed: Data not found after reload");
			process.exit(1);
		}

		if (persistedNode.properties.get("name") !== "Alice") {
			console.log("✗ Persistence test failed: Node properties not persisted");
			process.exit(1);
		}

		console.log("✓ Node properties persisted correctly");
		console.log("✓ Relationships persisted correctly");

		await adapter3.disconnect();

		// Cleanup
		await fs.rm(testDir, { recursive: true, force: true });

		console.log("\n✅ All FilesystemAdapter tests passed!");
		process.exit(0);
	} catch (error) {
		console.error("Test error:", error);
		process.exit(1);
	}
}

testFilesystemAdapter();
