# Testing Quick Start Guide

## TL;DR

```bash
# Run all tests
npm test

# Test specific adapter
npm run test:redis

# Manage Redis
npm run redis:start
npm run redis:stop
npm run redis:health
```

## What Was Done

Restructured the entire test suite to:
- ✅ Cover ALL adapters comprehensively
- ✅ Automate Redis lifecycle with Docker
- ✅ Organize tests by type (adapters/integration/query)
- ✅ Add 33 test scenarios for RedisAdapter
- ✅ Add 23 test scenarios for InMemoryAdapter
- ✅ Provide simple npm scripts for everything

## Test Coverage

### RedisAdapter - 33 Scenarios
- 18 Parity tests (DataAdapter interface)
- 15 Redis-specific tests:
  - Connection management
  - Label/type indexes
  - Concurrent operations
  - Property handling
  - Large datasets (100 nodes, 200 relationships)

### Other Adapters
- InMemoryAdapter: 23 scenarios (parity + extended)
- FilesystemAdapter: 18 scenarios (parity)
- GunDBAdapter: 18 scenarios (parity)

## Common Commands

### Testing

```bash
# All tests with auto Redis management
npm test

# Specific adapter
npm run test:redis
npm run test:inmemory
npm run test:filesystem
npm run test:gundb

# Verbose mode (see all output)
npm run test:verbose
```

### Redis Management

```bash
# Start
npm run redis:start

# Health check
npm run redis:health

# Status
npm run redis:status

# Stop
npm run redis:stop
```

### Advanced

```bash
# Run without starting Redis
bash js/tests/scripts/test-runner.sh --no-redis

# Keep Redis running after tests
bash js/tests/scripts/test-runner.sh --keep-redis

# Specific adapter with verbose
bash js/tests/scripts/test-runner.sh --adapter redis --verbose
```

## File Structure

```
js/tests/
├── adapters/           # Adapter tests
│   ├── redis.test.js
│   ├── inmemory.test.js
│   ├── filesystem.test.js
│   └── gundb.test.js
├── integration/        # Integration tests
├── query/             # Query tests
├── scripts/           # Test utilities
│   ├── redisManager.sh
│   └── test-runner.sh
└── README.md          # Full documentation
```

## Troubleshooting

### Redis won't start
```bash
# Check Docker is running
docker ps

# Manual start
npm run redis:start

# Check logs
npm run redis:status
```

### Module not found
```bash
# Install dependencies
npm install redis
```

### Tests fail
```bash
# Run in verbose mode to see details
npm run test:verbose

# Check specific adapter
npm run test:redis --verbose
```

## What's Next?

The test infrastructure is complete and working. You can now:
1. Run tests locally before commits
2. Integrate with CI/CD (GitHub Actions, etc.)
3. Add new test scenarios easily
4. Monitor adapter performance

For detailed documentation, see `js/tests/README.md`
