## 1. Overview

Implement a phased parity program so `js/CypherNG` reaches functional parity with legacy `js/Cypher.js`, with shared parity tests under `tests/parity/`, coverage policy aligned to the requested `>=80%`, and documentation that tracks remaining gaps.

### Goals and success criteria
- `CypherNG` executes the same core query scenarios as `Cypher.js` for the first parity tranche.
- Known blockers are fixed first: parser/operation wiring, import/module path issues, `queryParser` vs `parser` naming drift, and `CREATE`/`MERGE`/relationship-return null binding regressions.
- Shared parity tests live under `tests/parity/` and compare both engines on the same queries/results.
- Jest coverage thresholds in `package.json` are raised from the current single-digit values to `>=80%` once the initial parity suite is in place.

### Scope boundaries
Included:
- Runtime parity for the currently verified regression set.
- First batch of shared parity tests.
- Coverage configuration alignment.
- Documentation artifacts for parity inventory/status.

Excluded from this phase:
- Broad LOAD CSV network parity beyond currently stable/local scenarios.
- Persistence-layer work.
- Large-scale refactors outside files directly involved in parsing, operation chaining, binding, and result serialization.

## 2. Prerequisites
- Use existing legacy inventory as source material; seed it from `js/Cypher.test.js` and the parity requirement in `DOCs/PROMPTs/00.md` if the inventory is fragmented.
- No dependency changes are required; Jest is already present in `package.json`.
- Decide whether parity helpers should use `js/CypherNG/CypherNG.js` directly or `js/CypherNG/index.js`; prefer one import path consistently.
- Note before implementation: `package.json` currently enforces incompatible coverage thresholds (`branches: 9`, `functions: 6`, `lines: 8`, `statements: 7`).

## 3. Implementation Steps

### Step 1: Stabilize engine/module entry wiring (blocking)
- **Files to modify:**
  - `js/CypherNG/CypherNG.js`
  - `js/CypherNG/index.js`
  - `js/CypherNG/parser/index.js`
  - `js/CypherNG/query/index.js`
  - `js/CypherNG/core/index.js`
  - `js/CypherNG/structures/index.js`
  - `js/CypherNG/network/index.js`
- **What to do:**
  - Audit all Node/CommonJS requires and namespace re-exports so the engine always boots with parser/query/core modules loaded.
  - Normalize any stale `queryParser` vs `parser` references so parser APIs are invoked consistently.
  - Fix wrong relative paths/import gaps discovered in bootstrap or test helper usage.
- **Testing considerations:**
  - Add/adjust a focused smoke parity test that instantiates both engines and runs `UNWIND [1,2] AS x RETURN x`.

### Step 2: Reconfirm parser-to-operation wiring for core clauses (blocking)
- **Files to modify:**
  - `js/CypherNG/parser/Parser.js`
  - `js/CypherNG/CypherNG.js`
- **What to do:**
  - Verify parser callbacks for `CREATE`, `MERGE`, `MATCH`, `WITH`, `RETURN`, `UNWIND`, and `SET` map to the correct engine methods.
  - Ensure clause sequencing creates the right statement context and next-operation chain before deeper parity work.
- **Testing considerations:**
  - Add focused parity cases for:
    - `UNWIND` basic output (already matching; keep as anti-regression).
    - `MATCH (n) RETURN n` on empty graph.
    - A minimal `CREATE (n:Node{id:1}) RETURN n` parse+execute path.

### Step 3: Fix `CREATE`/`MERGE`/relationship binding regressions (current highest-value bug)
- **Files to modify:**
  - `js/CypherNG/query/operations/Create.js`
  - `js/CypherNG/query/operations/Merge.js`
  - `js/CypherNG/core/Pattern.js`
  - `js/CypherNG/core/Node.js`
  - `js/CypherNG/core/Relationship.js`
  - `js/CypherNG/core/References.js`
  - `js/CypherNG/query/Variable.js`
  - `js/CypherNG/query/Return.js`
  - `js/CypherNG/query/ReturnValue.js`
  - `js/CypherNG/query/Statement.js`
  - `js/CypherNG/structures/utils.js`
- **What to do:**
  - Trace how created/merged nodes and relationships become bound variables and then flow into `RETURN` output.
  - Fix the point where created entities are persisted but returned as `null` instead of node/relationship objects.
  - Verify both row output (`output`) and graph payload (`graph.nodes`/`graph.links`) serialize like legacy `js/Cypher.js`.
  - Pay special attention to `Pattern.create()/merge()`, reference wrappers, and any `clean()` recursion that may erase useful data.
- **Testing considerations:**
  - Add parity cases for:
    - `CREATE (n:Node{id:1}) RETURN n`
    - `MERGE (n:Node{id:1}) RETURN n`
    - `MERGE (a:Node{id:1}) MERGE (b:Node{id:2}) MERGE (a)-[r:TO]->(b) RETURN r`
    - `CREATE (a)-[r:TO]->(b) RETURN a, r, b`

### Step 4: Build the first shared parity harness under `tests/parity/`
- **Files to create:**
  - `tests/parity/helpers/engines.js`
  - `tests/parity/helpers/normalizeResult.js`
  - `tests/parity/basic-read-write.parity.test.js`
  - `tests/parity/relationship-bindings.parity.test.js`
- **What to do:**
  - Create a helper that runs the same query against `../../js/Cypher.js` and `../../js/CypherNG/CypherNG.js` (or `index.js`, if standardized).
  - Normalize non-deterministic result details (ordering, generated IDs only where necessary) while preserving semantic checks.
  - Keep each parity test small and named after a legacy inventory item/query family.
- **Testing considerations:**
  - Start with deterministic local queries only; avoid remote CSV fixtures in the first batch.

### Step 5: Raise coverage policy only after the first parity batch is green
- **Files to modify:**
  - `package.json`
- **What to do:**
  - Replace the current low global thresholds with `>=80%` targets.
  - If needed, phase this as an intermediate PR after parity tests land so CI does not fail before coverage exists.
- **Testing considerations:**
  - Run coverage after parity + unit tests together, not parity tests alone.

### Step 6: Create documentation artifacts to make parity work trackable
- **Files to create:**
  - `docs/parity-inventory.md`
  - `docs/parity-status.md`
  - `docs/parity-test-matrix.md`
- **What to do:**
  - `parity-inventory.md`: convert the existing legacy inventory into categorized scenarios (UNWIND, empty MATCH, CREATE node return, MERGE node return, relationship return, path queries, LOAD CSV, aggregations).
  - `parity-status.md`: record verified-good behavior, known regressions, blocking fixes, and remaining gaps.
  - `parity-test-matrix.md`: map each inventory item to a Jest file under `tests/parity/` and mark pass/fail for legacy vs NG.
- **Testing considerations:**
  - Update docs in lockstep with each new parity file so coverage and parity progress stay auditable.

## 4. File Changes Summary

### Create
- `tests/parity/helpers/engines.js`
- `tests/parity/helpers/normalizeResult.js`
- `tests/parity/basic-read-write.parity.test.js`
- `tests/parity/relationship-bindings.parity.test.js`
- `docs/parity-inventory.md`
- `docs/parity-status.md`
- `docs/parity-test-matrix.md`

### Modify
- `js/CypherNG/CypherNG.js`
- `js/CypherNG/index.js`
- `js/CypherNG/parser/index.js`
- `js/CypherNG/parser/Parser.js`
- `js/CypherNG/query/index.js`
- `js/CypherNG/query/operations/Create.js`
- `js/CypherNG/query/operations/Merge.js`
- `js/CypherNG/query/Return.js`
- `js/CypherNG/query/ReturnValue.js`
- `js/CypherNG/query/Statement.js`
- `js/CypherNG/query/Variable.js`
- `js/CypherNG/core/index.js`
- `js/CypherNG/core/Pattern.js`
- `js/CypherNG/core/Node.js`
- `js/CypherNG/core/Relationship.js`
- `js/CypherNG/core/References.js`
- `js/CypherNG/structures/index.js`
- `js/CypherNG/structures/utils.js`
- `js/CypherNG/network/index.js`
- `package.json`

### Delete
- None planned.

## 5. Testing Strategy
- **Unit coverage additions:** add targeted tests around binding/serialization if parity failures are hard to localize.
- **First parity batch:**
  - UNWIND basic parity
  - MATCH on empty graph
  - CREATE node returns node object
  - MERGE node returns node object
  - MERGE relationship returns relationship object
  - CREATE relationship returns node/relationship endpoints
- **Manual/smoke commands:**
  - `npm run test:parity -- --runInBand`
  - `npx jest tests/parity/basic-read-write.parity.test.js --runInBand`
  - `npx jest tests/parity/relationship-bindings.parity.test.js --runInBand`
  - `npm run test:unit -- --runInBand`
  - `npm test -- --runInBand --coverage`

## 6. Rollback Plan
- Revert parity-specific docs/tests first if they block CI but engine fixes need to stay.
- Revert `package.json` coverage thresholds separately if the code is correct but test volume is not yet sufficient.
- Revert engine changes in reverse dependency order: result serialization/binding -> operations/patterns -> parser/entry wiring.

## 7. Estimated Effort
- **Complexity:** Medium-high.
- **Rough estimate:**
  - Blocking wiring audit: 0.5 day
  - Binding/return regression fixes: 1-2 days
  - First parity harness + first batch tests: 0.5-1 day
  - Coverage threshold alignment + docs: 0.5 day
- **Total:** ~2.5-4 days depending on how deep the null-binding bug extends into core references/serialization.

