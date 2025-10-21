/**
 * @description Shared parity test suite for all adapters
 * Ensures all adapters pass the same functional tests
 */

async function runParityTests(adapter, adapterName) {
	console.log(`\n=== Parity Tests: ${adapterName} ===\n`);

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
		await adapter.connect({});

		// Test 1: Create nodes
		await test("Create nodes", async () => {
			const node1 = await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Alice", age: 30 },
			});
			if (!node1.id && node1.id !== 0) throw new Error("Node has no id");
			if (!node1.labels.includes("Person")) throw new Error("Label not set");
		});

		// Test 2: Get node by ID
		await test("Get node by ID", async () => {
			const node = await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Bob" },
			});
			const fetched = await adapter.getNodeById(node.id);
			if (!fetched) throw new Error("Node not found");
			if (fetched.properties.get("name") !== "Bob")
				throw new Error("Properties mismatch");
		});

		// Test 3: Get nodes by label
		await test("Get nodes by label", async () => {
			await adapter.clear();
			await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Alice" },
			});
			await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Bob" },
			});
			await adapter.createNode({
				labels: ["Company"],
				properties: { name: "Acme" },
			});

			const people = await adapter.getNodesByLabel("Person");
			if (people.length !== 2)
				throw new Error(`Expected 2 people, got ${people.length}`);
		});

		// Test 4: Get nodes by property
		await test("Get nodes by property", async () => {
			await adapter.clear();
			await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Alice", age: 30 },
			});
			await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Bob", age: 25 },
			});

			const result = await adapter.getNodesByProperty("name", "Alice");
			if (result.length !== 1) throw new Error("Property lookup failed");
			if (result[0].properties.get("name") !== "Alice")
				throw new Error("Property mismatch");
		});

		// Test 5: Create relationships
		await test("Create relationships", async () => {
			await adapter.clear();
			const n1 = await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Alice" },
			});
			const n2 = await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Bob" },
			});

			const rel = await adapter.createRelationship({
				type: "KNOWS",
				fromNodeId: n1.id,
				toNodeId: n2.id,
				properties: { since: 2020 },
			});

			if (!rel.id && rel.id !== 0) throw new Error("Relationship has no id");
			if (rel.type !== "KNOWS") throw new Error("Type mismatch");
		});

		// Test 6: Get relationship by ID
		await test("Get relationship by ID", async () => {
			await adapter.clear();
			const n1 = await adapter.createNode({ labels: ["A"], properties: {} });
			const n2 = await adapter.createNode({ labels: ["B"], properties: {} });
			const rel = await adapter.createRelationship({
				type: "TEST",
				fromNodeId: n1.id,
				toNodeId: n2.id,
				properties: {},
			});

			const fetched = await adapter.getRelationshipById(rel.id);
			if (!fetched) throw new Error("Relationship not found");
			if (fetched.type !== "TEST") throw new Error("Type mismatch");
		});

		// Test 7: Get relationships by type
		await test("Get relationships by type", async () => {
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
				type: "KNOWS",
				fromNodeId: n2.id,
				toNodeId: n3.id,
				properties: {},
			});
			await adapter.createRelationship({
				type: "WORKS_WITH",
				fromNodeId: n1.id,
				toNodeId: n3.id,
				properties: {},
			});

			const knows = await adapter.getRelationshipsByType("KNOWS");
			if (knows.length !== 2)
				throw new Error(`Expected 2 KNOWS, got ${knows.length}`);

			const works = await adapter.getRelationshipsByType("WORKS_WITH");
			if (works.length !== 1)
				throw new Error(`Expected 1 WORKS_WITH, got ${works.length}`);
		});

		// Test 8: Get relationships between nodes
		await test("Get relationships between nodes", async () => {
			await adapter.clear();
			const n1 = await adapter.createNode({ labels: ["A"], properties: {} });
			const n2 = await adapter.createNode({ labels: ["B"], properties: {} });

			await adapter.createRelationship({
				type: "KNOWS",
				fromNodeId: n1.id,
				toNodeId: n2.id,
				properties: {},
			});

			const rels = await adapter.getRelationshipsBetween(n1.id, n2.id);
			if (rels.length !== 1)
				throw new Error(`Expected 1 relationship, got ${rels.length}`);
		});

		// Test 9: Get outgoing relationships
		await test("Get outgoing relationships", async () => {
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
				type: "KNOWS",
				fromNodeId: n1.id,
				toNodeId: n3.id,
				properties: {},
			});

			const outgoing = await adapter.getOutgoingRelationships(n1.id);
			if (outgoing.length !== 2)
				throw new Error(`Expected 2 outgoing, got ${outgoing.length}`);
		});

		// Test 10: Get incoming relationships
		await test("Get incoming relationships", async () => {
			await adapter.clear();
			const n1 = await adapter.createNode({ labels: ["A"], properties: {} });
			const n2 = await adapter.createNode({ labels: ["B"], properties: {} });
			const n3 = await adapter.createNode({ labels: ["C"], properties: {} });

			await adapter.createRelationship({
				type: "KNOWS",
				fromNodeId: n1.id,
				toNodeId: n3.id,
				properties: {},
			});
			await adapter.createRelationship({
				type: "KNOWS",
				fromNodeId: n2.id,
				toNodeId: n3.id,
				properties: {},
			});

			const incoming = await adapter.getIncomingRelationships(n3.id);
			if (incoming.length !== 2)
				throw new Error(`Expected 2 incoming, got ${incoming.length}`);
		});

		// Test 11: Add node label
		await test("Add node label", async () => {
			await adapter.clear();
			const node = await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Alice" },
			});
			await adapter.addNodeLabel(node.id, "Employee");

			const updated = await adapter.getNodeById(node.id);
			const labels = Array.isArray(updated.labels)
				? updated.labels
				: Array.from(updated.labels);
			if (!labels.includes("Employee")) throw new Error("Label not added");
		});

		// Test 12: Update node properties
		await test("Update node properties", async () => {
			await adapter.clear();
			const node = await adapter.createNode({
				labels: ["Person"],
				properties: { name: "Alice", age: 30 },
			});
			await adapter.updateNodeProperties(node.id, { age: 31 });

			const updated = await adapter.getNodeById(node.id);
			if (updated.properties.get("age") !== 31)
				throw new Error("Property not updated");
		});

		// Test 13: Update relationship properties
		await test("Update relationship properties", async () => {
			await adapter.clear();
			const n1 = await adapter.createNode({ labels: ["A"], properties: {} });
			const n2 = await adapter.createNode({ labels: ["B"], properties: {} });
			const rel = await adapter.createRelationship({
				type: "KNOWS",
				fromNodeId: n1.id,
				toNodeId: n2.id,
				properties: { since: 2020 },
			});

			await adapter.updateRelationshipProperties(rel.id, { since: 2021 });
			const updated = await adapter.getRelationshipById(rel.id);
			if (updated.properties.get("since") !== 2021)
				throw new Error("Property not updated");
		});

		// Test 14: Delete relationship
		await test("Delete relationship", async () => {
			await adapter.clear();
			const n1 = await adapter.createNode({ labels: ["A"], properties: {} });
			const n2 = await adapter.createNode({ labels: ["B"], properties: {} });
			const rel = await adapter.createRelationship({
				type: "KNOWS",
				fromNodeId: n1.id,
				toNodeId: n2.id,
				properties: {},
			});

			await adapter.deleteRelationship(rel.id);
			const deleted = await adapter.getRelationshipById(rel.id);
			if (deleted) throw new Error("Relationship not deleted");
		});

		// Test 15: Delete node (cascade)
		await test("Delete node (cascade)", async () => {
			await adapter.clear();
			const n1 = await adapter.createNode({ labels: ["A"], properties: {} });
			const n2 = await adapter.createNode({ labels: ["B"], properties: {} });
			const rel = await adapter.createRelationship({
				type: "KNOWS",
				fromNodeId: n1.id,
				toNodeId: n2.id,
				properties: {},
			});

			await adapter.deleteNode(n1.id);
			const deletedNode = await adapter.getNodeById(n1.id);
			const deletedRel = await adapter.getRelationshipById(rel.id);

			if (deletedNode) throw new Error("Node not deleted");
			if (deletedRel) throw new Error("Connected relationship not deleted");
		});

		// Test 16: Get all nodes
		await test("Get all nodes", async () => {
			await adapter.clear();
			await adapter.createNode({ labels: ["A"], properties: {} });
			await adapter.createNode({ labels: ["B"], properties: {} });
			await adapter.createNode({ labels: ["C"], properties: {} });

			const all = await adapter.getAllNodes();
			if (all.length !== 3)
				throw new Error(`Expected 3 nodes, got ${all.length}`);
		});

		// Test 17: Get all relationships
		await test("Get all relationships", async () => {
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
				type: "KNOWS",
				fromNodeId: n2.id,
				toNodeId: n3.id,
				properties: {},
			});

			const all = await adapter.getAllRelationships();
			if (all.length !== 2)
				throw new Error(`Expected 2 relationships, got ${all.length}`);
		});

		// Test 18: Clear all data
		await test("Clear all data", async () => {
			await adapter.clear();
			await adapter.createNode({ labels: ["A"], properties: {} });
			await adapter.createNode({ labels: ["B"], properties: {} });

			const allBefore = await adapter.getAllNodes();
			if (allBefore.length !== 2) throw new Error("Setup failed");

			await adapter.clear();
			const allAfter = await adapter.getAllNodes();
			if (allAfter.length !== 0) throw new Error("Clear failed");
		});

		await adapter.disconnect();

		console.log(`\n✅ ${adapterName}: ${passed} passed, ${failed} failed\n`);
		return { passed, failed };
	} catch (error) {
		console.error(`Fatal error: ${error.message}`);
		return { passed, failed: -1 };
	}
}

module.exports = { runParityTests };
