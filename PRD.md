# PRD: Refactor Cypher.js to CypherNG.js

## Overview

Refactor `js/Cypher.js` into `js/CypherNG.js` with improved architecture focused on correctness, clarity, and long-term maintainability. The refactoring involves splitting the monolithic codebase into manageable functional modules while ensuring full behavioral parity with the original implementation. A comprehensive test suite achieving 80% code coverage must be created, with shared test cases validating both implementations. The architecture should be designed tofacilitate future persistence layer integration.

## Goals

- Improve code correctness, clarity, and maintainability through modular architecture
- Achieve 80%+ code coverage with shared test suite validating both Cypher.js and CypherNG.js
- Ensure full behavioral parity between legacy and refactored implementations
- Design architecture with clean separation of concerns for future persistence integration
- Support both browser and Node.js environments via JSDoc-compatible code

## Quality Gates

These commands must pass for every user story:

- `bun run typecheck` - Type checking (if available)
- `bun run lint` - Linting

For UI/Integration stories, also include:

- Verify in browser using dev-browser skill

## User Stories

### US-001: Analyze existing Cypher.js implementation

**Description:** As a developer, I want to understand the full scope and behavior of the existing Cypher.js implementation so that I can accurately plan the refactoring.

**Acceptance Criteria:**

- [ ] Document all public API methods in Cypher.js
- [ ] Identify all behavioral patterns that must be preserved
- [ ] Map out current dependencies and internal structures
- [ ] Review existing test cases for behavioral requirements

### US-002: Design modular architecture for CypherNG

**Description:** As a developer, I want a modular architecture design that separates concerns and facilitates future persistence integration.

**Acceptance Criteria:**

- [ ] Define module structure (functional modules)
- [ ] Document persistence-agnostic interfaces
- [ ] Identify separation points for future persistence layer
- [ ] Create integration points documentation

### US-003: Implement core data structures module

**Description:** As a developer, I want core data structures (nodes, relationships, DB) implemented in separate modules.

**Acceptance Criteria:**

- [ ] Implement Node class/module
- [ ] Implement Relationship class/module
- [ ] Implement Database class/module
- [ ] Ensure API compatibility with Cypher.js

### US-004: Implement query parser module

**Description:** As a developer, I want a modular query parser that handles Cypher query parsing.

**Acceptance Criteria:**

- [ ] Implement query parsing logic in separate module
- [ ] Support all query types from existing implementation
- [ ] Maintain parsing behavior parity with Cypher.js

### US-005: Implement query execution engine

**Description:** As a developer, I want a query execution engine that processes parsed queries.

**Acceptance Criteria:**

- [ ] Implement match/execution logic
- [ ] Support merge, create, delete operations
- [ ] Handle aggregations and grouping
- [ ] Match execution behavior of Cypher.js

### US-006: Implement return/result handling module

**Description:** As a developer, I want result handling and return value processing in a separate module.

**Acceptance Criteria:**

- [ ] Handle RETURN clauses
- [ ] Process aggregations (count, collect, etc.)
- [ ] Support ORDER BY and LIMIT
- [ ] Match existing result handling behavior

### US-007: Create shared test suite with 80% coverage

**Description:** As a developer, I want a comprehensive test suite that validates both Cypher.js and CypherNG.js with minimum 80% code coverage.

**Acceptance Criteria:**

- [ ] Create test files in js/CypherNG/test/
- [ ] Run same test cases against both implementations
- [ ] Achieve 80%+ code coverage for CypherNG
- [ ] Label version-specific tests clearly
- [ ] Include behavioral equivalence tests

### US-008: Verify behavioral parity between implementations

**Description:** As a developer, I want verification that CypherNG.js produces identical results to Cypher.js.

**Acceptance Criteria:**

- [ ] All existing test cases pass for both implementations
- [ ] Document any edge case differences
- [ ] Provide equivalence test report

### US-009: Add JSDoc documentation for browser compatibility

**Description:** As a developer, I want JSDoc-compliant documentation enabling browser execution.

**Acceptance Criteria:**

- [ ] All public APIs have JSDoc comments
- [ ] Code runs in browser environment
- [ ] Code runs in Node.js environment
- [ ] Include usage examples in JSDoc

### US-0010: Document persistence-ready architecture decisions

**Description:** As a developer, I want documentation of architecture decisions that facilitate future persistence integration.

**Acceptance Criteria:**

- [ ] Document storage abstraction points
- [ ] Document persistence-agnostic interfaces
- [ ] Include decision rationale in code comments
- [ ] Create architecture decision records

## Functional Requirements

- FR-1: CypherNG.js must provide equivalent API to Cypher.js
- FR-2: All existing test queries must produce identical results
- FR-3: Test suite must achieve minimum 80% code coverage
- FR-4: Code must be executable in both browser and Node.js
- FR-5: Architecture must allow persistence layer injection without modifying core logic
- FR-6: Both implementations must pass same test cases
- FR-7: Test files must be located in js/CypherNG/test/
- FR-8: Continue existing CypherNG implementation (build upon partial code)

## Non-Goals

- Implementing actual persistence layer (preparation only)
- Changing core Cypher query language semantics
- Optimization beyond parity requirements
- Adding new query features beyond existing Cypher.js functionality

## Technical Considerations

- Existing partial implementation in js/CypherNG/query/ (ReturnValue.js, GroupBy.js, Setter.js) uses ES6 classes with JSDoc
- Functional module approach aligns with existing partial implementation
- Need to maintain backward compatibility with Cypher.js API
- Test runner should support both browser and Node.js execution
- Code coverage tool needs to support both environments

## Success Metrics

- 80%+ code coverage achieved
- All existing tests pass with identical results
- Both browser and Node.js execution verified
- Architecture documentation complete
- Zero behavioral differences between implementations

## Open Questions

- Should legacy Cypher.js be deprecated after full parity is confirmed?
- What specific persistence adapter interface is needed?
- Should there be a migration path for existing Cypher.js users?

## Dependencies

- Continued from existing js/CypherNG/ structure
- Test framework (need to select appropriate one for bun)
- Code coverage tool compatible with bun
