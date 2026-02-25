/**
 * @fileoverview Query module exports for CypherNG
 * @module CypherNG/query
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

module.exports = {
    Pattern,
    Where,
    ReturnValue,
    GroupBy,
    Variable,
    Return,
    With,
    OrderBy,
    Setter,
    Match: operations.Match,
    Create: operations.Create,
    Merge: operations.Merge,
    Delete: operations.Delete,
    operations
};