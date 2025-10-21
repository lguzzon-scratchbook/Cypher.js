/**
 * @description Parity tests for GunDBAdapter
 * Includes real-time subscription tests
 */

const { runParityTests } = require("./parity");

async function testGunDBAdapter() {
	let GunDBAdapter;
	try {
		GunDBAdapter = require("../adapters/GunDBAdapter");
	} catch (_error) {
		console.log("\n⚠️  Gun module not installed. Run: npm install gun");
		console.log("Skipping GunDBAdapter tests.\n");
		process.exit(0);
	}

	try {
		console.log("Testing GunDBAdapter with in-process storage...\n");

		// Test 1: Parity tests
		const adapter = new GunDBAdapter();
		await adapter.connect({});

		const results = await runParityTests(adapter, "GunDBAdapter");

		if (results.failed !== 0) {
			console.log("✗ Parity tests failed");
			process.exit(1);
		}

		// Test 2: Subscriptions (GunDB specific feature)
		console.log("=== Testing Subscriptions ===\n");

		const adapter2 = new GunDBAdapter();
		await adapter2.connect({});

		let _eventCount = 0;
		const events = [];

		const unsub = adapter2.subscribe((event, _data) => {
			_eventCount++;
			events.push(event);
		});

		// Create node
		const node = await adapter2.createNode({
			labels: ["Test"],
			properties: { x: 1 },
		});
		if (events[events.length - 1] !== "nodeCreated") {
			throw new Error("nodeCreated event not fired");
		}
		console.log("✓ nodeCreated event fired");

		// Create relationship
		const node2 = await adapter2.createNode({
			labels: ["Test"],
			properties: {},
		});
		const rel = await adapter2.createRelationship({
			type: "TEST",
			fromNodeId: node.id,
			toNodeId: node2.id,
			properties: {},
		});
		if (events[events.length - 1] !== "relationshipCreated") {
			throw new Error("relationshipCreated event not fired");
		}
		console.log("✓ relationshipCreated event fired");

		// Update node
		await adapter2.updateNodeProperties(node.id, { x: 2 });
		if (events[events.length - 1] !== "nodeUpdated") {
			throw new Error("nodeUpdated event not fired");
		}
		console.log("✓ nodeUpdated event fired");

		// Add label
		await adapter2.addNodeLabel(node.id, "Tagged");
		if (events[events.length - 1] !== "labelAdded") {
			throw new Error("labelAdded event not fired");
		}
		console.log("✓ labelAdded event fired");

		// Delete relationship
		await adapter2.deleteRelationship(rel.id);
		if (events[events.length - 1] !== "relationshipDeleted") {
			throw new Error("relationshipDeleted event not fired");
		}
		console.log("✓ relationshipDeleted event fired");

		// Delete node
		await adapter2.deleteNode(node.id);
		if (events[events.length - 1] !== "nodeDeleted") {
			throw new Error("nodeDeleted event not fired");
		}
		console.log("✓ nodeDeleted event fired");

		// Test unsubscribe
		unsub();
		const eventCountBefore = events.length;
		await adapter2.createNode({ labels: ["A"], properties: {} });
		if (events.length > eventCountBefore) {
			throw new Error("Events still being received after unsubscribe");
		}
		console.log("✓ Unsubscribe works correctly");

		await adapter2.disconnect();

		console.log("\n✅ All GunDBAdapter tests passed!");
		process.exit(0);
	} catch (error) {
		console.error("Test error:", error.message);
		process.exit(1);
	}
}

testGunDBAdapter();
