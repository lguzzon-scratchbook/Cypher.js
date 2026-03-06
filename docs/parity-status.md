## CypherNG parity status

### Verified fixes applied

| Status | Finding | Resolution |
| --- | --- | --- |
| Fixed | Core queries in `CypherNG` crashed because parser and operation modules were missing modular wiring (`Pattern`, function detection helpers, `queryParser` usage, statement/query imports) | Reconnected parser dependencies and missing module imports in `js/CypherNG/CypherNG.js`, `js/CypherNG/parser/Parser.js`, and query modules |
| Fixed | `CREATE` / `MERGE` returned `null` bindings instead of nodes / relationships | Restored legacy-style matched-entity binding by storing matched IDs in `js/CypherNG/core/Node.js` and `js/CypherNG/core/Relationship.js` |

### Currently verified parity

- Empty `MATCH` result set
- Scalar `UNWIND`
- `WITH` alias forwarding
- `CREATE` node return payload
- `MERGE` node return payload
- property projection from created nodes
- undeclared-variable error string parity
- created relationship return payload
- `startnode()` / `endnode()` relationship binding flows
- variable-length path count sample
- `CASE`, `tojson`, `collect(distinct ...)`, and `barchart(...)` samples

### Known remaining gaps

| Priority | Gap | Evidence |
| --- | --- | --- |
| High | Browser Web Worker parity is not implemented in `js/CypherNG/CypherNG.js` | Legacy `js/Cypher.js` has explicit worker bootstrap / message handling; CypherNG currently executes only in-process |
| High | Coverage policy in `package.json` is still below the requested `>=80%` global threshold | `package.json` currently sets thresholds to 9/6/8/7 |
| Medium | `LOAD CSV` / `LOAD JSON` / `LOAD TEXT` parity is largely unverified | Present in parser and ad hoc legacy scenarios, but not yet covered by deterministic twin tests |
| Medium | Advanced path features such as `shortestpath`, broad predicate helpers, and some aggregates remain unverified | Present in parser inventories but not yet covered in `tests/parity/` |
| Medium | Browser runtime parity has not been validated end-to-end | Current verification has been Node-focused |

### Next tranche

1. Expand twin tests for deterministic local `LOAD` alternatives and advanced aggregations.
2. Decide whether to implement or explicitly defer browser Web Worker parity in `CypherNG`.
3. Raise Jest coverage thresholds only after measured coverage reaches the requested floor.