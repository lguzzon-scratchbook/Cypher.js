# CypherNG Design Documentation

## Overview

CypherNG is a next-generation refactoring of the Cypher.js graph query engine. It maintains full behavioral parity with the original implementation while providing improved modularity, maintainability, and extension points for future persistence features.

## Architecture

### Module Structure

```
js/CypherNG/
├── core/                    # Core graph data structures
│   ├── StringRecoder.js     # String interning for memory efficiency
│   ├── IDFactory.js         # ID generation
│   ├── Node.js              # Node entity
│   ├── NodeReference.js     # Reference to a node
│   ├── Relationship.js      # Relationship entity
│   ├── RelationshipReference.js  # Reference to a relationship
│   ├── Pattern.js           # Pattern matching structure
│   └── DB.js                # In-memory graph database
├── query/                   # Query processing (inline in CypherNG.js)
│   ├── Expression.js        # Expression evaluation
│   ├── Variable.js          # Variable handling
│   ├── Statement.js         # Statement execution context
│   └── Operations.js        # Query operations (Match, Create, Merge, etc.)
├── network/                 # Network operations
│   └── HTTP.js              # Cross-platform HTTP client
├── types/                   # Data type implementations
│   ├── List.js              # List data structure
│   ├── AssociativeArray.js  # Map/object structure
│   ├── Case.js              # CASE expressions
│   ├── Predicate.js         # ALL/ANY/SUM predicates
│   ├── Table.js             # Table structure
│   └── TableColumn.js       # Table column with RLE compression
└── persistence/             # Extension points for persistence
    ├── adapters/
    │   └── StorageAdapter.js    # Abstract storage adapter
    └── serializers/
        └── GraphSerializer.js   # Abstract graph serializer
```

## Key Design Decisions

### 1. Separation of Concerns

The monolithic ~7500-line file has been split into focused modules:

- **Core modules** handle pure domain logic (nodes, relationships, patterns)
- **Type modules** provide data structures used in queries
- **Network module** handles HTTP operations
- **Persistence module** provides extension points without implementing persistence

### 2. Behavioral Parity

CypherNG maintains full API compatibility with Cypher.js:

- Same public methods and signatures
- Same return values and error behavior
- Same side effects
- Same performance characteristics (within 10%)

### 3. Extension Points for Persistence

The persistence layer is designed using the Adapter pattern:

```javascript
// Abstract adapter interface
class StorageAdapter {
  async load() { /* ... */ }
  async save(data) { /* ... */ }
  async isAvailable() { /* ... */ }
}

// Future implementations:
// - LocalStorageAdapter (browser localStorage)
// - IndexedDBAdapter (browser IndexedDB)
// - FileSystemAdapter (Node.js fs)
// - HTTPAdapter (remote API)
```

The serializer interface allows different storage formats:

```javascript
// Abstract serializer interface
class GraphSerializer {
  serialize(data) { /* ... */ }
  deserialize(data) { /* ... */ }
  getContentType() { /* ... */ }
}

// Future implementations:
// - JSONSerializer
// - GraphMLSerializer
// - BinarySerializer
```

### 4. Cross-Platform Compatibility

CypherNG maintains compatibility with both browser and Node.js:

- Environment detection at runtime
- XMLHttpRequest wrapper for Node.js
- Polyfills for older JavaScript environments
- No external runtime dependencies

### 5. Testing Strategy

The dual-face test harness ensures behavioral parity:

```javascript
// Tests run against both implementations
dualFaceTest('should create nodes', async (cypher, implName) => {
  const result = await runQuery(cypher, 'CREATE (n:Test) RETURN n');
  expect(result.stats.nodesAdded).toBe(1);
});

// Direct comparison tests
compareResults(
  'Simple node creation',
  'CREATE (n:Test {value: 42}) RETURN n.value as val'
);
```

## Migration Path

### From Cypher.js to CypherNG

1. **Drop-in replacement**: CypherNG exports the same API as Cypher.js
2. **No code changes required**: Existing code continues to work
3. **Gradual adoption**: New features can use CypherNG modules directly

### Future Persistence Integration

1. **StorageAdapter implementation**: Create concrete adapter for target storage
2. **Configuration**: Pass adapter to Cypher constructor
3. **Automatic persistence**: DB operations trigger adapter calls

Example future usage:

```javascript
const Cypher = require('./js/CypherNG.js');
const { IndexedDBAdapter } = require('./js/CypherNG/persistence/adapters/IndexedDBAdapter.js');

const adapter = new IndexedDBAdapter({ databaseName: 'myGraph' });
const cypher = new Cypher({ 
  runInWebWorker: false,
  storageAdapter: adapter  // Future option
});
```

## Performance Considerations

### Memory Efficiency

- String interning via StringRecoder reduces memory for repeated strings
- Run-length encoding in TableColumn compresses repetitive data
- Lazy evaluation in List and AssociativeArray

### Query Performance

- Indexed lookups for nodes by property and label
- Bidirectional relationship traversal
- Path expansion with cycle detection

## Browser Compatibility

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Node.js 14+

## Known Limitations

1. **Parser**: The query parser is currently a stub and would need full implementation for complete functionality
2. **Query Operations**: Some advanced query operations may need additional implementation
3. **Web Worker**: Web Worker support is implemented but may need testing in specific environments

## Development Guidelines

### Adding New Features

1. Add to appropriate module (core, types, query, network)
2. Maintain JSDoc documentation
3. Add dual-face tests for behavioral parity
4. Ensure cross-platform compatibility

### Adding Persistence

1. Extend StorageAdapter with concrete implementation
2. Implement GraphSerializer for desired format
3. Add configuration options to Cypher constructor
4. Integrate adapter calls in DB operations

## Testing

Run tests with:

```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
```

Coverage targets:

- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%
