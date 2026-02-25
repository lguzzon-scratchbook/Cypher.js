/**
 * @fileoverview Main module exports for CypherNG
 * @module CypherNG
 */

// Core data structures
const data = require('./data');
const { Node, Relationship, Database } = data;

// Parser module
const parser = require('./parser');
const { Statement } = parser;

// Query execution module
const query = require('./query');
const { Pattern, Where, ReturnValue, GroupBy, Variable, Setter, Match, Create, Merge, Delete, operations } = query;

// Utils
const utils = require('./utils');
const { StringRecoder } = utils;

module.exports = {
    // Data structures
    Node,
    Relationship,
    Database,

    // Parser
    Statement,

    // Query operations
    Pattern,
    Where,
    ReturnValue,
    GroupBy,
    Variable,
    Setter,
    Match,
    Create,
    Merge,
    Delete,

    // Operations submodule
    operations,

    // Utils
    StringRecoder,

    // Submodules (for direct access)
    data,
    parser,
    query,
    utils
};