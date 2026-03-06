## Parity test matrix

| Scenario family | Query examples | Test file | Status |
| --- | --- | --- | --- |
| Empty graph reads | `MATCH (n) RETURN n` | `tests/parity/basic-read-write.parity.test.js` | Passing |
| Scalar pipelines | `UNWIND [1,2,3] AS x RETURN x`, `WITH 1 AS x RETURN x` | `tests/parity/basic-read-write.parity.test.js` | Passing |
| Core writes | `CREATE (n:Person {name:'Alice'}) RETURN n`, `MERGE (n:Person {name:'Alice'}) RETURN n` | `tests/parity/basic-read-write.parity.test.js` | Passing |
| Error handling | `RETURN missingVar` | `tests/parity/basic-read-write.parity.test.js` | Passing |
| Relationship bindings | `CREATE (a)-[r:KNOWS]->(b) RETURN a,r,b` | `tests/parity/relationship-bindings.parity.test.js` | Passing |
| Relationship helper functions | `RETURN startnode(rel), rel, endnode(rel)` after `collect` + `UNWIND` | `tests/parity/relationship-bindings.parity.test.js` | Passing |
| Variable-length traversal | `MATCH p=(:Node)-[:CONNECTED*]->(:Node) RETURN count(1)` | `tests/parity/relationship-bindings.parity.test.js` | Passing |
| Aggregation / maps / CASE | `collect(distinct e)`, `barchart(e)`, `CASE WHEN ...` | Manual verification so far | Not yet codified |
| Load/network clauses | `LOAD CSV/JSON/TEXT ...` | Not yet added | Open |
| Browser / Web Worker runtime | constructor option parity, async worker execution | Not yet added | Open |