/**
 * @fileoverview CypherNG - Modern Graph Database Query Library
 *
 * CypherNG is a refactored implementation of Cypher.js with improved architecture
 * for correctness, clarity, and long-term maintainability. It provides a complete
 * in-memory graph database with Cypher query language support.
 *
 * @module CypherNG
 * @version 1.0.0
 *
 * @example
 * // Node.js usage
 * const { Database, Node, Relationship } = require('./CypherNG');
 *
 * // Create database and nodes
 * const db = new Database();
 * const alice = new Node(db);
 * alice.setProperty('name', 'Alice');
 * alice.setLabel('Person');
 * db.addNode(alice);
 *
 * @example
 * // Browser usage (include via script tag)
 * <script src="CypherNG.js"></script>
 * <script>
 *   const db = new CypherNG.Database();
 *   const node = new CypherNG.Node(db);
 * </script>
 */

// Core data structures
const data = require('./data');
const { Node, Relationship, Database } = data;

// Parser module
const parser = require('./parser');
const { Statement } = parser;

// Query execution module
const query = require('./query');
const { Pattern, Where, ReturnValue, GroupBy, Variable, Return, With, OrderBy, Setter, Match, Create, Merge, Delete, operations } = query;

// Utils
const utils = require('./utils');
const { StringRecoder } = utils;

/**
 * CypherNG Library Exports
 * @namespace CypherNG
 */
const CypherNG = {
    // Data structures
    /** @type {Node} */
    Node,
    /** @type {Relationship} */
    Relationship,
    /** @type {Database} */
    Database,

    // Parser
    /** @type {Statement} */
    Statement,

    // Query operations
    /** @type {Pattern} */
    Pattern,
    /** @type {Where} */
    Where,
    /** @type {ReturnValue} */
    ReturnValue,
    /** @type {GroupBy} */
    GroupBy,
    /** @type {Variable} */
    Variable,
    /** @type {Return} */
    Return,
    /** @type {With} */
    With,
    /** @type {OrderBy} */
    OrderBy,
    /** @type {Setter} */
    Setter,
    /** @type {Match} */
    Match,
    /** @type {Create} */
    Create,
    /** @type {Merge} */
    Merge,
    /** @type {Delete} */
    Delete,

    // Operations submodule
    /** @type {Object} */
    operations,

    // Utils
    /** @type {StringRecoder} */
    StringRecoder,

    // Submodules (for direct access)
    /** @type {Object} */
    data,
    /** @type {Object} */
    parser,
    /** @type {Object} */
    query,
    /** @type {Object} */
    utils
};

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CypherNG;
}

// Expose globally for browser usage
if (typeof window !== 'undefined') {
    window.CypherNG = CypherNG;
} else if (typeof global !== 'undefined') {
    global.CypherNG = CypherNG;
}