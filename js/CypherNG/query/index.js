/**
 * @fileoverview Query module exports for CypherNG
 *
 * Provides query execution classes including Pattern, Where, Return, GroupBy,
 * and operations (Match, Create, Merge, Delete).
 *
 * @module CypherNG/query
 *
 * @example
 * const { Match, Pattern, Return, Create } = require('./query');
 *
 * // Create a match operation
 * const match = new Match(statement);
 * const pattern = match.addPattern();
 * pattern.addNode(node);
 * pattern.addRelationship(relationship);
 */

const Pattern = require('./Pattern');
const Where = require('./Where');
const ReturnValue = require('./ReturnValue');
const GroupBy = require('./GroupBy');
const Variable = require('./Variable');
const Return = require('./Return');
const With = require('./With');
const OrderBy = require('./OrderBy');
const Setter = require('./operations/Setter');
const operations = require('./operations');

/**
 * Query module exports
 * @namespace query
 */
module.exports = {
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
    /** @type {Object} */
    Match: operations.Match,
    /** @type {Object} */
    Create: operations.Create,
    /** @type {Object} */
    Merge: operations.Merge,
    /** @type {Object} */
    Delete: operations.Delete,
    /** @type {Object} */
    operations
};