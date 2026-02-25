# CypherNG Refactor Implementation Prompt

## Objective

Refactor `js/Cypher.js` (~7,559 lines) into modular `js/CypherNG.js` with:
- Clean separation of concerns (core/data/storage/utils)
- Architecture ready for future persistence layer
- Full behavioral parity with original implementation

## Key Requirements

- **Behavioral Parity**: CypherNG.js must produce identical results to Cypher.js for all queries
- **Cross-Platform**: Same code runs in browser and Node.js (ESM + CJS)
- **Modular**: Split into focused, maintainable modules
- **Persistence-Ready**: Implement adapter pattern for localStorage, IndexedDB, Node.js fs
- **Test Coverage**: Minimum 80% code coverage
- **Shared Tests**: Both versions validated by same test suite
- **JavaScript**: ES2020+ (optional chaining, nullish coalescing, async/await)
- **Tools**: Bun.js (package manager), BiomeJS (linter), Bun test (coverage)

## Output Location

- Refactored code: `js/CypherNG.js`
- Tests: `tests/shared/` for behavioral equivalence
- Build output: `dist/esm/` and `dist/cjs/`

## Build Configuration

- `package.json` with exports field for ESM/CJS dual support
- `biome.json` for linting/formatting
- `bunfig.toml` with test coverage threshold = 0.8

## Acceptance Criteria

### Behavioral Parity

```gherkin
Given a Cypher query from js/Cypher.test.js now `js/Cypher.test.js.bak`
When executed against both Cypher.js and CypherNG.js
Then both return identical results
And both produce identical graph states
```

### Module Loading

```gherkin
Given CypherNG is imported as ES module in Node.js
When running 'import { CypherNG } from "./js/CypherNG.js"'
Then it provides the CypherNG class

Given CypherNG is loaded in browser via script tag
When accessing window.CypherNG
Then it provides the CypherNG constructor
```

### Test Coverage

```gherkin
When running 'bun test --coverage'
Then line coverage is at least 80%
And all tests pass
```

### Storage Integration

```gherkin
Given CypherNG is configured with a storage adapter
When calling setStorage(adapter)
Then queries can be saved and loaded via the adapter
```

## Reference Documents

- Full design: `specs/cypherjs-refactor/design.md`
- Implementation plan: `specs/cypherjs-refactor/plan.md`
- Test queries: `js/Cypher.test.js`

## Commands

```bash
# Install dependencies
bun install

# Run tests with coverage
bun test --coverage

# Lint code
biome check --write js/

# Build dual format
bun run build
```