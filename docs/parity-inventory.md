## Cypher.js parity inventory

| Area | Legacy surface / examples | CypherNG status |
| --- | --- | --- |
| Constructor / top-level API | `new Cypher(options)`, `execute`, `resetDataBase`, `addGraph`, proxy config | Partially matched; core constructor and query execution verified in Node, Web Worker branch still missing in `js/CypherNG/CypherNG.js` |
| Core clauses | `MATCH`, `CREATE`, `MERGE`, `RETURN` | Verified by twin tests and manual parity runs |
| Flow clauses | `WITH`, `UNWIND`, `WHERE`, `LIMIT` | `WITH`, `UNWIND`, `WHERE` sampled and matched; broader combinations still being expanded |
| Load clauses | `LOAD CSV`, `LOAD JSON`, `LOAD TEXT`, `POST`, `FIELDTERMINATOR` | Parser keywords exist; network-heavy scenarios not yet parity-tested |
| Pattern traversal | directed relationships, named relationships, variable-length paths, `shortestpath` keyword | Directed + variable-length path count sampled and matched; `shortestpath` remains unverified |
| Scalar functions | `id`, `labels`, `type`, `startnode`, `endnode`, `properties`, `keys`, `size`, `split`, `join`, `trim`, `lower`, `upper`, `replace`, `toInt`, `toFloat`, `toString`, `stringify`, `toDate`, `toJson`, `range`, `coalesce`, `timestamp`, `not` | `startnode`, `endnode`, `toInt`, `toJson`, `range` sampled and matched; remaining functions mostly unverified |
| Aggregate functions | `sum`, `barchart`, `histogram`, `min`, `max`, `count`, `stdev`, `collect` | `count`, `collect`, `barchart` sampled and matched; remaining aggregate parity unverified |
| Predicate helpers | `all`, `any`, predicate `sum` | Parser support present; not yet covered by twin tests |
| Expressions | `CASE`, map/list literals, property lookup, array lookup | Sampled and matched for `CASE`, map/list literals, property access |
| Result shape | `{ output, graph, stats }`, graph nodes/links, error strings | Verified for sampled queries; exact equality asserted in twin suite |
| Runtime environments | Node.js, browser, browser Web Worker | Node.js validated; browser + Web Worker parity still open |

### Source anchors

- Legacy ad hoc scenario corpus: `js/Cypher.test.js`
- Coverage / parity requirement: `DOCs/PROMPTs/00.md`
- CypherNG parser keyword inventory: `js/CypherNG/parser/KeyWords.js`
- CypherNG function inventory: `js/CypherNG/parser/Functions.js`
- CypherNG aggregate inventory: `js/CypherNG/parser/AggregateFunctions.js`

### Representative sampled legacy scenarios

- `MATCH (n) RETURN n`
- `UNWIND [1,2,3] AS x RETURN x`
- `WITH 1 AS x RETURN x`
- `CREATE (n:Person {name:'Alice'}) RETURN n`
- `MERGE (n:Person {name:'Alice'}) RETURN n`
- `CREATE (a)-[r]->(b) RETURN a,r,b`
- `RETURN CASE WHEN 1=1 THEN 1 ELSE 0 END`
- `RETURN tojson('{"a":1}').a`
- `UNWIND ... RETURN collect(distinct e)`
- variable-length path count queries from `js/Cypher.test.js`