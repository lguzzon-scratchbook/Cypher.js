/**
 * @fileoverview Parser module exports for CypherNG
 *
 * Provides Statement class for managing parsed Cypher queries,
 * and Parser class for parsing Cypher query strings.
 *
 * @module CypherNG/parser
 *
 * @example
 * const { Statement, Parser } = require('./parser');
 *
 * // Parse a query string
 * const parser = new Parser(engine);
 * parser.parse('MATCH (n) RETURN n');
 *
 * // Create a statement and add operations
 * const statement = new Statement(engine);
 * statement.addOperation(matchOperation);
 * statement.addOperation(returnOperation);
 */

const { Statement, Variable } = require('./Statement');
const { Parser } = require('./Parser');

/**
 * Parser module exports
 * @namespace parser
 */
module.exports = {
    /** @type {Statement} */
    Statement,
    /** @type {Variable} */
    Variable,
    /** @type {Parser} */
    Parser
};