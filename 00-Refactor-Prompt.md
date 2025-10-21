# Cypher.js Modular Refactoring Specification

## 1. Objective

Refactor `js/Cypher.js` into a functionally identical but modular `js/CypherNG.js`, featuring a pluggable data layer. The final product must be a drop-in replacement that supports multiple, runtime-configurable storage backends.

## 2. Core Architecture & API Contract

### Main Entrypoint: `CypherNG.js`

- Serves as the public-facing API, preserving the original `Cypher.js` interface.
- Delegates operations to the `QueryEngine` and the configured `DataAdapter`.

### Core Modules (`/core`)

- **`QueryEngine.js`**: Parses and plans Cypher queries. Is stateless and storage-agnostic.
- **`GraphProcessor.js`**: Executes query plans against the data adapter.
- **`ResultFormatter.js`**: Formats data from the adapter into the final result set.

### Abstract Data Adapter Contract (`/adapters/DataAdapter.js`)

All storage plugins MUST implement this interface.

```javascript
/**
 * @interface
 * @description Defines the contract for all storage backend adapters.
 */
class DataAdapter {
  /** Connects to the data source. Throws on failure. */
  async connect(config) { throw new Error("Not implemented"); }

  /** Disconnects from the data source. */
  async disconnect() { throw new Error("Not implemented"); }

  /**
   * @returns {AsyncGenerator<GraphElement>} A stream of graph elements matching the query.
   */
  async *stream(query, options) { throw new Error("Not implemented"); }

  /**
   * @param {GraphElement[]} batch - An array of nodes/relationships to write.
   * @returns {Promise<void>}
   */
  async batchWrite(batch, options) { throw new Error("Not implemented"); }

  /**
   * @param {any} criteria - Criteria to match elements for deletion.
   * @returns {Promise<number>} The number of elements deleted.
   */
  async delete(criteria) { throw new Error("Not implemented"); }

  /**
   * Subscribes to real-time changes. Required for reactive backends.
   * @returns {Function} An unsubscribe function.
   */
  subscribe(pattern, callback) { throw new Error("Not implemented"); }
}
```

## 3. Development Roadmap & Tasks

Execute these tasks sequentially, ensuring all tests and quality gates pass at each step.

1. **Core Abstraction (TDD)**
    - Create a functional parity test suite based on `js/Cypher.js`.
    - Extract `QueryEngine`, `GraphProcessor`, and `ResultFormatter` from `js/Cypher.js`.
    - Define the abstract `DataAdapter` class.
    - Implement an in-memory `DataAdapter` for initial testing.
    - Wire `CypherNG.js` to use the new core modules and an adapter instance.
    - **Goal**: All parity tests must pass using the in-memory adapter.

2. **Filesystem Adapter**
    - Implement `FilesystemAdapter.js` using JSON/binary files.
    - Include file-based indexing and atomic write operations (e.g., write-to-temp-then-rename).
    - Add a dedicated test suite for this adapter.
    - **Goal**: All parity tests must pass using the filesystem adapter.

3. **Networked Adapters**
    - Implement `RedisAdapter.js`, managing connection pooling, data serialization, and leveraging atomic Redis commands.
    - Implement `GunDBAdapter.js`, focusing on its reactive capabilities and implementing the `subscribe` method.
    - Implement robust error handling: connection retries with exponential backoff and circuit breakers.
    - Add dedicated test suites for each adapter.
    - **Goal**: All parity tests must pass with Redis and GunDB adapters.

4. **Finalization & Polish**
    - Implement the plugin factory and dynamic registration system.
    - Add performance benchmarks comparing all adapters against the original.
    - Ensure 100% JSDoc coverage with `@example` and `@throws` tags.
    - Final BiomeJS check (`bunx --silent @biomejs/biome check --write .`).
    - **Goal**: The system is fully documented, tested, and benchmarked.

## 4. Technical Mandates

- **Language**: Pure JavaScript, strictly adhering to ES2025 standards (private fields `#`, async generators, decorators, etc.). **NO TYPESCRIPT**.
- **Code Quality**: All code must pass `biomejs/biome check --write` without errors.
- **Modularity**: Modules must not exceed 100 lines (code + JSDoc). Use barrel files (`index.js`) for clean exports.
- **Dependencies**: Employ dependency injection for adapters. Avoid tight coupling.
- **Documentation**: All public APIs, classes, and complex functions must have JSDoc.
- **Performance**: Network adapters must use connection pooling. A configurable caching layer (with TTL/eviction) should be available as a utility. Batch operations are required.
- **Resilience**: Implement a clear error taxonomy. Network failures must be handled gracefully.

## 5. Definition of Done

- [ ] **Functional Parity**: `CypherNG.js` passes all tests written for the original `Cypher.js`.
- [ ] **Adapter Integrity**: Each of the three storage adapters (Filesystem, Redis, GunDB) passes its own isolated unit and integration test suite.
- [ ] **Runtime Configurability**: The storage backend can be switched at runtime via configuration without code changes.
- [ ] **Code Quality**: `biomejs` reports zero issues.
- [ ] **Documentation**: All modules and APIs are fully documented with JSDoc.
- [ ] **Performance**: Benchmarks show performance is within 10% of the original (for a comparable in-memory/filesystem task).
- [ ] **Reactivity**: The `GunDBAdapter` correctly streams real-time updates via the `subscribe` method.

## 6. Final File Structure

```
js/
├── CypherNG.js           # Main public entrypoint
├── core/
│   ├── QueryEngine.js
│   ├── GraphProcessor.js
│   └── ResultFormatter.js
├── adapters/
│   ├── DataAdapter.js    # Abstract base class / Interface
│   ├── FilesystemAdapter.js
│   ├── RedisAdapter.js
│   └── GunDBAdapter.js
├── utils/
│   ├── ConfigManager.js
│   ├── Logger.js
│   └── CircuitBreaker.js
└── tests/
    ├── parity.test.js      # Functional equivalence tests
    ├── integration/        # Multi-component tests
    └── adapters/           # Unit tests for each adapter
```
