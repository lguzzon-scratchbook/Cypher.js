# CypherNG Refactor - Project Summary

## Overview

Refactor `js/Cypher.js` (~7,559 lines) into modular `js/CypherNG.js` with:
- Clean separation of concerns
- Architecture ready for future persistence layer
- 80%+ test coverage
- Full behavioral parity with original implementation

---

## Artifacts Created

```
specs/cypherjs-refactor/
├── rough-idea.md           # Original rough idea
├── requirements.md         # Q&A record from requirements clarification
├── design.md               # Detailed design document
├── plan.md                 # 15-step implementation plan
├── summary.md              # This file
└── research/
    ├── cross-platform-patterns.md    # Module pattern research
    ├── persistence-patterns.md       # Persistence architecture research
    └── testing-frameworks.md         # Testing framework research
```

---

## Key Requirements

| Requirement | Status |
|-------------|--------|
| Behavioral parity with Cypher.js | Defined in design |
| Cross-platform (browser + Node.js) | ESM + CJS dual build |
| Modular architecture | Core/Data/Storage/Utils |
| Persistence-ready | Adapter pattern with registry |
| 80% test coverage | Configured in bunfig.toml |
| Shared tests for parity | tests/shared/ directory |
| BiomeJS linting | biome.json configured |
| Bun.js package manager | Package.json configured |

---

## Technology Stack

- **Package Manager**: Bun.js
- **Linter/Formatter**: BiomeJS
- **Test Runner**: Bun native (with --coverage)
- **JavaScript**: ES2020+ (optional chaining, nullish coalescing)
- **Module Format**: ES Modules source → ESM + CommonJS build

---

## Architecture Highlights

### Module Structure

```
src/
├── index.js              # Main exports
├── CypherNG.js           # Main class (public API)
├── core/                 # Graph engine, query execution
│   ├── GraphEngine.js    # Core graph operations
│   ├── QueryExecutor.js  # Execution orchestration
│   ├── QueryParser.js    # Cypher parsing
│   └── ExpressionEvaluator.js
├── data/                 # Data structures
│   ├── Node.js
│   ├── Relationship.js
│   ├── Graph.js
│   └── QueryResult.js
├── storage/              # Persistence (future)
│   ├── Adapter.js        # Base interface
│   └── Registry.js       # Provider registry
└── utils/                # Utilities
    ├── StringRecoder.js
    └── IDFactory.js
```

### Persistence Design

- **Pattern**: Adapter + Registry
- **Supported backends**: localStorage, IndexedDB, Node.js fs
- **Interface**: Key-value async operations
- **Extensibility**: Plug-in architecture for new backends

---

## Implementation Steps (15 total)

1. **Project Setup** — Bun, BiomeJS, test config
2. **Module Skeleton** — Directory structure, exports
3. **Data Structures** — Node, Relationship, Graph, QueryResult
4. **Utilities** — StringRecoder, IDFactory
5. **GraphEngine** — Core graph operations
6. **QueryExecutor** — Execution orchestration
7. **QueryParser** — Cypher query parsing
8. **ExpressionEvaluator** — Expression evaluation
9. **Query Operators** — MATCH, CREATE, MERGE, etc.
10. **CypherNG Class** — Main public API
11. **Storage Infrastructure** — Adapter pattern
12. **Test Infrastructure** — Shared tests setup
13. **Behavioral Tests** — Parity validation
14. **Coverage** — Achieve 80%+
15. **Final Polish** — BiomeJS, build verification

---

## Testing Strategy

- **Shared tests** (`tests/shared/`): Run against both Cypher.js and CypherNG.js
- **Legacy tests** (`tests/cypher/`): Original query validation
- **CypherNG tests** (`tests/cypherng/`): New feature tests
- **Coverage target**: 80%+ line coverage
- **Configuration**: `bunfig.toml` with threshold enforcement

---

## Design Decisions for Persistence

1. **Adapter Pattern**: Clean separation of storage implementations
2. **Registry Pattern**: Runtime storage backend selection
3. **Async-First**: All storage operations async (matches IndexedDB)
4. **Key-Value Interface**: Simple interface for any backend
5. **Serializability**: All data structures easy to serialize

---

## Next Steps

1. Review and approve this plan
2. (Optional) Create PROMPT.md for Ralph autonomous implementation

---

## Suggested Command for Implementation

```bash
# Full implementation with Ralph
ralph run --config presets/spec-driven.yml

# Alternative: Manual implementation following plan.md
```

---

## References

- Design: `specs/cypherjs-refactor/design.md`
- Plan: `specs/cypherjs-refactor/plan.md`
- Requirements: `specs/cypherjs-refactor/requirements.md`
- Research: `specs/cypherjs-refactor/research/`