/**
 * @fileoverview Data module exports for CypherNG
 *
 * Central export point for all data structure modules.
 *
 * @module CypherNG/data
 */

var Node = require('./Node');
var Relationship = require('./Relationship');
var Database = require('./Database');

module.exports = {
    Node: Node,
    Relationship: Relationship,
    Database: Database
};

// Export individual modules for direct access
if (typeof module !== 'undefined' && module.exports) {
    module.exports.Node = Node;
    module.exports.Relationship = Relationship;
    module.exports.Database = Database;
}