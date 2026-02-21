# Cypher.js Test Suite

This directory contains the comprehensive test suite for both Cypher.js (legacy) and CypherNG.js (next-generation) implementations.

## Test Structure

```
tests/
├── shared/                    # Tests that run against both implementations
│   ├── dual-face-harness.js   # Test utilities for dual-face testing
│   └── core.tests.js          # Core functionality tests
├── legacy/                    # Tests specific to Cypher.js
├── ng/                        # Tests specific to CypherNG.js
└── README.md                  # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Dual-Face Testing

The dual-face test harness runs the same tests against both implementations to ensure behavioral parity:

```javascript
const { dualFaceTest, compareResults } = require('./shared/dual-face-harness.js');

// Test runs against both Cypher.js and CypherNG.js
dualFaceTest('should create nodes', async (cypher, implName) => {
  const result = await runQuery(cypher, 'CREATE (n:Test) RETURN n');
  expect(result.stats.nodesAdded).toBe(1);
});

// Direct comparison of results
compareResults(
  'Simple node creation',
  'CREATE (n:Test {value: 42}) RETURN n.value as val'
);
```

## Writing New Tests

### Shared Tests (for both implementations)

Add tests to `tests/shared/core.tests.js`:

```javascript
dualFaceTest('my new test', async (cypher, implName) => {
  // Test code here
  // Runs against both implementations
});
```

### Legacy-Specific Tests

Add tests to `tests/legacy/`:

```javascript
const Cypher = require('../js/Cypher.js');

describe('Legacy-specific tests', () => {
  test('legacy feature', () => {
    const cypher = new Cypher({ runInWebWorker: false });
    // Test legacy-specific behavior
  });
});
```

### NG-Specific Tests

Add tests to `tests/ng/`:

```javascript
const CypherNG = require('../js/CypherNG.js');

describe('NG-specific tests', () => {
  test('new NG feature', () => {
    const cypher = new CypherNG({ runInWebWorker: false });
    // Test NG-specific behavior
  });
});
```

## Coverage Requirements

- Minimum 80% coverage for CypherNG.js
- Focus on:
  - Core graph operations (Node, Relationship, DB)
  - Query parsing and execution
  - Pattern matching
  - Expression evaluation

## Test Utilities

### runQuery(cypher, query)

Executes a query and returns a promise with results:

```javascript
const result = await runQuery(cypher, 'MATCH (n) RETURN count(*) as cnt');
```

### assertBehavioralParity(description, queries)

Runs multiple queries against both implementations and asserts parity:

```javascript
assertBehavioralParity('Basic operations', [
  'CREATE (n:Test) RETURN n',
  'MATCH (n:Test) RETURN count(*)'
]);
```
