/**
 * @description Parity tests for RedisAdapter
 * Requires Redis server running on localhost:6379
 */

const { runParityTests } = require("./parity");

async function testRedisAdapter() {
	let RedisAdapter;
	try {
		RedisAdapter = require("../adapters/RedisAdapter");
	} catch (_error) {
		console.log("\n⚠️  Redis module not installed. Run: npm install redis");
		console.log("Skipping RedisAdapter tests.\n");
		process.exit(0);
	}

	try {
		console.log("Attempting to connect to Redis on localhost:6379...\n");

		const adapter = new RedisAdapter({
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
			console.log("  3. Run tests: node js/tests/redis.test.js\n");
			process.exit(0);
		}

		// Run parity tests
		const results = await runParityTests(adapter, "RedisAdapter");

		// Cleanup
		await adapter.clear();
		await adapter.disconnect();

		if (results.failed === 0) {
			console.log("\n✅ All RedisAdapter tests passed!");
			process.exit(0);
		} else {
			console.log("\n✗ Some RedisAdapter tests failed");
			process.exit(1);
		}
	} catch (error) {
		console.error("Test error:", error.message);
		process.exit(1);
	}
}

testRedisAdapter();
