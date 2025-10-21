# CypherNG Quick Start Guide

## Installation

No additional dependencies required. CypherNG uses only Node.js built-ins.

```bash
# Copy files into your project or use directly
cp -r js/adapters js/
cp -r js/utils js/
cp js/CypherNG.js js/
```

## Basic Example

```javascript
const CypherNG = require('./js/CypherNG');
const InMemoryAdapter = require('./js/adapters/InMemoryAdapter');

async function main() {
  // 1. Create adapter and CypherNG instance
  const adapter = new InMemoryAdapter();
  const cypher = new CypherNG(adapter);

  // 2. Connect
  await cypher.connect({});

  // 3. Add graph data
  const nodes = [
    { id: 0, labels: ['Person'], properties: { name: 'Alice', age: 30 } },
    { id: 1, labels: ['Person'], properties: { name: 'Bob', age: 25 } }
  ];

  const relationships = [
    { 
      id: 0, 
      type: 'KNOWS', 
      fromNodeId: 0, 
      toNodeId: 1, 
      properties: { since: 2020 } 
    }
  ];

  await cypher.addGraph(nodes, relationships);

  // 4. Query the graph
  const people = await adapter.getNodesByLabel('Person');
  console.log(`Found ${people.length} people`);

  const alice = await adapter.getNodeById(0);
  console.log(`Alice is ${alice.properties.get('age')} years old`);

  const knowsRels = await adapter.getRelationshipsByType('KNOWS');
  console.log(`Found ${knowsRels.length} KNOWS relationships`);

  // 5. Traverse relationships
  const outgoing = await adapter.getOutgoingRelationships(0);
  console.log(`Alice has ${outgoing.length} outgoing relationships`);

  // 6. Disconnect
  await cypher.disconnect();
}

main().catch(console.error);
```

## Using Configuration Manager

```javascript
const ConfigManager = require('./js/utils/ConfigManager');
const InMemoryAdapter = require('./js/adapters/InMemoryAdapter');
const CypherNG = require('./js/CypherNG');

const config = new ConfigManager();

// Register adapters
config.registerAdapter('memory', InMemoryAdapter);

// Create instance
const adapter = config.createAdapter('memory');
const cypher = new CypherNG(adapter);

await cypher.connect({});
```

## Using Logger

```javascript
const Logger = require('./js/utils/Logger');

const logger = new Logger('MyApp', 'info');

logger.debug('Debug message');      // Only if level >= debug
logger.info('Info message');        // Always (default level)
logger.warn('Warning message');     // Always
logger.error('Error message');      // Always

// Change level
logger.setLevel('debug');           // Now debug messages appear
```

## Using Circuit Breaker

```javascript
const CircuitBreaker = require('./js/utils/CircuitBreaker');

const breaker = new CircuitBreaker({
  failureThreshold: 5,              // Open after 5 failures
  resetTimeout: 30000,              // Try to recover after 30s
  onStateChange: (old, new_) => {
    console.log(`Circuit: ${old} → ${new_}`);
  }
});

try {
  await breaker.execute(async () => {
    // Your operation here
  });
} catch (error) {
  console.error('Circuit breaker is open');
}

// Reset manually if needed
breaker.reset();
```

## Testing

```bash
# Run adapter tests
node js/tests/adapters.test.js

# Run integration tests
node js/tests/integration.test.js

# Check code quality
bunx @biomejs/biome check js/adapters js/utils js/CypherNG.js
```

## API Reference

### DataAdapter Interface

All adapters implement these methods (all async):

**Queries**:

- `getNodeById(id)` - Get node by ID
- `getNodesByLabel(label)` - Find nodes by label
- `getNodesByProperty(key, value)` - Find nodes by property
- `getRelationshipById(id)` - Get relationship by ID
- `getRelationshipsByType(type)` - Find relationships by type
- `getRelationshipsBetween(fromId, toId)` - Get relationships between nodes
- `getOutgoingRelationships(nodeId)` - Get outgoing edges
- `getIncomingRelationships(nodeId)` - Get incoming edges
- `getAllNodes()` - Get all nodes
- `getAllRelationships()` - Get all relationships

**Mutations**:

- `createNode(graphNode)` - Create node
- `createRelationship(graphRel)` - Create relationship
- `updateNodeProperties(id, props)` - Update node
- `updateRelationshipProperties(id, props)` - Update relationship
- `addNodeLabel(nodeId, label)` - Add label to node
- `deleteNode(id)` - Delete node (cascades)
- `deleteRelationship(id)` - Delete relationship

**Utility**:

- `connect(config)` - Connect to adapter
- `disconnect()` - Disconnect from adapter
- `clear()` - Clear all data
- `getNextNodeId()` - Get next node ID
- `getNextRelationshipId()` - Get next relationship ID

## Creating a Custom Adapter

```javascript
const DataAdapter = require('./js/adapters/DataAdapter');

class MyCustomAdapter extends DataAdapter {
  async connect(config) {
    // Initialize connection
  }

  async getNodeById(nodeId) {
    // Fetch from custom storage
  }

  // ... implement all other methods

  async disconnect() {
    // Cleanup
  }
}

module.exports = MyCustomAdapter;
```

## Graph Data Model

### Node

```javascript
{
  id: number,                    // Globally unique
  labels: Set<string>,           // e.g., {'Person', 'Employee'}
  properties: Map<string, any>   // e.g., {'name': 'Alice', 'age': 30}
}
```

### Relationship

```javascript
{
  id: number,                    // Globally unique
  type: string,                  // e.g., 'KNOWS', 'WORKS_WITH'
  fromNodeId: number,            // Source node ID
  toNodeId: number,              // Target node ID
  properties: Map<string, any>   // e.g., {'since': 2020}
}
```

## Next Steps

- **Phase 2**: Filesystem, Redis, and GunDB adapters
- **Phase 3**: Query engine integration, performance optimization
- See `CYPHERNG_REFACTOR_SPEC.md` for full roadmap
- See `PHASE1_IMPLEMENTATION.md` for detailed implementation notes

## Support

For issues or questions, refer to:

- `CYPHERNG_REFACTOR_SPEC.md` - Architecture and design
- `PHASE1_IMPLEMENTATION.md` - Implementation details
- `js/tests/` - Test examples
