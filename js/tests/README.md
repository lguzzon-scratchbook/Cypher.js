# Cypher.js Test Suite

Comprehensive test suite for Cypher.js graph database adapters and functionality.

## Structure

```
js/tests/
├── adapters/              # Adapter-specific tests
│   ├── redis.test.js     # RedisAdapter tests
│   ├── inmemory.test.js  # InMemoryAdapter tests
│   ├── filesystem.test.js # FilesystemAdapter tests
│   └── gundb.test.js     # GunDBAdapter tests
├── integration/          # Integration tests
│   └── integration.test.js
├── query/                # Query execution tests
│   └── query-execution.test.js
├── scripts/              # Test utilities
│   ├── redisManager.sh  # Redis Docker lifecycle manager
│   └── test-runner.sh   # Unified test runner
├── parity.js            # Shared DataAdapter interface tests
├── adapters.test.js     # Base adapter tests
└── README.md            # This file
```

## Running Tests

### Quick Start

```bash
# Run all tests (with Redis lifecycle management)
npm test

# Run specific adapter tests
npm run test:redis
npm run test:inmemory
npm run test:filesystem
npm run test:gundb

# Run with verbose output
npm run test:verbose
```

### Redis Management

```bash
# Start Redis server (Docker)
npm run redis:start

# Stop Redis server
npm run redis:stop

# Check Redis status
npm run redis:status

# Health check
npm run redis:health
```

### Advanced Usage

```bash
# Run tests without starting Redis (assumes Redis already running)
bash js/tests/scripts/test-runner.sh --no-redis

# Keep Redis running after tests
bash js/tests/scripts/test-runner.sh --keep-redis

# Test specific adapter with verbose output
bash js/tests/scripts/test-runner.sh --adapter redis --verbose
```

## Test Categories

### 1. Parity Tests (`parity.js`)

Shared test suite ensuring all adapters implement the DataAdapter interface consistently.

**Coverage:**
- Node CRUD operations
- Relationship CRUD operations
- Label management
- Property updates
- Query operations (by label, property, type)
- Graph traversal (incoming, outgoing, between)
- Cascade deletion

**Run count:** 18 tests per adapter

### 2. Adapter-Specific Tests

#### RedisAdapter (`adapters/redis.test.js`)

**Additional Coverage:**
- Connection management
- Multiple label indexes
- Relationship type indexes
- Adjacency indexes
- Concurrent operations
- Property type preservation
- ID sequence consistency
- Large dataset handling (stress test)

**Prerequisites:** Redis server (auto-managed by test-runner.sh)

#### InMemoryAdapter (`adapters/inmemory.test.js`)

**Additional Coverage:**
- Instance isolation
- Performance benchmarks
- Complex graph structures
- Duplicate label handling
- Clear operation scope

**Prerequisites:** None (pure JavaScript)

#### FilesystemAdapter (`adapters/filesystem.test.js`)

**Coverage:** Parity tests + filesystem-specific scenarios

**Prerequisites:** Write access to temp directory

#### GunDBAdapter (`adapters/gundb.test.js`)

**Coverage:** Parity tests + GunDB-specific scenarios

**Prerequisites:** GunDB dependency

### 3. Integration Tests (`integration/`)

End-to-end tests combining multiple components.

### 4. Query Execution Tests (`query/`)

Tests for Cypher query parsing and execution.

## Test Development

### Adding a New Adapter Test

1. Create test file in `adapters/`:
```javascript
const { runParityTests } = require("../parity");
const MyAdapter = require("../../adapters/MyAdapter");

async function testMyAdapter() {
  const adapter = new MyAdapter();
  await adapter.connect({});
  
  // Run parity tests
  const results = await runParityTests(adapter, "MyAdapter");
  
  // Add adapter-specific tests
  // ...
  
  await adapter.disconnect();
}

testMyAdapter();
```

2. Update `test-runner.sh` to include your adapter

3. Add npm script in `package.json`:
```json
"test:myadapter": "bash js/tests/scripts/test-runner.sh --adapter myadapter"
```

### Writing Custom Tests

Use the test helper pattern:

```javascript
const test = async (name, fn) => {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}: ${error.message}`);
    throw error;
  }
};

await test("My test case", async () => {
  // Test logic
  if (condition) {
    throw new Error("Test failed");
  }
});
```

## CI/CD Integration

The test runner provides proper exit codes:
- `0`: All tests passed
- `1`: Some tests failed

Example GitHub Actions workflow:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm test
```

## Troubleshooting

### Redis Connection Failed

```
⚠️  Redis server not available
```

**Solutions:**
1. Start Redis: `npm run redis:start`
2. Check Redis is running: `npm run redis:health`
3. Verify Docker is installed and running

### Module Not Found

```
Redis module not installed
```

**Solution:**
```bash
npm install redis
```

### Permission Denied

```
bash: test-runner.sh: Permission denied
```

**Solution:**
```bash
chmod +x js/tests/scripts/test-runner.sh
chmod +x js/tests/scripts/redisManager.sh
```

## Performance Notes

- **InMemoryAdapter**: Fastest, suitable for unit tests
- **RedisAdapter**: Requires Redis, suitable for integration tests
- **FilesystemAdapter**: Slower due to I/O, suitable for persistence tests
- **GunDBAdapter**: Decentralized, suitable for P2P scenarios

## Contributing

When adding tests:
1. Ensure all adapters pass parity tests
2. Add adapter-specific tests for unique features
3. Update this README with new test categories
4. Verify CI/CD integration works

## License

GPL-3.0-or-later
