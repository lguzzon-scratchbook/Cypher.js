/**
 * @fileoverview Data module exports for CypherNG
 *
 * Central export point for all data structure modules.
 * Provides Node, Relationship, and Database classes.
 *
 * @module CypherNG/data
 *
 * @example
 * const { Node, Relationship, Database } = require('./data');
 *
 * // Create a database and add a node
 * const db = new Database();
 * const node = new Node(db);
 * node.setProperty('name', 'Alice');
 * db.addNode(node);
 */

var Node = require('./Node');
var Relationship = require('./Relationship');
var Database = require('./Database');

/**
 * Data module exports
 * @namespace data
 */
module.exports = {
    /** @type {Node} */
    Node: Node,
    /** @type {Relationship} */
    Relationship: Relationship,
    /** @type {Database} */
    Database: Database
};

// Export individual modules for direct access
if (typeof module !== 'undefined' && module.exports) {
    module.exports.Node = Node;
    module.exports.Relationship = Relationship;
    module.exports.Database = Database;
}