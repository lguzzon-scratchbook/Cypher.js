# Implementation Plan: CypherNG Refactor

## Progress Checklist

- [ ] Step 1: Project setup (Bun, BiomeJS, test config)
- [ ] Step 2: Create module skeleton and exports
- [ ] Step 3: Implement core data structures (Node, Relationship, Graph)
- [ ] Step 4: Migrate utility functions (StringRecoder, IDFactory)
- [ ] Step 5: Implement GraphEngine core
- [ ] Step 6: Implement QueryExecutor
- [ ] Step 7: Implement QueryParser
- [ ] Step 8: Implement ExpressionEvaluator
- [ ] Step 9: Implement query operators (MATCH, RETURN, etc.)
- [ ] Step 10: Create main CypherNG class
- [ ] Step 11: Add storage adapter infrastructure
- [ ] Step 12: Set up test infrastructure
- [ ] Step 13: Create shared behavioral tests
- [ ] Step 14: Achieve 80% test coverage
- [ ] Step 15: Configure biomejs and final build

---

## Step 1: Project Setup

**Objective**: Initialize project with Bun.js, BiomeJS, and test configuration.

**Implementation Guidance**:
- Initialize Bun project: `bun init -y`
- Install BiomeJS: `bun add -d @biomejs/biome`
- Create `biome.json` configuration
- Create `bunfig.toml` with test and coverage settings
- Update `package.json` with proper exports, type:module

**Test Requirements**:
- Verify `bun test` runs
- Verify BiomeJS linting works

**Integration Notes**:
- Run `bun test` to confirm test infrastructure works
- Run BiomeJS to confirm linting works

**Demo Description**:
- Running `bun test` shows test infrastructure ready
- Running `biome check js/` shows linting ready

---

## Step 2: Module Skeleton

**Objective**: Create module directory structure and exports.

**Implementation Guidance**:
- Create directory structure: src/core, src/data, src/storage, src/utils
- Create src/index.js with exports
- Create placeholder modules for each component
- Set up package.json exports field for ESM/CJS dual support

**Test Requirements**:
- Verify imports work: `import { CypherNG } from 'cypherng'`

**Integration Notes**:
- Build should produce both ESM and CJS outputs

**Demo Description**:
- Project structure visible with organized modules

---

## Step 3: Data Structures

**Objective**: Implement core data structures from original code.

**Implementation Guidance**:
- Create `src/data/Node.js` — Node class with id, labels, properties
- Create `src/data/Relationship.js` — Relationship class with id, type, startNodeId, endNodeId, properties
- Create `src/data/Graph.js` — Graph container with nodes and relationships
- Create `src/data/QueryResult.js` — Result structure

**Test Requirements**:
- Unit tests for each data structure
- Verify serialization/deserialization

**Integration Notes**:
- Will be used by GraphEngine

**Demo Description**:
- `new Node()`, `new Relationship()`, `new Graph()` work correctly

---

## Step 4: Utility Functions

**Objective**: Migrate StringRecoder and IDFactory from original.

**Implementation Guidance**:
- Create `src/utils/StringRecoder.js` — Trie-based string compression
- Create `src/utils/IDFactory.js` — Sequential ID generation
- Create `src/utils/index.js` — Export utilities
- Convert to ES2020+ syntax (const/let,箭头函数)

**Test Requirements**:
- Test StringRecoder with various inputs
- Test IDFactory for sequential IDs
- Verify behavior matches original

**Integration Notes**:
- Used internally by GraphEngine

**Demo Description**:
- StringRecoder correctly compresses strings to integers
- IDFactory generates sequential IDs starting from 0

---

## Step 5: GraphEngine Core

**Objective**: Implement core graph operations.

**Implementation Guidance**:
- Create `src/core/GraphEngine.js`
- Implement node creation, lookup, deletion
- Implement relationship creation, lookup, traversal
- Implement label-based and property-based queries
- Use StringRecoder for internal string optimization
- Migrate logic from original Data.DB class

**Test Requirements**:
- Test node CRUD operations
- Test relationship CRUD operations
- Test graph traversal

**Integration Notes**:
- Core of the query execution

**Demo Description**:
- GraphEngine can manage nodes and relationships
- Can query by ID, label, property

---

## Step 6: QueryExecutor

**Objective**: Implement query execution orchestration.

**Implementation Guidance**:
- Create `src/core/QueryExecutor.js`
- Coordinate parsing, execution, and result building
- Handle both callback and Promise-based execution
- Manage graph state through query execution

**Test Requirements**:
- Integration tests with GraphEngine

**Integration Notes**:
- Called by CypherNG.execute()

**Demo Description**:
- QueryExecutor processes queries and returns results

---

## Step 7: QueryParser

**Objective**: Implement Cypher query parsing.

**Implementation Guidance**:
- Create `src/core/QueryParser.js`
- Parse Cypher syntax (MATCH, CREATE, MERGE, RETURN, etc.)
- Build abstract syntax tree (AST) for execution
- Converted from original parsing logic

**Test Requirements**:
- Test parsing of key query types
- Verify AST generation

**Integration Notes**:
- Called by QueryExecutor

**Demo Description**:
- Input: `'MATCH (n) RETURN n'`
- Output: Parsed AST structure

---

## Step 8: ExpressionEvaluator

**Objective**: Implement expression and function evaluation.

**Implementation Guidance**:
- Create `src/core/ExpressionEvaluator.js`
- Handle literal values, property access, function calls
- Implement CASE expressions, aggregates
- Implement mathematical and string functions

**Test Requirements**:
- Test expression evaluation
- Test function execution

**Integration Notes**:
- Used by QueryExecutor during execution

**Demo Description**:
- `evaluate('1 + 1')` returns `2`
- `evaluate('toUpper("hello")')` returns `"HELLO"`

---

## Step 9: Query Operators

**Objective**: Implement Cypher query operators.

**Implementation Guidance**:
- Create `src/core/operators/` directory
- Implement MATCH, OPTIONAL MATCH
- Implement CREATE, MERGE
- Implement RETURN, ORDER BY, LIMIT, SKIP
- Implement WITH, UNWIND
- Implement LOAD CSV
- Implement aggregate functions: COUNT, SUM, AVG, MIN, MAX, COLLECT
- Migrate from original query handling

**Test Requirements**:
- Test each operator independently
- Integration tests for operator combinations

**Integration Notes**:
- Used by QueryExecutor

**Demo Description**:
- All 50+ test queries from Cypher.test.js should execute

---

## Step 10: Main CypherNG Class

**Objective**: Create the main public API class.

**Implementation Guidance**:
- Create `src/CypherNG.js`
- Implement execute() method matching original API
- Implement executeAsync() Promise-based alternative
- Delegate to QueryExecutor
- Maintain API compatibility with original

**Test Requirements**:
- API tests matching original behavior

**Integration Notes**:
- Main entry point for users

**Demo Description**:
```javascript
const cypher = new CypherNG();
cypher.execute('RETURN 1', (results) => console.log(results));
```

---

## Step 11: Storage Adapter Infrastructure

**Objective**: Set up persistence layer infrastructure.

**Implementation Guidance**:
- Create `src/storage/Adapter.js` — Base interface
- Create `src/storage/Registry.js` — Provider registry
- Create adapter placeholders: LocalStorageAdapter, IndexedDBAdapter, FileSystemAdapter
- Integrate with CypherNG class

**Test Requirements**:
- Adapter interface tests
- Registry tests

**Integration Notes**:
- Prepare for future storage implementation

**Demo Description**:
- Registry can register and retrieve adapters
- CypherNG can accept storage adapter

---

## Step 12: Test Infrastructure

**Objective**: Set up comprehensive test infrastructure.

**Implementation Guidance**:
- Create `tests/shared/` directory
- Create `tests/cypher/` directory
- Create `tests/cypherng/` directory
- Configure bunfig.toml for coverage
- Set up test utilities

**Test Requirements**:
- All infrastructure tests pass

**Integration Notes**:
- Foundation for test implementation

**Demo Description**:
- `bun test` runs with coverage
- Coverage report shows 0% (no tests yet)

---

## Step 13: Shared Behavioral Tests

**Objective**: Create tests validating behavioral parity.

**Implementation Guidance**:
- Copy queries from `js/Cypher.test.js` to shared tests
- Create tests that run against both implementations
- Compare results for exact match
- Test graph operations, queries, edge cases

**Test Requirements**:
- Tests fail if behavioral parity broken
- 50+ query tests from original must pass

**Integration Notes**:
- Most critical: ensure parity with original

**Demo Description**:
- Both Cypher.js and CypherNG.js produce identical outputs for all test queries

---

## Step 14: Achieve 80% Coverage

**Objective**: Add tests to reach 80% code coverage.

**Implementation Guidance**:
- Run `bun test --coverage` to identify gaps
- Add unit tests for uncovered modules
- Add edge case tests
- Ensure all critical paths covered

**Test Requirements**:
- Coverage shows >= 80%
- All tests pass

**Integration Notes**:
- May require implementation adjustments

**Demo Description**:
- Coverage report shows >= 80% line coverage

---

## Step 15: Final Configuration

**Objective**: Configure BiomeJS and final build.

**Implementation Guidance**:
- Run BiomeJS on all code: `biome check --write`
- Ensure code passes all linting rules
- Final review of test results
- Document design decisions

**Test Requirements**:
- BiomeJS passes
- All tests pass
- Coverage maintained at >= 80%

**Integration Notes**:
- Final polish before completion

**Demo Description**:
- Code is lint-free
- Project ready for use

---

## Summary

This plan provides incremental, testable progress toward the refactored CypherNG implementation. Each step builds on previous steps, with regular integration points to ensure the refactored code maintains behavioral parity with the original.

Key milestones:
- Step 5-9: Core functionality implemented (~60% of implementation effort)
- Step 10: Main API complete, functional prototype
- Step 13: Behavioral parity achieved (critical milestone)
- Step 14: Test coverage target met
- Step 15: Production-ready delivery