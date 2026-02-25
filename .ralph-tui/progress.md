# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- **Parser architecture**: The parser follows a state-machine approach, tokenizing the query string and dispatching to clause-specific handlers (parseMatch, parseCreate, etc.)
- **Expression parsing**: Parse expressions by tracking parenthesis depth and stopping at keywords or comma boundaries
- **Module structure**: ES6 classes with JSDoc for browser compatibility, exports via module.exports for Node.js

---

## 2026-02-25 - US-004
- What was implemented
  - Created Parser.js class in js/CypherNG/parser/ that can parse Cypher query strings
  - Supports MATCH, CREATE, MERGE, DELETE, WITH, RETURN, UNWIND, LOAD CSV clauses
  - Handles WHERE, ORDER BY, LIMIT clauses within operations
  - Updated parser/index.js to export the new Parser class
  - Updated main index.js to export Parser

- Files changed
  - js/CypherNG/parser/Parser.js (NEW - 650+ lines)
  - js/CypherNG/parser/index.js (updated exports)
  - js/CypherNG/index.js (added Parser to exports)

- **Learnings:**
  - Pattern: Cypher.js uses a character-by-character tokenizer with keyword detection and rollback position for backtracking
  - Pattern: Statement class is the central holder for operations - parser adds operations to it
  - Gotcha: When parsing expressions, need to handle string literals correctly to avoid misidentifying keywords inside quoted strings
  - Gotcha: Keywords can appear as part of identifiers - need to check word boundaries

---