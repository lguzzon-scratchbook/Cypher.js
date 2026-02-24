# CypherNG Architecture Design

This document describes the modular architecture for CypherNG, designed to facilitate future persistence layer integration while maintaining full behavioral parity with Cypher.js.

## Overview

CypherNG is a refactored version of Cypher.js using ES6 classes with JSDoc annotations for Node.js and browser compatibility. The architecture follows a modular design with clear separation of concerns.

## Module Structure

```
js/CypherNG/
├── core/              # Main entry point and API
├── data/              # Core data structures
├── network/           # Graph traversal and path operations
├── parser/            # Query parsing
├── query/             # Query execution and operations
│   └── operations/    # Query operation implementations
├── types/             # Type system and expressions
├── utils/             # Utility functions
└── persistence/       # Persistence layer (future)
```

### Module Descriptions

#### core/
Main entry point providing the public API. Exports the CypherNG class.
- `CypherNG.js` - Main class, coordinates all modules

#### data/
Core data structures for graph representation.
- `Node.js` - Graph node representation (US-003)
- `Relationship.js` - Graph relationship representation (US-003)
- `Database.js` - Database container managing nodes and relationships (US-003)

#### network/
Graph traversal and path operations.
- `Matcher.js` - Pattern matching for node/relationship queries
- `PathExpansion.js` - Variable-length path expansion (*)

#### parser/
Query parsing layer.
- `Parser.js` - Main query parser
- `Statement.js` - Parsed statement representation

#### query/
Query execution and operations.
- `ReturnValue.js` - Return value handling (partially implemented)
- `GroupBy.js` - GroupBy aggregation using Trie (partially implemented)
- `Variable.js` - Variable reference handling (partially implemented)
- `operations/Setter.js` - SET clause handling

Operations:
- `operations/Match.js` - MATCH clause
- `operations/Create.js` - CREATE clause
- `operations/Merge.js` - MERGE clause
- `operations/Delete.js` - DELETE clause
- `operations/Return.js` - RETURN clause

#### types/
Type system and expressions.
- `Expression.js` - Base expression class
- `BinaryExpression.js` - Binary operators
- `FunctionCall.js` - Function calls
- `Variable.js` - Variable references

#### utils/
Utility functions.
- `StringRecoder.js` - Trie-based string interning

## Persistence-Agnostic Interfaces

CypherNG is designed to be persistence-agnostic, allowing future integration with various storage backends without modifying core query logic.

### Storage Interface

```javascript
/**
 * @interface StorageAdapter
 * Interface for persistence layer integration
 */
class StorageAdapter {
    /**
     * Get node by ID
     * @param {number} id - Node ID
     * @returns {Node|null}
     */
    getNode(id) {}

    /**
     * Get relationship by ID
     * @param {number} id - Relationship ID
     * @returns {Relationship|null}
     */
    getRelationship(id) {}

    /**
     * Find nodes by label
     * @param {string} label - Node label
     * @returns {Node[]}
     */
    findNodesByLabel(label) {}

    /**
     * Find nodes by property
     * @param {string} key - Property key
     * @param {*} value - Property value
     * @returns {Node[]}
     */
    findNodesByProperty(key, value) {}

    /**
     * Get relationships for node
     * @param {number} nodeId - Node ID
     * @param {string} [direction] - 'outgoing' | 'incoming' | 'both'
     * @returns {Relationship[]}
     */
    getRelationships(nodeId, direction) {}

    /**
     * Save node
     * @param {Node} node - Node to save
     */
    saveNode(node) {}

    /**
     * Save relationship
     * @param {Relationship} rel - Relationship to save
     */
    saveRelationship(rel) {}

    /**
     * Delete node
     * @param {number} id - Node ID
     */
    deleteNode(id) {}

    /**
     * Delete relationship
     * @param {number} id - Relationship ID
     */
    deleteRelationship(id) {}

    /**
     * Clear all data
     */
    clear() {}
}
```

### Query Context Interface

```javascript
/**
 * @interface QueryContext
 * Persistence-agnostic query execution context
 */
class QueryContext {
    /**
     * Get current database
     * @returns {Database}
     */
    getDatabase() {}

    /**
     * Get variable by name
     * @param {string} name - Variable name
     * @returns {*}
     */
    getVariable(name) {}

    /**
     * Set variable
     * @param {string} name - Variable name
     * @param {*} value - Variable value
     */
    setVariable(name, value) {}

    /**
     * Register a node for persistence
     * @param {Node} node
     */
    registerNode(node) {}

    /**
     * Register a relationship for persistence
     * @param {Relationship} rel
     */
    registerRelationship(rel) {}
}
```

## Separation Points for Future Persistence Layer

### 1. Storage Abstraction Layer

Location: `js/CypherNG/persistence/`

The Database class will support injection of a StorageAdapter:

```javascript
// In Database.js
class Database {
    constructor(storageAdapter = null) {
        this._storageAdapter = storageAdapter || new InMemoryStorage();
    }

    setStorageAdapter(adapter) {
        this._storageAdapter = adapter;
    }

    getStorageAdapter() {
        return this._storageAdapter;
    }
}
```

### 2. Query Execution Context

The query execution engine operates on an abstraction that doesn't directly access storage:

```javascript
// In query/ExecutionEngine.js
class ExecutionEngine {
    execute(statement, context) {
        // Uses context.getDatabase() which can be backed by any storage
    }
}
```

### 3. Transaction Boundaries

```javascript
/**
 * @interface Transaction
 * Transaction support for atomic operations
 */
class Transaction {
    begin() {}
    commit() {}
    rollback() {}
}

/**
 * @interface TransactionManager
 */
class TransactionManager {
    beginTransaction() {}
    getCurrentTransaction() {}
}
```

## Integration Points

### 1. Entry Point Integration

```javascript
// js/CypherNG/index.js (to be created)
const CypherNG = require('./core/CypherNG');
const Database = require('./data/Database');

/**
 * Create a new CypherNG instance
 * @param {Object} options - Configuration options
 * @param {StorageAdapter} [options.storage] - Custom storage adapter
 * @returns {CypherNG}
 */
function createCypherNG(options = {}) {
    const db = new Database(options.storage);
    return new CypherNG(db, options);
}

module.exports = { createCypherNG, CypherNG, Database };
```

### 2. Custom Storage Adapter Example

```javascript
// js/CypherNG/persistence/RedisStorageAdapter.js (future example)
/**
 * Redis storage adapter for persistence
 * @implements StorageAdapter
 */
class RedisStorageAdapter {
    constructor(redisClient) {
        this._client = redisClient;
    }

    getNode(id) {
        // Implementation
    }

    // ... other methods
}
```

### 3. Module Dependency Graph

```
CypherNG (core)
    └── Database (data)
        ├── Node (data)
        ├── Relationship (data)
        └── StorageAdapter (persistence - optional)
    └── Parser (parser)
        └── Statement (parser)
    └── ExecutionEngine (query)
        ├── Matcher (network)
        ├── PathExpansion (network)
        └── Operations (query)
            ├── Match
            ├── Create
            ├── Merge
            ├── Delete
            ├── Return
            └── Setter
    └── GroupBy (query)
    └── ReturnValue (query)
    └── Variable (types)
    └── Expression (types)
    └── StringRecoder (utils)
```

## Design Patterns Used

### 1. Factory Pattern
Used for creating nodes, relationships, and statements.

### 2. Strategy Pattern
Storage adapters can be swapped without changing query logic.

### 3. Template Method
Query operations follow common execution flow.

### 4. Dependency Injection
Database accepts storage adapter via constructor.

## Backward Compatibility

The architecture maintains full API compatibility with Cypher.js:

```javascript
// Cypher.js API
const cypher = new Cypher(options);
cypher.execute(query, onSuccess, onError);

// CypherNG equivalent
const cypher = createCypherNG(options);
cypher.execute(query).then(onSuccess).catch(onError);
```

## Testing Strategy

- Test files located in `js/CypherNG/test/`
- Shared test cases validate both implementations
- Minimum 80% code coverage required (US-007)

## Environment Support

- Node.js: Uses `module.exports`
- Browser: Uses global `CypherNG` object
- Both via: `if (typeof module !== 'undefined' && module.exports) { module.exports = ... }`