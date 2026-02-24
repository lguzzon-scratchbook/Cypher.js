# Refactor `js/Cypher.js` into `js/CypherNG.js`

## Rough Idea

Refactor `js/Cypher.js` into `js/CypherNG.js` with improvements focused on correctness, clarity, and long-term maintainability (split in modules more manageable), ensuring full behavioral parity with the original implementation. The refactored module must pass all existing tests in exactly the same manner as `js/Cypher.js` does today.

Alongside the refactor, implement a comprehensive test suite that achieves a minimum of 80% code coverage. The test suite must be structured so that both `js/Cypher.js` and `js/CypherNG.js` are validated by the same shared test cases, clearly demonstrating behavioral equivalence between the legacy and next-generation versions. Any version-specific tests should be clearly separated and labeled accordingly.

All work — the refactor and the test suite — serves as a deliberate, well-structured preparatory step before introducing persistence to the codebase. Therefore, the architecture of `js/CypherNG.js` should be designed with clean separation of concerns, making future integration of a persistence layer straightforward and non-disruptive. Document any design decisions that were made specifically to facilitate the upcoming persistence changes.

The new code must be in JavaScript and JSDOC, runnable in a browser and in Node.js.

## Key Objectives

1. **Refactor**: Transform monolithic `js/Cypher.js` into modular `js/CypherNG.js`
2. **Behavioral Parity**: Ensure identical behavior to the original
3. **Test Coverage**: Achieve minimum 80% code coverage
4. **Shared Tests**: Both versions validated by same test cases
5. **Persistence-Ready**: Architecture designed for future persistence layer
6. **Cross-Platform**: Works in both browser and Node.js environments