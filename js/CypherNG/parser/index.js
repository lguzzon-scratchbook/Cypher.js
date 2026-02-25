/**
 * @fileoverview Parser module exports for CypherNG
 *
 * Provides Statement class for managing parsed Cypher queries.
 *
 * @module CypherNG/parser
 *
 * @example
 * const { Statement } = require('./parser');
 *
 * // Create a statement and add operations
 * const statement = new Statement(engine);
 * statement.addOperation(matchOperation);
 * statement.addOperation(returnOperation);
 */

const { Statement, Variable } = require('./Statement');

/**
 * Parser module exports
 * @namespace parser
 */
module.exports = {
    /** @type {Statement} */
    Statement,
    /** @type {Variable} */
    Variable
};