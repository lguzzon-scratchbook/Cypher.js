/**
 * @description Integration tests for CypherNG with different adapters
 */

const CypherNG = require("../CypherNG");
const InMemoryAdapter = require("../adapters/InMemoryAdapter");
const ConfigManager = require("../utils/ConfigManager");
const Logger = require("../utils/Logger");

const logger = new Logger("IntegrationTest", "info");

async function testCypherNGWithAdapter() {
	logger.info("=== Integration Test: CypherNG with InMemoryAdapter ===\n");

	// Create adapter and CypherNG instance
	const adapter = new InMemoryAdapter();
	const cypher = new CypherNG(adapter);

	// Connect
	logger.info("Connecting to adapter...");
	await cypher.connect({});

	// Add graph data
	logger.info("Adding graph data...");
	const nodes = [
		{ id: 0, labels: ["Person"], properties: { name: "Alice", age: 30 } },
		{ id: 1, labels: ["Person"], properties: { name: "Bob", age: 25 } },
		{ id: 2, labels: ["Person"], properties: { name: "Charlie", age: 35 } },
	];

	const relationships = [
		{
			id: 0,
			type: "KNOWS",
			fromNodeId: 0,
			toNodeId: 1,
			properties: { since: 2020 },
		},
		{
			id: 1,
			type: "KNOWS",
			fromNodeId: 1,
			toNodeId: 2,
			properties: { since: 2021 },
		},
		{ id: 2, type: "WORKS_WITH", fromNodeId: 0, toNodeId: 2, properties: {} },
	];

	await cypher.addGraph(nodes, relationships);
	logger.info("✓ Graph data added\n");

	// Query through adapter
	logger.info("Testing adapter queries...");

	// Get all people
	const allPeople = await adapter.getNodesByLabel("Person");
	logger.info(`✓ Found ${allPeople.length} Person nodes`);

	// Get relationships by type
	const knowsRels = await adapter.getRelationshipsByType("KNOWS");
	logger.info(`✓ Found ${knowsRels.length} KNOWS relationships`);

	// Get specific person
	const alice = await adapter.getNodeById(0);
	logger.info(`✓ Retrieved Alice: age=${alice.properties.get("age")}\n`);

	// Test relationships
	logger.info("Testing relationship queries...");
	const outgoing = await adapter.getOutgoingRelationships(0);
	logger.info(`✓ Alice has ${outgoing.length} outgoing relationships`);

	const incoming = await adapter.getIncomingRelationships(2);
	logger.info(`✓ Charlie has ${incoming.length} incoming relationships\n`);

	// Test updates
	logger.info("Testing mutations...");
	await adapter.updateNodeProperties(0, { age: 31 });
	const updated = await adapter.getNodeById(0);
	logger.info(`✓ Updated Alice's age to ${updated.properties.get("age")}`);

	await adapter.addNodeLabel(0, "Employee");
	const _withLabel = await adapter.getNodeById(0);
	logger.info(`✓ Added Employee label to Alice\n`);

	// Test graph statistics
	logger.info("Graph statistics:");
	const totalNodes = await adapter.getAllNodes();
	const totalRels = await adapter.getAllRelationships();
	logger.info(`✓ Total nodes: ${totalNodes.length}`);
	logger.info(`✓ Total relationships: ${totalRels.length}\n`);

	// Disconnect
	await cypher.disconnect();
	logger.info("✓ Disconnected from adapter");
	logger.info("\n✓ All integration tests passed!\n");
}

async function testConfigManager() {
	logger.info("=== Testing ConfigManager ===\n");

	const config = new ConfigManager();

	// Load config
	config.load({
		adapter: "memory",
		memory: { maxSize: 1000 },
		logging: { level: "info" },
	});
	logger.info("✓ Loaded configuration");

	// Get values
	const adapterName = config.get("adapter");
	const logLevel = config.get("logging.level");
	logger.info(`✓ Adapter: ${adapterName}, Log level: ${logLevel}`);

	// Set values
	config.set("logging.level", "debug");
	logger.info(`✓ Updated log level to ${config.get("logging.level")}`);

	// Register adapters
	config.registerAdapter("memory", InMemoryAdapter);
	logger.info("✓ Registered InMemoryAdapter");

	// Create adapter
	const adapter = config.createAdapter("memory");
	logger.info(`✓ Created adapter instance: ${adapter.constructor.name}\n`);
}

async function testLogger() {
	logger.info("=== Testing Logger ===\n");

	const testLogger = new Logger("TestModule", "debug");

	testLogger.debug("This is a debug message", { key: "value" });
	testLogger.info("This is an info message");
	testLogger.warn("This is a warning message");
	testLogger.error("This is an error message");

	logger.info("\n✓ Logger test completed\n");
}

// Run all tests
async function runAll() {
	try {
		await testCypherNGWithAdapter();
		await testConfigManager();
		await testLogger();
		logger.info("=== All Integration Tests Passed! ===");
	} catch (error) {
		logger.error("Test failed:", error);
		process.exit(1);
	}
}

runAll();
