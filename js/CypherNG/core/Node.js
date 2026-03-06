/**
 * @fileoverview Node class for CypherNG.
 * Represents a node in the graph database with properties and labels.
 */

/**
 * Node - Represents a graph node with properties and labels.
 *
 * @class
 * @memberof CypherNG.core
 * @param {DB} db - The database instance
 */
function Node(db) {
    var id;
    var labels = {};
    var propertyExpressions = {};
    var properties = {};
    var variableKey;
    var referredNode = null;
    var expandedNode = null;
    var me = this;
    var previousObject;
    var nextObject;
    var pattern;
    var expandedIsMatched = false;

    // Persistence Design Note: Node storage is isolated in DB class.
    // Properties and labels are stored here for quick access.
    // For persistence, serialize id, labels, and properties.

    /**
     * Set the previous object in the pattern chain.
     * @param {Object} object - The previous object
     */
    this.setPreviousObject = function(object) {
        previousObject = object;
    };

    /**
     * Get the previous object in the pattern chain.
     * @returns {Object} The previous object
     */
    this.getPreviousObject = function() {
        return previousObject;
    };

    /**
     * Set the next object in the pattern chain.
     * @param {Object} object - The next object
     */
    this.setNextObject = function(object) {
        nextObject = object;
    };

    /**
     * Get the next object in the pattern chain.
     * @returns {Object} The next object
     */
    this.getNextObject = function() {
        return nextObject;
    };

    /**
     * Set the pattern this node belongs to.
     * @param {Pattern} patternArg - The pattern
     */
    this.setPattern = function(patternArg) {
        pattern = patternArg;
    };

    /**
     * Get the pattern this node belongs to.
     * @returns {Pattern} The pattern
     */
    this.getPattern = function() {
        return pattern;
    };

    /**
     * Get the next node in the pattern chain.
     * @returns {Node|null} The next node or null
     */
    this.nextNode = function() {
        if (me.getNextObject()) {
            if (me.getNextObject().isRelationship()) {
                return me.getNextObject().getNextObject();
            } else if (me.getNextObject().isNode()) {
                return me.getNextObject();
            }
        }
        return null;
    };

    /**
     * Get the previous node in the pattern chain.
     * @returns {Node|null} The previous node or null
     */
    this.previousNode = function() {
        if (me.getPreviousObject()) {
            if (me.getPreviousObject().isRelationship()) {
                return me.getPreviousObject().getPreviousObject();
            } else if (me.getPreviousObject().isNode()) {
                return me.getPreviousObject();
            }
        }
        return null;
    };

    /**
     * Get the incoming relationship (if any).
     * @returns {Relationship|null} The incoming relationship or null
     */
    this.incomingRelationship = function() {
        if (me.getPreviousObject()) {
            if (me.getPreviousObject().isRelationship()) {
                return me.getPreviousObject();
            }
        }
        return null;
    };

    /**
     * Get the outgoing relationship (if any).
     * @returns {Relationship|null} The outgoing relationship or null
     */
    this.outgoingRelationship = function() {
        if (me.getNextObject()) {
            if (me.getNextObject().isRelationship()) {
                return me.getNextObject();
            }
        }
        return null;
    };

    /**
     * Set the node ID.
     * @param {number} nodeId - The node ID
     */
    this.setId = function(nodeId) {
        id = nodeId;
    };

    /**
     * Get the node ID.
     * @returns {number} The node ID
     */
    this.id = function() {
        return id;
    };

    /**
     * Alias for id().
     * @returns {number} The node ID
     */
    this.getId = this.id;

    /**
     * Set a property with an expression.
     * @param {string} key - The property key
     * @param {Expression} expression - The expression to evaluate for the property value
     */
    this.setProperty = function(key, expression) {
        properties[key] = null;
        propertyExpressions[key] = expression.value;
    };

    /**
     * Set multiple properties from an object.
     * @param {Object} _properties - The properties object
     */
    this.setProperties = function(_properties) {
        for (var key in _properties) {
            properties[key] = _properties[key];
        }
    };

    /**
     * Bind a property by evaluating its expression.
     * @param {string} key - The property key
     */
    this.bindProperty = function(key) {
        properties[key] = propertyExpressions[key]();
    };

    /**
     * Bind all properties by evaluating their expressions.
     */
    this.bindProperties = function() {
        for (var key in properties) {
            this.bindProperty(key);
        }
    };

    /**
     * Set a label for this node.
     * @param {string} labelName - The label name
     * @param {number} nodeId - The node ID for index lookup
     */
    this.setLabel = function(labelName, nodeId) {
        labels[labelName] = true;
        db._addLabelNodeIdLookup(labelName, nodeId);
    };

    /**
     * Check if the node has a specific label.
     * @param {string} labelName - The label name
     * @returns {boolean} True if the node has the label
     */
    this.hasLabel = function(labelName) {
        return labels[labelName];
    };

    /**
     * Set multiple labels from an object.
     * @param {Object} _labels - The labels object
     */
    this.setLabels = function(_labels) {
        for (var label in _labels) {
            labels[label] = _labels[label];
        }
    };

    /**
     * Set a variable key for this node.
     * @param {string} key - The variable key
     */
    this.setVariableKey = function(key) {
        variableKey = key;
    };

    /**
     * Get the variable key for this node.
     * @returns {string} The variable key
     */
    this.getVariableKey = function() {
        return variableKey;
    };

    /**
     * Check if the node has a variable key.
     * @returns {boolean} True if the node has a variable key
     */
    this.hasVariableKey = function() {
        return variableKey != undefined;
    };

    /**
     * Get a copy of the properties object.
     * @returns {Object} The properties object
     */
    this.getProperties = function() {
        return Object.create(properties);
    };

    /**
     * Get the raw properties object.
     * @returns {Object} The raw properties object
     */
    this.getRawProperties = function() {
        return properties;
    };

    /**
     * Get the labels object.
     * @returns {Object} The labels object
     */
    this.labels = function() {
        return labels;
    };

    /**
     * Get an array of label names.
     * @returns {string[]} Array of label names
     */
    this.getLabels = function() {
        return Object.keys(labels);
    };

    /**
     * Check if the node has any labels.
     * @returns {boolean} True if the node has labels
     */
    this.hasLabels = function() {
        return Object.keys(labels).length > 0;
    };

    /**
     * Check if the node has any properties.
     * @returns {boolean} True if the node has properties
     */
    this.hasProperties = function() {
        return Object.keys(properties).length > 0;
    };

    /**
     * Get a reference to this node.
     * @param {boolean} asKey - If true, return just the ID
     * @returns {NodeReference|number} The node reference or ID
     */
    this.get = function(asKey) {
        if (asKey) {
            return id;
        }
        return new (typeof module !== 'undefined' && module.exports ? require('./References.js').NodeReference : CypherNG.core.NodeReference)(db, id);
    };

    /**
     * Convert the node to a plain object.
     * @returns {Object} The node as a plain object with id, labels, and properties
     */
    this.toObject = function() {
        var addAssociativeArrayFunctions = (typeof module !== 'undefined' && module.exports ?
            require('../structures/utils.js').addAssociativeArrayFunctions :
            CypherNG.structures.addAssociativeArrayFunctions);

        return {
            id: id,
            labels: this.getLabels(),
            properties: addAssociativeArrayFunctions(properties),
            getProperty: function() { return properties[key]; },
            getProperties: function() { return this.properties; },
            getLabels: function() { return this.labels; },
            getKeys: function() {
                return this.properties.getKeys();
            }
        };
    };

    /**
     * Convert the node to a JSON string.
     * @returns {string} JSON string representation
     */
    this.toString = function() {
        return JSON.stringify(this.get());
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Node"
     */
    this.type = function() {
        return this.constructor.name;
    };

    /**
     * Check if this is a relationship (always false for Node).
     * @returns {boolean} False
     */
    this.isRelationship = function() {
        return false;
    };

    /**
     * Check if this is a node (always true for Node).
     * @returns {boolean} True
     */
    this.isNode = function() {
        return true;
    };

    /**
     * Set a referred node (when this node references another node).
     * @param {Node} referredNodeArg - The referred node
     */
    this.setReferredNode = function(referredNodeArg) {
        referredNode = referredNodeArg;
    };

    /**
     * Check if this node is a reference to another node.
     * @returns {boolean} True if this is a referred node
     */
    this.isReferred = function() {
        return referredNode != null;
    };

    /**
     * Get the referred node.
     * @returns {Node} The referred node
     */
    this.getReferredNode = function() {
        return referredNode;
    };

    /**
     * Mark the expanded node as matched.
     */
    this.setExpandedIsMatched = function() {
        expandedIsMatched = true;
    };

    /**
     * Check and reset the expanded node matched flag.
     * @returns {boolean} True if the expanded node was matched
     */
    this.expandedIsMatched = function() {
        if (expandedIsMatched) {
            expandedIsMatched = false;
            return true;
        }
        return false;
    };

    /**
     * Set the expanded node (for path expansion).
     * @param {Node} expandedNodeArg - The expanded node
     */
    this.setExpandedNode = function(expandedNodeArg) {
        expandedNode = expandedNodeArg;
    };

    /**
     * Check if this node has been expanded.
     * @returns {boolean} True if the node is expanded
     */
    this.isExpanded = function() {
        return expandedNode != null;
    };

    /**
     * Get the expanded node.
     * @returns {Node} The expanded node
     */
    this.getExpandedNode = function() {
        return expandedNode;
    };

    /**
     * Default next action (no-op).
     */
    this.nextAction = function() {
        ;
    };

    /**
     * Set the next action function.
     * @param {Function} f - The action function
     */
    this.setNextAction = function(f) {
        this.nextAction = f;
    };

    /**
     * Convey this node through the pattern matching process.
     * @param {boolean} merge - True for merge, false for match
     * @param {number} pathExpansionDepth - Current path expansion depth
     * @returns {*} Result of the match operation
     */
    this.convey = function(merge, pathExpansionDepth) {
        return db.matchNode(me, merge, pathExpansionDepth);
    };

    /**
     * Create this node in the database.
     * @returns {*} Result of the create operation
     */
    this.create = function() {
        return db.createNode(me);
    };

    /**
     * Merge this node in the database.
     * @returns {*} Result of the merge operation
     */
    this.merge = function() {
        return db.mergeNode(me);
    };

    /**
     * Match this node in the database.
     * @returns {*} Result of the match operation
     */
    this.match = function() {
        return db.matchNodes(me);
    };

    // Matched node tracking
    var matchedNode;
    var matchedIncomingRelationshipIds = {};

    /**
     * Add a matched node ID.
     * @param {Object} node - The matched node instance
     */
    this.addMatchedNode = function(node) {
        matchedNode = node.id();
    };

    /**
     * Get the matched node.
     * @returns {Node} The matched node
     */
    this.getMatchedNode = function() {
        return this.getData();
    };

    /**
     * Add a matched incoming relationship ID.
     * @param {number} nodeId - The node ID
     * @param {number} matchedRelationshipId - The relationship ID
     */
    this.addMatchedIncomingRelationshipId = function(nodeId, matchedRelationshipId) {
        if (!matchedIncomingRelationshipIds[nodeId]) {
            matchedIncomingRelationshipIds[nodeId] = [];
        }
        matchedIncomingRelationshipIds[nodeId].push(matchedRelationshipId);
    };

    /**
     * Get and clear matched incoming relationship IDs for a node.
     * @param {number} nodeId - The node ID
     * @returns {number[]|null} Array of relationship IDs or null
     */
    this.getMatchedIncomingRelationshipIds = function(nodeId) {
        if (!matchedIncomingRelationshipIds[nodeId]) {
            return null;
        }
        var matchedIds = matchedIncomingRelationshipIds[nodeId];
        matchedIncomingRelationshipIds[nodeId] = [];
        return matchedIds;
    };

    /**
     * Get the data for this node from the database.
     * @returns {Node} The node instance from the database
     */
    this.getData = function() {
        return db.getNodeById(matchedNode);
    };

    /**
     * Get a local property value by key.
     * @param {string} key - The property key
     * @returns {*} The property value or null
     */
    this.getLocalProperty = function(key) {
        return properties[key] || null;
    };

    /**
     * Get a property value by key from the matched node.
     * @param {string} key - The property key
     * @returns {*} The property value or null
     */
    this.getProperty = function(key) {
        if (!db.getNodeById(matchedNode)) return null;
        return db.getNodeById(matchedNode).getLocalProperty(key);
    };

    /**
     * Get the group key for aggregation.
     * @returns {number} The node ID
     */
    this.groupByKey = function() {
        return this.getData().id();
    };

    /**
     * Get the group value for aggregation.
     * @returns {Object} The node reference
     */
    this.groupByValue = function() {
        return this.getData().get();
    };

    /**
     * Create a copy of this node.
     * @returns {Node} A new Node instance with the same labels and properties
     */
    this.copy = function() {
        var n = new Node(db);
        n.setLabels(labels);
        n.setProperties(properties);
        return n;
    };

    /**
     * Check if this node is mappable (for serialization).
     * @returns {boolean} True if the node is mappable
     */
    this.mappable = function() {
        if (referredNode) {
            if (referredNode.mappable && !referredNode.mappable()) {
                return false;
            }
        }
        for (var propertyKey in properties) {
            if (!propertyExpressions[propertyKey].mappable) {
                return false;
            }
            if (!propertyExpressions[propertyKey].mappable()) {
                return false;
            }
        }
        return true;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Node = Node;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).core = (this.CypherNG = this.CypherNG || {}).core || {});
