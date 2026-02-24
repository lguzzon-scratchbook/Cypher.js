# Testing Frameworks Research

## Overview

This document research testing frameworks compatible with Bun.js that can achieve 80%+ code coverage and support shared tests for validating identical behavior between Cypher.js and CypherNG.js.

## Candidate Frameworks

### 1. Bun's Native Test Runner (Recommended)

Bun includes a built-in test runner with excellent performance and coverage support.

```javascript
import { test, expect, describe } from 'bun:test';

describe('CypherNG', () => {
    test('execute query', async () => {
        const cypher = new CypherNG();
        const result = await cypher.execute('RETURN 1 as n');
        expect(result).toEqual([{ n: 1 }]);
    });
});
```

**Features**:
- Native `--coverage` flag with threshold support
- Built-in expect matchers
- describe/test/it blocks (Jest-compatible)
- Snapshot testing
- Mocking support
- Fast parallel execution

**Coverage Configuration** (`bunfig.toml`):
```toml
[test]
coverage = true
coverageThreshold = 0.8
coverageSkipTestFiles = true
```

**Pros**:
- Integrated with Bun (single tool)
- Built-in coverage with thresholds
- Fast execution
- Native ESM support
- CI integration via exit codes

**Cons**:
- Bun-specific (needs Bun runtime)
- Less mature than Jest/Vitest

### 2. Vitest

Alternative test runner compatible with Bun (via `--provider=vitest`).

```javascript
import { test, expect, describe } from 'vitest';

test('basic', () => {
    expect(1 + 1).toBe(2);
});
```

**Pros**:
- Jest-compatible API
- Works without Bun (portable)
- Good ecosystem

**Cons**:
- Requires separate install
- Can run on Bun but native runner is better

### 3. Jest

Traditional choice, but slower.

```javascript
test('basic', () => {
    expect(1 + 1).toBe(2);
});
```

**Pros**: Most mature, largest ecosystem
**Cons**: Slower, heavier

## Recommendation

**Use Bun's native test runner** for:
1. Minimal dependencies
2. Built-in 80% threshold enforcement
3. Excellent performance
4. Single tool for testing + coverage

## Shared Test Strategy

To validate behavioral equivalence between Cypher.js (legacy) and CypherNG.js (refactored):

```javascript
// tests/shared/query-execution.test.js
import { test, describe, expect } from 'bun:test';
import { Cypher as CypherLegacy } from '../../js/Cypher.js';
import { CypherNG } from '../../src/index.js';

describe('Query Execution - Behavioral Equivalence', () => {
    const testQueries = [
        'RETURN 1 as n',
        'RETURN "hello" as text',
        'MATCH (n) RETURN count(n)',
        // Add all queries from Cypher.test.js
    ];

    for (const query of testQueries) {
        test(`query: ${query.substring(0, 50)}`, async () => {
            const legacy = new CypherLegacy();
            const neo = new CypherNG();

            const legacyResult = await executeAsync(legacy, query);
            const neoResult = await executeAsync(neo, query);

            // Compare results (normalize if needed)
            expect(normalizeResult(legacyResult)).toEqual(normalizeResult(neoResult));
        });
    }
});

function executeAsync(cypher, query) {
    return new Promise((resolve, reject) => {
        cypher.execute(query, resolve, reject);
    });
}

function normalizeResult(result) {
    // Normalize for comparison (handle different return formats)
    return JSON.parse(JSON.stringify(result));
}
```

## Version-Specific Tests

Separate tests for version-specific behaviors:

```javascript
// tests/cypherng/storage.test.js (CypherNG only)
import { test, expect, describe } from 'bun:test';
import { CypherNG } from '../../src/index.js';

describe('CypherNG Persistence', () => {
    test('should persist query to localStorage', async () => {
        const cypher = new CypherNG({ storage: 'local' });
        await cypher.saveQuery('test', 'RETURN 1');
        expect(localStorage.getItem('query:test')).toBeTruthy();
    });
});
```

## Coverage Configuration

Create `bunfig.toml`:

```toml
[test]
# Enable coverage by default
coverage = true

# Require 80% line coverage
coverageThreshold = 0.8

# Or detailed thresholds
coverageThreshold = {
    lines = 0.8,
    functions = 0.8,
    statements = 0.8
}

# Exclude test files from coverage
coverageSkipTestFiles = true

# Coverage reporters
coverageReporter = ["text", "lcov"]
```

## Running Tests

```bash
# Run all tests with coverage
bun test --coverage

# With threshold enforcement (fails if < 80%)
bun test --coverage

# Quiet output for AI agents
CLAUDECODE=1 bun test --coverage

# Specific test file
bun test tests/shared/query-execution.test.js

# With reporter
bun test --coverage --coverage-reporter=lcov
```

## Test File Structure

```
js/
├── Cypher.js           # Legacy
├── CypherNG.js         # Refactored (output)
└── Cypher.test.js      # Legacy test runner

tests/
├── shared/             # Shared tests - behavioral equivalence
│   ├── query-execution.test.js
│   ├── graph-operations.test.js
│   └── data-types.test.js
├── cypher.test.js      # Legacy-specific tests
└── cypherng.test.js    # New features tests
    └── storage.test.js # Persistence tests
```

## References

- [Bun Test Documentation](https://bun.sh/docs/test)
- [Bun Coverage Documentation](https://bun.sh/docs/test/coverage)
- [Bun Test CLI Reference](https://bun.sh/docs/cli/test)