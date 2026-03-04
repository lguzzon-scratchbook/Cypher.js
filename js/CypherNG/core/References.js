/**
 * @fileoverview NodeReference and RelationshipReference classes for CypherNG.
 * These classes provide reference-based access to nodes and relationships in the database.
 */

/**
 * NodeReference - A reference to a node in the database.
 * Provides indirect access to node properties and labels.
 *
 * @class
 * @memberof CypherNG.core
 * @param {DB} db - The database instance
 * @param {number} nodeId - The ID of the referenced node
 */
function NodeReference(db, nodeId) {
    var me = this;

    /**
     * Get the node ID.
     * @returns {number} The node ID
     */
    this.nodeId = function() {
        return nodeId;
    };

    /**
     * Alias for nodeId().
     * @returns {number} The node ID
     */
    this.id = this.nodeId;

    /**
     * Get the referenced node instance from the database.
     * @returns {Node} The node instance
     */
    this.getNode = function() {
        return db.getNodeById(nodeId);
    };

    /**
     * Alias for getNode().
     * @returns {Node} The node instance
     */
    this.getObject = this.getNode;

    /**
     * Get the node as a plain object with id, labels, and properties.
     * @returns {Object} The node as a plain object
     */
    this.value = function() {
        return db.getNodeById(nodeId).toObject();
    };

    /**
     * Alias for value().
     * @returns {Object} The node as a plain object
     */
    this.getData = this.value;

    /**
     * Get a specific property value by key.
     * @param {string} propertyKey - The property key
     * @returns {*} The property value
     */
    this.getProperty = function(propertyKey) {
        return db.getNodeById(nodeId).getLocalProperty(propertyKey);
    };

    /**
     * Get all properties as an associative array.
     * @returns {Object} The properties object
     */
    this.getProperties = function() {
        return this.value().getProperties();
    };

    /**
     * Get all labels.
     * @returns {string[]} Array of label names
     */
    this.getLabels = function() {
        return this.value().getLabels();
    };

    /**
     * Get all property keys.
     * @returns {string[]} Array of property keys
     */
    this.getKeys = function() {
        return this.value().getProperties().getKeys();
    };

    /**
     * Group key for aggregation - returns the node ID.
     * @returns {number} The node ID
     */
    this.groupByKey = this.nodeId;
}

/**
 * RelationshipReference - A reference to a relationship in the database.
 * Provides indirect access to relationship properties, type, and endpoints.
 *
 * @class
 * @memberof CypherNG.core
 * @param {DB} db - The database instance
 * @param {number} relationshipId - The ID of the referenced relationship
 */
function RelationshipReference(db, relationshipId) {
    var me = this;

    /**
     * Get the relationship ID.
     * @returns {number} The relationship ID
     */
    this.relationshipId = function() {
        return relationshipId;
    };

    /**
     * Alias for relationshipId().
     * @returns {number} The relationship ID
     */
    this.id = this.relationshipId;

    /**
     * Get the referenced relationship instance from the database.
     * @returns {Relationship} The relationship instance
     */
    this.getRelationship = function() {
        return db.getRelationshipById(relationshipId);
    };

    /**
     * Alias for getRelationship().
     * @returns {Relationship} The relationship instance
     */
    this.getObject = this.getRelationship;

    /**
     * Get the relationship as a plain object with id, type, properties, fromNode, toNode.
     * @returns {Object} The relationship as a plain object
     */
    this.value = function() {
        return db.getRelationshipById(relationshipId).toObject();
    };

    /**
     * Alias for value().
     * @returns {Object} The relationship as a plain object
     */
    this.getData = this.value;

    /**
     * Get a specific property value by key.
     * @param {string} propertyKey - The property key
     * @returns {*} The property value
     */
    this.getProperty = function(propertyKey) {
        return db.getRelationshipById(relationshipId).getLocalProperty(propertyKey);
    };

    /**
     * Get all properties as an associative array.
     * @returns {Object} The properties object
     */
    this.getProperties = function() {
        return this.value().getProperties();
    };

    /**
     * Get all property keys.
     * @returns {string[]} Array of property keys
     */
    this.getKeys = function() {
        return this.value().getProperties().getKeys();
    };

    /**
     * Get the start node of the relationship.
     * @returns {Object} The start node reference
     */
    this.startNode = function() {
        return this.getRelationship().getFromNode().get();
    };

    /**
     * Get the end node of the relationship.
     * @returns {Object} The end node reference
     */
    this.endNode = function() {
        return this.getRelationship().getToNode().get();
    };

    /**
     * Get the relationship type.
     * @returns {string} The relationship type
     */
    this.getType = function() {
        return this.value().getType();
    };

    /**
     * Group key for aggregation - returns the relationship ID.
     * @returns {number} The relationship ID
     */
    this.groupByKey = this.relationshipId;
}

// Export for both browser and Node.js
(function(exports) {
    exports.NodeReference = NodeReference;
    exports.RelationshipReference = RelationshipReference;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).core = (this.CypherNG = this.CypherNG || {}).core || {});
