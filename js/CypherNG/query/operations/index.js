/**
 * @fileoverview Operation module exports for CypherNG
 * @module CypherNG/query/operations
 */

const Match = require('./Match');
const Create = require('./Create');
const Merge = require('./Merge');
const Delete = require('./Delete');
const Setter = require('./Setter');

module.exports = {
    Match,
    Create,
    Merge,
    Delete,
    Setter
};