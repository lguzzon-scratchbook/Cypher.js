# Cypher.js Architecture

## Overview

Cypher.js is a JavaScript implementation of the Neo4j Cypher query language that runs entirely in the browser or Node.js environment. It provides a complete graph database query engine and visualization system with zero external dependencies.

## Project Structure

```
Cypher.js/
├── index.html              # Main web interface demo
├── js/
│   ├── Cypher.js          # Core query engine (unminified)
│   ├── Cypher.min.js      # Production query engine (minified)
│   ├── Cypher.test.js     # Unit tests
│   ├── GraphViewer.js     # D3.js-based graph visualization
│   └── debugger.js        # Debug utilities
├── css/
│   ├── web.css            # Main web interface styles
│   └── graph.css          # Graph visualization styles
├── other_js/
│   ├── d3.min.js          # D3.js library (forked/customized)
│   └── jquery.min.js      # jQuery library
├── scripts/
│   └── FoodTalk.cql       # Example prompt chaining script
├── misc/                  # Miscellaneous assets
├── node/                  # Node.js specific files
├── .github/               # GitHub workflows and templates
├── README.md              # Project documentation
└── LICENSE                # GPL v3 license
```

## Core Architecture Components

### 1. Query Engine (js/Cypher.js)

The heart of the system, implementing the complete Cypher query language parser and execution engine.

**Key Modules:**

- **StringRecoder**: Optimizes string storage using trie-based encoding
- **IDFactory**: Generates unique identifiers for nodes and relationships
- **DB**: In-memory graph database with optimized lookup structures
- **Parser**: Tokenizes and parses Cypher query syntax
- **Executor**: Executes parsed queries against the in-memory database

**Data Structures:**

- Nodes stored in arrays with ID-based lookup
- Relationships maintained in bidirectional adjacency lists
- Label-based indexing for efficient node filtering
- Type-based relationship indexing

### 2. Web Worker Architecture

The engine supports both synchronous and asynchronous execution via Web Workers:

```
Main Thread
    ├── UI Management (query input, output display)
    ├── Web Worker Communication (for heavy queries)
    └── Results Processing

Web Worker Thread
    ├── Cypher.js Engine
    ├── Query Parser
    └── Query Executor
```

### 3. Graph Visualization (js/GraphViewer.js)

Built on D3.js for interactive graph visualization:

- Force-directed layout algorithms
- Node and relationship rendering
- Interactive zoom and pan
- Click-to-focus functionality
- Dynamic styling based on node labels and properties

### 4. Web Interface (index.html)

Complete browser-based development environment:

- Query editor with syntax highlighting support
- Real-time query execution
- Dual output modes (table/graph)
- Query history and timing information
- URL-based query sharing
- Responsive design

## Query Processing Pipeline

```
1. Input Query String
   ↓
2. Lexer/Tokenizer (breaks into tokens)
   ↓
3. Parser (AST generation)
   ↓
4. Execution Planner (optimizes execution strategy)
   ↓
5. Executor (runs against in-memory database)
   ↓
6. Results Formatter (structures output)
   ↓
7. UI Renderer (table/graph display)
```

## Key Design Principles

### Zero Dependencies

- Self-contained implementation with no external runtime dependencies
- Minimal external libraries (D3.js, jQuery) only for UI/visualization
- Works in browsers and Node.js environments

### Performance Optimizations

- String compression via trie encoding
- Index-based node/relationship lookups
- Lazy evaluation where possible
- Web Worker parallelization for CPU-intensive operations

### Memory Management

- Efficient data structures for in-memory storage
- Garbage collection-friendly object patterns
- Memory pooling for frequently created objects

## Supported Cypher Features

### Node Operations

- CREATE, MERGE, MATCH
- Property assignment
- Label-based filtering
- WHERE clauses with complex conditions

### Relationship Operations  

- Relationship creation with types and properties
- Variable-length path matching (1..n)
- Directional and undirectional relationships

### Data Manipulation

- SET, REMOVE, DELETE
- UNWIND for array expansion
- WITH for result chaining
- ORDER BY, LIMIT, SKIP

### Aggregation and Functions

- COUNT, SUM, AVG, MIN, MAX
- String functions (STARTS WITH, ENDS WITH, CONTAINS)
- Mathematical operations
- COALESCE, EXISTS

### Advanced Features

- Path expressions and pattern matching
- Subqueries
- Conditional expressions
- List operations and comprehensions

## Extension Points

### Custom Functions

The engine supports adding custom functions through the extension API.

### Custom Aggregators

New aggregation functions can be registered with the execution engine.

### Visualization Customization

GraphViewer.js can be extended with custom renderers and layouts.

## Browser Compatibility

- Modern browsers with ES5+ support
- Web Worker API for async processing
- Canvas/SVG support for visualization
- LocalStorage for optional persistence

## Security Considerations

- No external network requests within core engine
- Input validation against injection attacks
- Sandboxed execution environment via Web Workers
- Safe for client-side query execution

## Performance Characteristics

Query execution time scales with:

- Number of matched nodes/relationships
- Complexity of WHERE clauses
- Path traversal depth
- Aggregation operations

Typical performance for common operations:

- Simple node lookup: < 1ms
- Pattern matching on 1K nodes: 1-10ms  
- Complex joins/aggregations: 10-100ms
- Large graph traversal: 100-1000ms

## Development Workflow

1. Modify `js/Cypher.js` for engine changes
2. Update `js/Cypher.test.js` with tests
3. Use `index.html` for interactive testing
4. Minify with build tools for production
5. Test in both browser and Node.js environments

The architecture demonstrates a complete, production-grade graph database implementation in JavaScript, suitable for educational purposes, prototyping, and embedded graph query functionality.
