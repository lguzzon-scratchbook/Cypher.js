# CypherNG Design Document

## Overview

Refactor `js/Cypher.js` (7,559 lines) into modular `js/CypherNG.js` with clean separation of concerns, prepare architecture for future persistence layer, achieve 80%+ test coverage, and ensure full behavioral parity with the original implementation.

## Detailed Requirements

### Functional Requirements

1. **Behavioral Parity**: Refactored `CypherNG.js` must produce identical results to original `Cypher.js` for all queries in `js/Cypher.test.js`
2. **Cross-Platform**: Same code runs in both browser and Node.js environments
3. **Modular Architecture**: Split monolithic codebase into focused, maintainable modules
4. **Persistence-Ready**: Architecture designed for future localStorage, IndexedDB, and Node.js fs integration
5. **Test Coverage**: Achieve minimum 80% code coverage
6. **Shared Tests**: Both Cypher.js and CypherNG.js validated by same test suite
7. **JavaScript Standard**: ES2020+ (optional chaining, nullish coalescing, etc.)

### Technical Requirements

1. **Package Manager**: Bun.js
2. **Linter/Formatter**: BiomeJS
3. **Test Runner**: Bun's native test runner with built-in coverage
4. **Module Format**: ES Modules as source, build to both ESM and CommonJS

### Non-Functional Requirements

1. **Performance**: Maintain same execution speed as original
2. **Maintainability**: Code must be easier to understand, modify, and extend
3. **Documentation**: JSDoc comments for all public APIs
4. **Backward Compatible**: Original API surface must remain unchanged

## Architecture Overview

```
CypherNG/
├── src/
│   ├── index.js              # Main entry point, exports
│   ├── CypherNG.js           # Main class, public API
│   ├── core/                 # Core graph database functionality
│   │   ├── GraphEngine.js    # Graph traversal and operations
│   │   ├── QueryExecutor.js  # Query execution logic
│   │   ├── QueryParser.js    # Cypher query parsing
│   │   ├── ExpressionEvaluator.js  # Expression evaluation
│   │   └── operators/        # Query operators (MATCH, RETURN, etc.)
│   ├── data/                 # Data structures
│   │   ├── Node.js           # Node class
│   │   ├── Relationship.js   # Relationship class
│   │   ├── Graph.js          # Graph data structure
│   │   └── QueryResult.js    # Query result structure
│   ├── storage/              # Persistence layer (future)
│   │   ├── index.js
│   │   ├── Adapter.js        # Base storage adapter interface
│   │   └── adapters/
│   │       ├── LocalStorageAdapter.js
│   │       ├── IndexedDBAdapter.js
│   │       └── FileSystemAdapter.js
│   └── utils/                # Utilities
│       ├── StringRecoder.js  # String compression (from original)
│       ├── IDFactory.js      # ID generation (from original)
│       └── index.js
├── dist/                     # Build output
│   ├── esm/                  # ES Modules build
│   └── cjs/                  # CommonJS build
├── tests/
│   ├── shared/               # Shared behavioral tests
│   │   ├── query-execution.test.js
│   │   ├── graph-operations.test.js
│   │   └── data-types.test.js
│   ├── cypher/               # Legacy tests (imports original)
│   └── cypherng/             # Refactored version tests
├── js/
│   ├── Cypher.js             # Original (preserved)
│   └── CypherNG.js           # Refactored (output)
├── package.json
├── bunfig.toml
└── biome.json
```

## Components and Interfaces

### Main Class: CypherNG

```javascript
class CypherNG {
    constructor(options = {})

    // Execute a Cypher query
    execute(query: string, onSuccess: Function, onError: Function): void

    // Query execution (Promise-based alternative)
    executeAsync(query: string): Promise<QueryResult>

    // Persistence methods (future)
    saveQuery(id: string, query: string): Promise<void>
    loadQuery(id: string): Promise<string>
    setStorage(storage: StorageAdapter): void
}
```

### Storage Adapter Interface

```javascript
class StorageAdapter {
    async get(key: string): Promise<any>
    async set(key: string, value: any): Promise<void>
    async delete(key: string): Promise<void>
    async clear(): Promise<void>
    async keys(): Promise<string[]>
}
```

### Core Components

| Component | Responsibility |
|-----------|----------------|
| GraphEngine | Graph traversal, node/relationship management |
| QueryExecutor | Orchestrates query execution flow |
| QueryParser | Parses Cypher query syntax |
| ExpressionEvaluator | Evaluates expressions, functions, operators |
| Node | Represents graph node |
| Relationship | Represents graph relationship |
| Graph | Container for nodes and relationships |

## Data Models

### Node

```javascript
class Node {
    id: number           // Internal node ID
    labels: string[]     // Node labels (e.g., :Person)
    properties: Object   // Node properties
}
```

### Relationship

```javascript
class Relationship {
    id: number           // Internal relationship ID
    type: string         // Relationship type (e.g., :KNOWS)
    startNodeId: number  // Source node ID
    endNodeId: number    // Target node ID
    properties: Object   // Relationship properties
}
```

### QueryResult

```javascript
class QueryResult {
    data: Array          // Query results
    graph: Graph         // Graph state after query
    columns: string[]    // Return columns
    stats: Object        // Query statistics
}
```

## Error Handling

### Error Categories

1. **Parse Errors**: Invalid Cypher syntax
2. **Execution Errors**: Runtime errors during query execution
3. **Storage Errors**: Persistence layer failures
4. **Validation Errors**: Invalid input parameters

### Error Interface

```javascript
class CypherError extends Error {
    code: string         // Error code (e.g., 'PARSE_ERROR')
    query: string        // The query that caused the error
    line: number         // Line number (if applicable)
    column: number       // Column number (if applicable)
}
```

### Error Handling Strategy

- Try-catch blocks around all synchronous operations
- Promise rejection for async operations
- Custom error types for specific error categories
- Error callbacks for legacy API compatibility

## Acceptance Criteria

### Behavioral Parity

```gherkin
Given a Cypher query
When executed against both Cypher.js and CypherNG.js
Then both should return identical results
And both should produce identical graph states
```

### Module Loading

```gherkin
Given CypherNG is imported as ES module
When in Node.js environment
Then it should be importable via 'import { CypherNG } from "cypherng"'

Given CypherNG is included in browser
When loaded via script tag
Then it should be accessible via window.CypherNG
```

### Storage Integration

```gherkin
Given CypherNG is configured with a storage adapter
When saving a query
Then the query should persist to the underlying storage

Given CypherNG is configured with a storage adapter
When loading a query
Then the query should be retrieved from storage
```

### Test Coverage

```gherkin
When running the test suite
Then code coverage should be at least 80%
And all critical paths should be covered
And behavioral equivalence tests should pass
```

## Testing Strategy

### Test Categories

1. **Shared Tests** (`tests/shared/`): Behavioral equivalence tests
   - Run against both Cypher.js and CypherNG.js
   - Compare outputs for exact match

2. **Legacy Tests** (`tests/cypher/`): Original behavior validation
   - Replicate original `Cypher.test.js` queries
   - Ensure parity maintained

3. **New Feature Tests** (`tests/cypherng/`): CypherNG-specific tests
   - Storage adapter tests
   - New API functionality

### Test Configuration

`bunfig.toml`:
```toml
[test]
coverage = true
coverageThreshold = 0.8
coverageSkipTestFiles = true
coverageReporter = ["text", "lcov"]
```

### Running Tests

```bash
# All tests with coverage
bun test --coverage

# Shared tests only
bun test tests/shared/

# With AI-friendly output
CLAUDECODE=1 bun test --coverage
```

## Appendices

### Technology Choices

| Technology | Choice | Rationale |
|------------|--------|-----------|
| Package Manager | Bun.js | User requirement, fast performance |
| Linter/Formatter | BiomeJS | User requirement, modern alternative |
| Test Runner | Bun native | Built-in coverage, fast |
| Module Format | ESM + CJS | Browser + Node.js support |
| JavaScript | ES2020+ | Modern features, good support |

### Module Decomposition Strategy

Original Cypher.js (~7,500 lines) will be decomposed into:

1. **Core** (~3,000 lines): Graph engine, query execution
2. **Data** (~500 lines): Node, Relationship, Graph classes
3. **Storage** (~500 lines): Persistence layer (extensible)
4. **Utils** (~200 lines): StringRecoder, IDFactory

Total: ~4,200 lines (reduced through cleaner code, removed duplication)

### Persistence Layer Design Decisions

Decisions made specifically to facilitate future persistence:

1. **Adapter Pattern**: Allows swapping storage implementations without modifying core code
2. **Registry Pattern**: Enables runtime storage backend selection
3. **Async-First**: All storage operations are async, matching IndexedDB behavior
4. **Key-Value Interface**: Simple interface that maps to any storage backend
5. **Serializability**: All data structures designed for easy serialization

### Alternative Approaches Considered

1. **Single Large Module**: Rejected — maintainability issues, contradicts refactor goal
2. **Class-based with Deep Inheritance**: Rejected — prefers composition over inheritance
3. **Separate Test Files per Version**: Rejected — needs shared tests for parity validation
4. **External Storage Plugin**: Deferred — adapter interface defined but not implemented

### Known Limitations

1. **No Browser Build Step**: May need bundler for older browsers (not in scope)
2. **IndexedDB Complexity**: Full async/promise-based IndexedDB adapter requires additional work
3. **Bundle Size**: ESM + CJS doubles output; consider tree-shaking in production

## Design Review Checklist

- [ ] All requirements captured
- [ ] Architecture supports persistence future-proofing
- [ ] Module boundaries clear and maintainable
- [ ] Error handling strategy defined
- [ ] Test coverage targets set
- [ ] Cross-platform compatibility addressed
- [ ] Technology choices documented
- [ ] Alternative approaches considered