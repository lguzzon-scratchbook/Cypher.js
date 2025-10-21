# CypherNG.js: Graph-Focused Modular Refactoring with Pluggable Data Layer

**Date**: 2025-01-21  
**Objective**: Refactor `js/Cypher.js` into a functionally identical but modular `js/CypherNG.js` with a pluggable data layer supporting multiple storage backends (in-memory, filesystem, Redis, GunDB).

---

## 1. Core Concept

The **DataAdapter** layer is responsible **exclusively** for managing graph data:

- **Nodes** with IDs, labels, and properties
- **Relationships** with IDs, types, and properties
- **Indexes** for efficient lookups (by label, type, property, node connections)

Query parsing, execution planning, pattern matching, aggregations, and result formatting remain in the **QueryEngine** layer and are **not modified** by the adapter.

### Responsibility Boundary

| Responsibility | DataAdapter | QueryEngine | GraphProcessor |
|---|---|---|---|
| Store nodes/relationships | ✓ | — | — |
| Create/update/delete graph data | ✓ | — | — |
| Index by label/type/property | ✓ | — | — |
| Parse Cypher syntax | — | ✓ | — |
| Plan query execution | — | ✓ | — |
| Fetch data for pattern matching | — | — | ✓ |
| Filter/join/aggregate results | — | — | ✓ |
| Format output | — | — | ✓ |

---

## 2. Data Model

### GraphNode (Internal)

```javascript
{
  id: number,                    // Globally unique node ID
  labels: Set<string>,           // {"Person", "User", ...}
  properties: Map<string, any>   // {"name": "Alice", "age": 30}
}
```

### GraphRelationship (Internal)

```javascript
{
  id: number,                    // Globally unique relationship ID
  type: string,                  // "KNOWS", "FOLLOWS", etc.
  fromNodeId: number,            // Source node ID
  toNodeId: number,              // Target node ID
  properties: Map<string, any>   // {"since": 2020, "weight": 0.8}
}
```

### Index Structures (Adapter-specific)

Each adapter maintains:

- **Label Index**: `Map(label → Set[nodeIds])`
- **Type Index**: `Map(type → Set[relIds])`
- **Property Index** (optional): `Map(propertyKey → Map(value → Set[nodeIds|relIds]))`
- **Adjacency Index**: `Map(fromNodeId → Map(toNodeId → [relIds]))`

---

## 3. Abstract DataAdapter Interface

All storage plugins **must** implement this contract. All methods are **async**.

```javascript
/**
 * @abstract
 * @description Defines the contract for all storage backend adapters.
 * All methods MUST be async (return Promise).
 */
class DataAdapter {
  /**
   * Initialize connection to the data source.
   * @param {Object} config - Adapter-specific configuration
   * @throws {AdapterError} If connection fails
   * @example
   * await adapter.connect({ host: 'localhost', port: 6379 })
   */
  async connect(config) { throw new Error('Not implemented'); }

  /**
   * Gracefully disconnect from the data source.
   * @returns {Promise<void>}
   * @throws {AdapterError} If disconnection fails
   */
  async disconnect() { throw new Error('Not implemented'); }

  // ==================== Query Methods ====================

  /**
   * Get a single node by ID.
   * @param {number} nodeId
   * @returns {Promise<GraphNode|null>}
   */
  async getNodeById(nodeId) { throw new Error('Not implemented'); }

  /**
   * Get a single relationship by ID.
   * @param {number} relationshipId
   * @returns {Promise<GraphRelationship|null>}
   */
  async getRelationshipById(relationshipId) { throw new Error('Not implemented'); }

  /**
   * Get all nodes with a specific label.
   * @param {string} label
   * @returns {Promise<GraphNode[]>}
   */
  async getNodesByLabel(label) { throw new Error('Not implemented'); }

  /**
   * Get nodes filtered by property key-value pair.
   * @param {string} key - Property key
   * @param {any} value - Property value
   * @returns {Promise<GraphNode[]>}
   */
  async getNodesByProperty(key, value) { throw new Error('Not implemented'); }

  /**
   * Get all relationships of a specific type.
   * @param {string} type - Relationship type
   * @returns {Promise<GraphRelationship[]>}
   */
  async getRelationshipsByType(type) { throw new Error('Not implemented'); }

  /**
   * Get all relationships between two nodes (both directions).
   * @param {number} fromNodeId
   * @param {number} toNodeId
   * @returns {Promise<GraphRelationship[]>}
   */
  async getRelationshipsBetween(fromNodeId, toNodeId) { throw new Error('Not implemented'); }

  /**
   * Get outgoing relationships from a node.
   * @param {number} nodeId
   * @returns {Promise<GraphRelationship[]>}
   */
  async getOutgoingRelationships(nodeId) { throw new Error('Not implemented'); }

  /**
   * Get incoming relationships to a node.
   * @param {number} nodeId
   * @returns {Promise<GraphRelationship[]>}
   */
  async getIncomingRelationships(nodeId) { throw new Error('Not implemented'); }

  /**
   * Get all nodes in the graph.
   * @returns {Promise<GraphNode[]>}
   */
  async getAllNodes() { throw new Error('Not implemented'); }

  /**
   * Get all relationships in the graph.
   * @returns {Promise<GraphRelationship[]>}
   */
  async getAllRelationships() { throw new Error('Not implemented'); }

  // ==================== Mutation Methods ====================

  /**
   * Create a new node and assign it an ID.
   * @param {Omit<GraphNode, 'id'>} graphNode - Node without ID
   * @returns {Promise<GraphNode>} - Node with assigned ID
   * @throws {AdapterError} If creation fails
   */
  async createNode(graphNode) { throw new Error('Not implemented'); }

  /**
   * Create a new relationship and assign it an ID.
   * @param {Omit<GraphRelationship, 'id'>} graphRel - Relationship without ID
   * @returns {Promise<GraphRelationship>} - Relationship with assigned ID
   * @throws {AdapterError} If creation fails
   */
  async createRelationship(graphRel) { throw new Error('Not implemented'); }

  /**
   * Update node properties (merge/set semantics).
   * @param {number} nodeId
   * @param {Map<string, any>} properties - Properties to merge
   * @returns {Promise<void>}
   * @throws {AdapterError} If node not found or update fails
   */
  async updateNodeProperties(nodeId, properties) { throw new Error('Not implemented'); }

  /**
   * Update relationship properties (merge/set semantics).
   * @param {number} relationshipId
   * @param {Map<string, any>} properties - Properties to merge
   * @returns {Promise<void>}
   * @throws {AdapterError} If relationship not found or update fails
   */
  async updateRelationshipProperties(relationshipId, properties) { throw new Error('Not implemented'); }

  /**
   * Add a label to a node.
   * @param {number} nodeId
   * @param {string} label
   * @returns {Promise<void>}
   */
  async addNodeLabel(nodeId, label) { throw new Error('Not implemented'); }

  /**
   * Delete a node and all connected relationships.
   * @param {number} nodeId
   * @returns {Promise<void>}
   * @throws {AdapterError} If node not found or deletion fails
   */
  async deleteNode(nodeId) { throw new Error('Not implemented'); }

  /**
   * Delete a relationship.
   * @param {number} relationshipId
   * @returns {Promise<void>}
   * @throws {AdapterError} If relationship not found or deletion fails
   */
  async deleteRelationship(relationshipId) { throw new Error('Not implemented'); }

  // ==================== Utility Methods ====================

  /**
   * Allocate and return the next available node ID.
   * @returns {Promise<number>}
   */
  async getNextNodeId() { throw new Error('Not implemented'); }

  /**
   * Allocate and return the next available relationship ID.
   * @returns {Promise<number>}
   */
  async getNextRelationshipId() { throw new Error('Not implemented'); }

  /**
   * Clear all graph data (wipe the database).
   * @returns {Promise<void>}
   */
  async clear() { throw new Error('Not implemented'); }

  /**
   * Subscribe to changes on the graph (real-time updates).
   * Only required for reactive backends (GunDB).
   * @param {Function} callback - Called with (event, data) when changes occur
   * @returns {Function} - Unsubscribe function
   * @example
   * const unsubscribe = await adapter.subscribe((event, data) => {
   *   if (event === 'nodeCreated') console.log('New node:', data);
   * });
   * unsubscribe(); // Stop listening
   */
  subscribe(callback) { return () => {}; }
}
```

---

## 4. Core Modules

### 4.1 QueryParser.js

- **Responsibility**: Tokenize and parse Cypher syntax into an AST
- **Input**: Query string
- **Output**: AST (operation tree)
- **No data access**: Pure parsing logic

### 4.2 ExecutionPlanner.js

- **Responsibility**: Convert AST into an execution plan
- **Input**: AST
- **Output**: Execution plan with operation sequence
- **No data access**: Pure planning logic

### 4.3 GraphProcessor.js (`<100 lines`)

- **Responsibility**: Execute query plan using the adapter
- **Input**: Execution plan + DataAdapter instance
- **Flow**:
  1. For each operation (MATCH, CREATE, DELETE):
     - Call adapter methods to fetch/mutate data
     - Perform in-memory pattern matching (joins, filters)
  2. Aggregate results
  3. Return result set
- **Data Access**: Via adapter only

### 4.4 ResultFormatter.js

- **Responsibility**: Format adapter results into Cypher result objects
- **Input**: Raw result set from GraphProcessor
- **Output**: Formatted results (nodes, relationships, paths)

### 4.5 CypherNG.js (Main Entrypoint)

- **Responsibility**: Wire all components together
- **Constructor**: Accepts `adapter: DataAdapter`
- **Public API**: Mirrors original `Cypher.js`
  - `.execute(query, successCallback, errorCallback)`
  - `.addGraph(nodes, relationships)`
  - `.resetDatabase()`
- **Flow**: Query → Parser → Planner → GraphProcessor → ResultFormatter

---

## 5. Implementation Roadmap

### Phase 1: Core Abstraction (Weeks 1–2)

1. **Define DataAdapter** (`js/adapters/DataAdapter.js`)
   - Abstract base class with full JSDoc
   - All methods async

2. **Implement InMemoryAdapter** (`js/adapters/InMemoryAdapter.js`)
   - Extend `DataAdapter`
   - Use Maps for node/relationship storage
   - Implement label, type, property indexes
   - Wrap sync operations in Promises for API consistency

3. **Extract/Create Core Modules**
   - **QueryParser.js**: Extract parsing logic from original Cypher.js
   - **ExecutionPlanner.js**: Extract execution planning logic
   - **GraphProcessor.js**: Implement to orchestrate adapter calls + pattern matching
   - **ResultFormatter.js**: Format results for output

4. **Create CypherNG.js**
   - Constructor: `new CypherNG(adapter)`
   - Wire all components
   - Expose public API matching original

5. **Create Parity Test Suite** (`tests/parity.test.js`)
   - Port all relevant tests from `js/Cypher.test.js`
   - Test with InMemoryAdapter
   - All tests must pass

### Phase 2: Persistent Storage (Weeks 3–4)

6. **FilesystemAdapter** (`js/adapters/FilesystemAdapter.js`)
   - Store nodes/relationships in JSON files
   - Atomic writes: write to temp → rename
   - Load indexes in memory on `connect()`
   - Pass all parity tests

7. **RedisAdapter** (`js/adapters/RedisAdapter.js`)
   - Data model:
     - Node: hash `node:{id}` → {labels, properties}
     - Relationship: hash `rel:{id}` → {type, fromNodeId, toNodeId, properties}
     - Indexes: sets `label:{name}`, `type:{name}`
   - Connection pooling (5–10 connections)
   - Transactions (MULTI/EXEC)
   - Resilience: exponential backoff, circuit breaker
   - Pass all parity tests

8. **GunDBAdapter** (`js/adapters/GunDBAdapter.js`)
   - Leverage GunDB document graph
   - Implement `subscribe()` for real-time updates
   - Sync across peers
   - Pass all parity tests + subscription tests

### Phase 3: Infrastructure & Polish (Week 5)

9. **Utilities**
   - **ConfigManager.js**: Load adapter config, plugin registry
   - **Logger.js**: debug/info/warn/error levels
   - **CircuitBreaker.js**: Failover for network adapters

10. **Error Handling**
    - Custom error types: `AdapterError`, `QueryError`, `ConnectivityError`
    - Graceful degradation

11. **Code Quality**
    - Run `bunx @biomejs/biome check --write` on all modules
    - Ensure each module ≤100 lines
    - 100% JSDoc coverage: `@param`, `@returns`, `@throws`, `@example`

12. **Performance Benchmarks**
    - Latency comparison across adapters
    - Memory footprint
    - Ensure within 10% of original Cypher.js

---

## 6. Target File Structure

```
js/
├── CypherNG.js                    # Main entry point (drop-in replacement)
├── core/
│   ├── QueryParser.js             # Parse Cypher → AST
│   ├── ExecutionPlanner.js        # AST → execution plan
│   ├── GraphProcessor.js          # Execute plan with adapter
│   └── ResultFormatter.js         # Format results
├── adapters/
│   ├── DataAdapter.js             # Abstract base class
│   ├── InMemoryAdapter.js         # For testing
│   ├── FilesystemAdapter.js       # JSON persistence
│   ├── RedisAdapter.js            # Redis backend
│   ├── GunDBAdapter.js            # Real-time GunDB
│   └── index.js                   # Barrel exports
├── utils/
│   ├── ConfigManager.js           # Config & plugin registry
│   ├── Logger.js                  # Logging utility
│   └── CircuitBreaker.js          # Resilience pattern
└── tests/
    ├── parity.test.js             # Functional parity (all adapters)
    ├── adapters/
    │   ├── InMemory.test.js       # Unit tests
    │   ├── Filesystem.test.js
    │   ├── Redis.test.js
    │   └── GunDB.test.js
    └── integration/
        └── adapter-lifecycle.test.js
```

---

## 7. Technical Mandates

- **Language**: Pure ES2025 JavaScript (private fields `#`, async/await, async generators)
- **No TypeScript**: JavaScript only
- **No external runtime dependencies**: Existing D3.js and jQuery remain for UI only
- **Code Quality**: All code must pass `biomejs check --write` with zero violations
- **Modularity**: Each module ≤100 lines (JSDoc + code combined)
- **Documentation**: 100% JSDoc coverage with `@param`, `@returns`, `@throws`, `@example`
- **Dependency Injection**: Adapters injected into components, no global state
- **Async First**: All adapter methods are async, promoting scalability

---

## 8. Success Criteria

✓ **Functional Parity**: `CypherNG.js` passes all parity tests with every adapter (InMemory, Filesystem, Redis, GunDB)  
✓ **Graph Abstraction**: DataAdapter handles only graph data (nodes, relationships, indexes); query logic untouched  
✓ **Filesystem Persistence**: FilesystemAdapter with atomic writes (no corruption on crash)  
✓ **Redis Backend**: RedisAdapter with connection pooling, transactions, and resilience  
✓ **Real-Time Sync**: GunDBAdapter with subscription support for reactive updates  
✓ **Runtime Configuration**: Storage backend switchable via config without code changes  
✓ **Code Quality**: Zero biomejs violations across all modules  
✓ **Documentation**: 100% JSDoc coverage with examples  
✓ **Performance**: Query latency within 10% of original Cypher.js  
✓ **All Modules**: ≤100 lines each  

---

## 9. Glossary

- **DataAdapter**: Abstract interface for graph storage backends
- **GraphNode**: Internal node representation (id, labels, properties)
- **GraphRelationship**: Internal relationship representation (id, type, fromNodeId, toNodeId, properties)
- **QueryEngine**: Parser + Planner (unchanged from original)
- **GraphProcessor**: Orchestrator using adapter to fetch/filter data
- **Parity Tests**: Tests verifying CypherNG behaves identically to original Cypher.js
- **Atomic Write**: Write operation guaranteed to complete fully or not at all (no partial state)
- **Connection Pooling**: Reuse of database connections to reduce overhead
- **Circuit Breaker**: Resilience pattern to fail fast and prevent cascading failures

---

## 10. Notes & Rationale

1. **Why Async for InMemoryAdapter?**: Ensures all adapters have consistent interfaces and prepares for scalability to distributed backends.

2. **Why Graph-Only DataAdapter?**: Query parsing, planning, and aggregation are query concerns. Separating them ensures adapters remain simple and swappable.

3. **Why Atomic Writes for Filesystem?**: Prevents data corruption if process crashes mid-write; critical for production use.

4. **Why Connection Pooling for Redis?**: Reduces connection overhead and prevents resource exhaustion under load.

5. **Why GunDB?**: Provides real-time, peer-to-peer graph sync without central server; demonstrates reactive capabilities.

---

## Appendix: DataAdapter Implementation Checklist

For each new adapter, verify:

- [ ] Extends `DataAdapter`
- [ ] All methods return Promises (even if sync internally)
- [ ] Error handling: throws `AdapterError` on failures
- [ ] Indexes maintained: labels, types, properties
- [ ] ID generation: `getNextNodeId()`, `getNextRelationshipId()`
- [ ] Cleanup: `deleteNode()` removes all connected relationships
- [ ] Tests pass: Full parity test suite
- [ ] JSDoc complete: All public methods documented
- [ ] Module size: ≤100 lines

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-21  
**Status**: Ready for Implementation Phase 1
