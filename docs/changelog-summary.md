## Clean Changelog Summary

This document summarizes the files added and changed as part of the CypherNG parity and coverage workstream.

## Changed Existing Source File

- `js/CypherNG/query/operations/Load.js`
  - Fixed Node/CommonJS module-path wiring for `Load`
  - Correctly instantiates the HTTP client in the Node path
  - This was the main runtime source edit in the final validation path

## Added Documentation

- `docs/parity-inventory.md`
  - Feature/API inventory comparing legacy `js/Cypher.js` and `js/CypherNG`

- `docs/parity-status.md`
  - Status summary of verified parity coverage and current behavior

- `docs/parity-test-matrix.md`
  - Matrix of covered and uncovered parity areas

- `docs/plans/plan-cypherng-functional-parity.md`
  - Working implementation and validation plan for the parity effort

## Added Parity Test Harness and Parity Tests

### Helpers
- `tests/parity/helpers/engines.js`
  - Shared legacy-vs-NG execution harness

- `tests/parity/helpers/normalizeResult.js`
  - Normalizes result objects for stable parity assertions

### Parity suites
- `tests/parity/basic-read-write.parity.test.js`
  - Core read/write behavior parity

- `tests/parity/relationship-bindings.parity.test.js`
  - Relationship and path binding parity

- `tests/parity/advanced-expressions.parity.test.js`
  - CASE, JSON access, collect distinct, barchart, range, and lookup parity

- `tests/parity/operators.parity.test.js`
  - Arithmetic, set ops, comparisons, logical precedence, and `IN`

- `tests/parity/predicates.parity.test.js`
  - `all`, `any`, `sum`, and empty-list semantics

- `tests/parity/setters.parity.test.js`
  - `SET` property, map, label, and type behavior plus deterministic invalid cases

- `tests/parity/load.parity.test.js`
  - `LOAD JSON`, `LOAD TEXT`, `LOAD CSV WITH HEADERS`, `POST`, and failing request parity

## Added Unit Tests

### Entry/API
- `tests/unit/entry/cypherng-entry.test.js`
  - Direct `CypherNG` entry-point and API behavior

### Network
- `tests/unit/network/network.test.js`
  - `XMLHttpRequestFactory` browser and Node fallback
  - `HTTP.get` and `HTTP.post` success and error branches

### Parser
- `tests/unit/parser/parser-support.test.js`
  - Keyword, operator, function, aggregate, and trie support modules

- `tests/unit/parser/parser-branches.test.js`
  - Parser success and error branches with deterministic parser messages

- `tests/unit/parser/function-evaluations.test.js`
  - Scalar function evaluations and edge branches

- `tests/unit/parser/aggregate-and-predicate.test.js`
  - Aggregate behavior and predicate behavior

### Query layer
- `tests/unit/query/query-core.test.js`
  - `Statement`, `Return`, `ReturnValue`, `Expression`, `Variable`, `Where`, and `GroupBy`

- `tests/unit/query/query-operations.test.js`
  - `Setter` and `Inserter`

- `tests/unit/query/load.test.js`
  - `Load` configuration, iteration, CSV/JSON/TEXT behavior, and error branches

## Net Effect

This work added parity and unit coverage across:

- operators
- predicates
- advanced expressions
- `SET`
- `LOAD`
- parser error branches
- query core behavior
- network fallback and error behavior

## Final Verified State

After these additions and changes:

- 18 test suites passing
- 178 tests passing
- 84.3% line coverage
- 84.12% statement coverage
- 81.55% function coverage
- 60.33% branch coverage

