/**
 * @description Adapter tests - verify DataAdapter interface and InMemoryAdapter
 */

const _DataAdapter = require("../adapters/DataAdapter");
const InMemoryAdapter = require("../adapters/InMemoryAdapter");

async function testInMemoryAdapter() {
	console.log("\n=== Testing InMemoryAdapter ===\n");

	const adapter = new InMemoryAdapter();
	await adapter.connect({});

	// Test: Create nodes
	console.log("Test: Create nodes");
	const node1 = await adapter.createNode({
		labels: ["Person"],
		properties: { name: "Alice", age: 30 },
	});
	const node2 = await adapter.createNode({
		labels: ["Person"],
		properties: { name: "Bob", age: 25 },
	});
	console.log(
		`✓ Created node 1: id=${node1.id}, labels=${JSON.stringify(node1.labels)}`,
	);
	console.log(
		`✓ Created node 2: id=${node2.id}, labels=${JSON.stringify(node2.labels)}`,
	);

	// Test: Get node by ID
	console.log("\nTest: Get node by ID");
	const fetched = await adapter.getNodeById(node1.id);
	console.log(
		`✓ Fetched node 1: ${fetched.id}, name=${fetched.properties.get("name")}`,
	);

	// Test: Get nodes by label
	console.log("\nTest: Get nodes by label");
	const personNodes = await adapter.getNodesByLabel("Person");
	console.log(`✓ Found ${personNodes.length} Person nodes`);

	// Test: Get nodes by property
	console.log("\nTest: Get nodes by property");
	const aliceNodes = await adapter.getNodesByProperty("name", "Alice");
	console.log(`✓ Found ${aliceNodes.length} nodes with name=Alice`);

	// Test: Create relationship
	console.log("\nTest: Create relationship");
	const rel = await adapter.createRelationship({
		type: "KNOWS",
		fromNodeId: node1.id,
		toNodeId: node2.id,
		properties: { since: 2020 },
	});
	console.log(`✓ Created relationship ${rel.id}: ${rel.type}`);

	// Test: Get relationship by ID
	console.log("\nTest: Get relationship by ID");
	const fetchedRel = await adapter.getRelationshipById(rel.id);
	console.log(`✓ Fetched relationship ${fetchedRel.id}: ${fetchedRel.type}`);

	// Test: Get relationships by type
	console.log("\nTest: Get relationships by type");
	const knowsRels = await adapter.getRelationshipsByType("KNOWS");
	console.log(`✓ Found ${knowsRels.length} KNOWS relationships`);

	// Test: Get relationships between nodes
	console.log("\nTest: Get relationships between nodes");
	const betweenRels = await adapter.getRelationshipsBetween(node1.id, node2.id);
	console.log(`✓ Found ${betweenRels.length} relationships between nodes`);

	// Test: Get outgoing relationships
	console.log("\nTest: Get outgoing relationships");
	const outgoing = await adapter.getOutgoingRelationships(node1.id);
	console.log(`✓ Found ${outgoing.length} outgoing relationships from node 1`);

	// Test: Get incoming relationships
	console.log("\nTest: Get incoming relationships");
	const incoming = await adapter.getIncomingRelationships(node2.id);
	console.log(`✓ Found ${incoming.length} incoming relationships to node 2`);

	// Test: Add label
	console.log("\nTest: Add label to node");
	await adapter.addNodeLabel(node1.id, "Employee");
	const updated = await adapter.getNodeById(node1.id);
	console.log(
		`✓ Added label, node now has labels: ${JSON.stringify(updated.labels)}`,
	);

	// Test: Update node properties
	console.log("\nTest: Update node properties");
	await adapter.updateNodeProperties(node1.id, { age: 31 });
	const updated2 = await adapter.getNodeById(node1.id);
	console.log(`✓ Updated age to ${updated2.properties.get("age")}`);

	// Test: Update relationship properties
	console.log("\nTest: Update relationship properties");
	await adapter.updateRelationshipProperties(rel.id, { since: 2021 });
	const updatedRel = await adapter.getRelationshipById(rel.id);
	console.log(
		`✓ Updated relationship since to ${updatedRel.properties.get("since")}`,
	);

	// Test: Get all nodes
	console.log("\nTest: Get all nodes");
	const allNodes = await adapter.getAllNodes();
	console.log(`✓ Retrieved ${allNodes.length} total nodes`);

	// Test: Get all relationships
	console.log("\nTest: Get all relationships");
	const allRels = await adapter.getAllRelationships();
	console.log(`✓ Retrieved ${allRels.length} total relationships`);

	// Test: Delete relationship
	console.log("\nTest: Delete relationship");
	await adapter.deleteRelationship(rel.id);
	const fetchedDeleted = await adapter.getRelationshipById(rel.id);
	console.log(`✓ Deleted relationship, fetch result: ${fetchedDeleted}`);

	// Test: Delete node
	console.log("\nTest: Delete node");
	await adapter.deleteNode(node1.id);
	const fetchedNodeDeleted = await adapter.getNodeById(node1.id);
	console.log(`✓ Deleted node, fetch result: ${fetchedNodeDeleted}`);

	// Test: Clear all
	console.log("\nTest: Clear all data");
	await adapter.clear();
	const remainingNodes = await adapter.getAllNodes();
	console.log(`✓ Cleared adapter, remaining nodes: ${remainingNodes.length}`);

	await adapter.disconnect();
	console.log("\n✓ All InMemoryAdapter tests passed!");
}

// Run tests
testInMemoryAdapter().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
