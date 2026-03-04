/**
 * @fileoverview Relationship class for CypherNG.
 * Represents a relationship in the graph database with properties, type, and direction.
 */

/**
 * Relationship - Represents a graph relationship with properties, type, and direction.
 *
 * @class
 * @memberof CypherNG.core
 * @param {DB} db - The database instance
 */
function Relationship(db) {
    var id;
    var relationshipType;
    var properties = {};
    var propertyExpressions = {};
    var fromNode;
    var toNode;
    var leftDirection;
    var rightDirection;
    var variableKey;
    var previousObject;
    var nextObject;
    var isAdded = false;
    var hasVariablePathLength = false;
    var pathLengthFrom = 1;
    var pathLengthTo = 1;
    var pattern;
    var referredRelationship = null;
    var me = this;

    // Persistence Design Note: Relationship storage is isolated in DB class.
    // Properties, type, and endpoints are stored here for quick access.
    // For persistence, serialize id, type, properties, fromNode, toNode, direction.

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
     * Set the pattern this relationship belongs to.
     * @param {Pattern} patternArg - The pattern
     */
    this.setPattern = function(patternArg) {
        pattern = patternArg;
    };

    /**
     * Get the pattern this relationship belongs to.
     * @returns {Pattern} The pattern
     */
    this.getPattern = function() {
        return pattern;
    };

    /**
     * Set the relationship ID.
     * @param {number} relationshipId - The relationship ID
     */
    this.setId = function(relationshipId) {
        id = relationshipId;
    };

    /**
     * Get the relationship ID.
     * @returns {number} The relationship ID
     */
    this.id = function() {
        return id;
    };

    /**
     * Set the stored type (internal use for index lookup).
     * @param {string} type - The relationship type
     */
    this.setStoredType = function(type) {
        relationshipType = type;
    };

    /**
     * Set the relationship type.
     * @param {string} type - The relationship type
     * @param {number} relationshipId - The relationship ID for index lookup
     */
    this.setType = function(type, relationshipId) {
        relationshipType = type;
        // db._addTypeRelationshipIdLookup(relationshipType, relationshipId);
    };

    /**
     * Get the relationship type.
     * @returns {string} The relationship type
     */
    this.getType = function() {
        return relationshipType;
    };

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
     * Set multiple properties from an object.
     * @param {Object} _properties - The properties object
     */
    this.setProperties = function(_properties) {
        for (var key in _properties) {
            properties[key] = _properties[key];
        }
    };

    /**
     * Get a property value by key.
     * @param {string} key - The property key
     * @returns {*} The property value
     */
    this.getProperty = function(key) {
        return properties[key];
    };

    /**
     * Get the properties object.
     * @returns {Object} The properties object
     */
    this.getProperties = function() {
        return properties;
    };

    /**
     * Alias for getProperties().
     * @returns {Object} The properties object
     */
    this.getRelationshipProperties = function() {
        return properties;
    };

    /**
     * Set the from node.
     * @param {Node} node - The from node
     */
    this.setFromNode = function(node) {
        fromNode = node;
    };

    /**
     * Set the to node.
     * @param {Node} node - The to node
     */
    this.setToNode = function(node) {
        toNode = node;
    };

    /**
     * Get the from node.
     * @param {number} fromNodeId - Optional from node ID for direction check
     * @returns {Node} The from node
     */
    this.getFromNode = function(fromNodeId) {
        if (fromNodeId != undefined) {
            if (fromNodeId != fromNode.id()) {
                return toNode;
            }
        }
        return fromNode;
    };

    /**
     * Get the to node.
     * @param {number} fromNodeId - Optional from node ID for direction check
     * @returns {Node} The to node
     */
    this.getToNode = function(fromNodeId) {
        if (fromNodeId != undefined) {
            if (fromNodeId != fromNode.id()) {
                return fromNode;
            }
        }
        return toNode;
    };

    /**
     * Set left direction flag.
     * @param {boolean} direction - True for left direction
     */
    this.setLeftDirection = function(direction) {
        leftDirection = direction;
    };

    /**
     * Set right direction flag.
     * @param {boolean} direction - True for right direction
     */
    this.setRightDirection = function(direction) {
        rightDirection = direction;
    };

    /**
     * Check if the relationship has left direction.
     * @param {number} fromNodeId - Optional from node ID for direction check
     * @returns {boolean} True if left directed
     */
    this.leftDirection = function(fromNodeId) {
        if (fromNodeId != undefined) {
            if (fromNodeId != fromNode.id()) {
                return !leftDirection && rightDirection;
            }
        }
        return leftDirection && !rightDirection;
    };

    /**
     * Check if the relationship has right direction.
     * @param {number} fromNodeId - Optional from node ID for direction check
     * @returns {boolean} True if right directed
     */
    this.rightDirection = function(fromNodeId) {
        if (fromNodeId != undefined) {
            if (fromNodeId != fromNode.id()) {
                return !rightDirection && leftDirection;
            }
        }
        return rightDirection && !leftDirection;
    };

    /**
     * Check if the relationship is uni-directional (both or none).
     * @returns {boolean} True if uni-directional
     */
    this.uniDirectional = function() {
        return (rightDirection && leftDirection) || (!leftDirection && !rightDirection);
    };

    /**
     * Check if the relationship has no direction.
     * @returns {boolean} True if no direction
     */
    this.noDirection = function() {
        return !leftDirection && !rightDirection;
    };

    /**
     * Get the direction as a string.
     * @returns {string} "left", "right", "both", or "none"
     */
    this.direction = function() {
        var l = this.leftDirection();
        var r = this.rightDirection();
        if (l && !r) {
            return "left";
        }
        if (!l && r) {
            return "right";
        }
        if (l && r) {
            return "both";
        }
        return "none";
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Relationship"
     */
    this.type = function() {
        return this.constructor.name;
    };

    /**
     * Check if this is a relationship (always true for Relationship).
     * @returns {boolean} True
     */
    this.isRelationship = function() {
        return true;
    };

    /**
     * Check if this is a node (always false for Relationship).
     * @returns {boolean} False
     */
    this.isNode = function() {
        return false;
    };

    /**
     * Set a referred relationship (when this relationship references another).
     * @param {Relationship} referredRelationshipArg - The referred relationship
     */
    this.setReferredRelationship = function(referredRelationshipArg) {
        referredRelationship = referredRelationshipArg;
    };

    /**
     * Check if this relationship is a reference to another relationship.
     * @returns {boolean} True if this is a referred relationship
     */
    this.isReferred = function() {
        return referredRelationship != null;
    };

    /**
     * Get the referred relationship.
     * @returns {Relationship} The referred relationship
     */
    this.getReferredRelationship = function() {
        return referredRelationship;
    };

    /**
     * Check if the relationship has been added to the database.
     * @returns {boolean} True if added
     */
    this.isAdded = function() {
        return isAdded;
    };

    /**
     * Mark the relationship as added.
     */
    this.setIsAdded = function() {
        isAdded = true;
    };

    /**
     * Mark the relationship as having variable path length.
     */
    this.setHasVariablePathLength = function() {
        hasVariablePathLength = true;
        pathLengthFrom = null;
        pathLengthTo = null;
    };

    /**
     * Check if the relationship has variable path length.
     * @returns {boolean} True if variable path length
     */
    this.hasVariablePathLength = function() {
        return hasVariablePathLength;
    };

    /**
     * Set the minimum path length.
     * @param {number} pathLengthFrom - The minimum path length
     */
    this.setPathLengthFrom = function(pathLengthFrom) {
        pathLengthFrom = pathLengthFrom;
    };

    /**
     * Get the minimum path length.
     * @returns {number|null} The minimum path length
     */
    this.pathLengthFrom = function() {
        return pathLengthFrom;
    };

    /**
     * Set the maximum path length.
     * @param {number} pathLengthTo - The maximum path length
     */
    this.setPathLengthTo = function(pathLengthTo) {
        pathLengthTo = pathLengthTo;
    };

    /**
     * Get the maximum path length.
     * @returns {number|null} The maximum path length
     */
    this.pathLengthTo = function() {
        return pathLengthTo;
    };

    /**
     * Check if the relationship should expand paths.
     * @returns {boolean} True if path expansion is enabled
     */
    this.expandPath = function() {
        return hasVariablePathLength;
    };

    /**
     * Get a reference to this relationship.
     * @returns {RelationshipReference} The relationship reference
     */
    this.get = function() {
        var RelationshipReference = (typeof module !== 'undefined' && module.exports ?
            require('./References.js').RelationshipReference :
            CypherNG.core.RelationshipReference);
        return new RelationshipReference(db, id);
    };

    /**
     * Convert the relationship to a plain object.
     * @returns {Object} The relationship as a plain object
     */
    this.toObject = function() {
        var addAssociativeArrayFunctions = (typeof module !== 'undefined' && module.exports ?
            require('../structures/utils.js').addAssociativeArrayFunctions :
            CypherNG.structures.addAssociativeArrayFunctions);

        return {
            id: id,
            type: relationshipType,
            properties: addAssociativeArrayFunctions(properties),
            fromNode: (fromNode ? fromNode.get() : null),
            toNode: (toNode ? toNode.get() : null),
            direction: this.direction(),
            getProperty: function() { return properties[key]; },
            getProperties: function() { return properties; },
            getKeys: function() { return properties.getKeys(); },
            getType: function() { return relationshipType; }
        };
    };

    /**
     * Convert the relationship to a string.
     * @returns {string} String representation
     */
    this.toString = function() {
        var direction = "none";
        if (this.leftDirection()) {
            direction = "left";
        } else if (this.rightDirection()) {
            direction = "right";
        }
        return "id: " + id +
            ". type: " + relationshipType +
            ". properties: " + JSON.stringify(properties) +
            ". fromNodeId: " + (fromNode ? fromNode.id() : null) +
            ". toNodeId: " + (toNode ? toNode.id() : null) +
            ". direction: " + direction;
    };

    /**
     * Get the value (alias for get()).
     * @returns {RelationshipReference} The relationship reference
     */
    this.value = function() {
        return this.get();
    };

    /**
     * Set the variable key for this relationship.
     * @param {string} key - The variable key
     */
    this.setVariableKey = function(key) {
        variableKey = key;
    };

    /**
     * Get the variable key for this relationship.
     * @returns {string} The variable key
     */
    this.getVariableKey = function() {
        return variableKey;
    };

    /**
     * Check if the relationship has a variable key.
     * @returns {boolean} True if the relationship has a variable key
     */
    this.hasVariableKey = function() {
        return variableKey != undefined;
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

    // Matched relationship tracking
    var matchedRelationship;
    var expandedPath = [];
    var pathList = [];
    var visitedNodes = {};
    var expandedEndNode = null;

    /**
     * Update visited nodes count.
     * @param {number} nodeId - The node ID
     */
    var updateVisitedNodes = function(nodeId) {
        visitedNodes[nodeId] = (visitedNodes[nodeId] || 0) + 1;
    };

    /**
     * Update visited nodes based on path.
     * @param {Object} path - The path object with fromNodeId and toNodeId
     */
    var updateVisitedRelationships = function(path) {
        if (expandedPath.length == 0) {
            updateVisitedNodes(path.fromNodeId);
        }
        updateVisitedNodes(path.toNodeId);
    };

    /**
     * Check if a node has been visited before (twice or more).
     * @param {number} nodeId - The node ID
     * @returns {boolean} True if the node was visited before
     */
    this.visitedBefore = function(nodeId) {
        if (expandedPath.length > 1) {
            if (expandedPath[expandedPath.length - 1] == expandedPath[expandedPath.length - 2]) {
                return true;
            }
        }
        return visitedNodes[nodeId] >= 2;
    };

    /**
     * Set the matched relationship ID.
     * @param {number} relationshipId - The relationship ID
     */
    this.setMatchedRelationship = function(relationshipId) {
        matchedRelationship = relationshipId;
    };

    /**
     * Add a matched relationship.
     * @param {Relationship} relationship - The matched relationship
     * @param {Object} path - The path object
     */
    this.addMatchedRelationship = function(relationship, path) {
        if (hasVariablePathLength) {
            expandedPath.push(relationship.id());
            pathList.push(path);
            updateVisitedRelationships(path);
        } else if (!hasVariablePathLength) {
            this.setMatchedRelationship(relationship);
        }
    };

    /**
     * Get the matched relationship.
     * @returns {Relationship} The matched relationship
     */
    this.getMatchedRelationship = function() {
        return this.getData();
    };

    /**
     * Check if the relationship has an expanded end node.
     * @returns {boolean} True if expanded end node exists
     */
    this.hasExpandedEndNode = function() {
        return expandedEndNode != null;
    };

    /**
     * Set the expanded end node.
     * @param {Node} node - The expanded end node
     */
    this.setExpandedEndNode = function(node) {
        expandedEndNode = node;
    };

    /**
     * Get the expanded end node.
     * @returns {Node} The expanded end node
     */
    this.getExpandedEndNode = function() {
        return expandedEndNode;
    };

    /**
     * Reset the expanded path.
     */
    this.resetExpandedPath = function() {
        expandedPath = [];
        pathList = [];
        visitedNodes = {};
    };

    /**
     * Backtrack the expanded path.
     */
    this.backTrackExpandedPath = function() {
        if (expandedPath.length == 0) {
            return;
        }
        expandedPath.pop();
        var path = pathList.pop();
        if (expandedPath.length == 0) {
            visitedNodes = {};
        } else {
            visitedNodes[path.toNodeId]--;
        }
    };

    /**
     * Check if the minimum path length is satisfied.
     * @returns {boolean} True if satisfied
     */
    this.pathLengthFromSatisfied = function() {
        return !this.expandPath() || (pathLengthFrom == null) || (pathLengthFrom && expandedPath.length >= pathLengthFrom);
    };

    /**
     * Check if the maximum path length is satisfied.
     * @returns {boolean} True if satisfied
     */
    this.pathLengthToSatisfied = function() {
        return !this.expandPath() || (pathLengthTo == null) || (pathLengthTo && expandedPath.length <= pathLengthTo);
    };

    /**
     * Check if the path length is satisfied (both min and max).
     * @returns {boolean} True if satisfied
     */
    this.pathLengthSatisfied = function() {
        return this.pathLengthFromSatisfied() && this.pathLengthToSatisfied();
    };

    /**
     * Get the expanded path.
     * @returns {number[]} Array of relationship IDs in the expanded path
     */
    this.getExpandedPath = function() {
        return expandedPath;
    };

    /**
     * Set the shortest path (for shortest path queries).
     * @param {number[]} shortestPath - Array of relationship IDs
     */
    this.setShortestPath = function(shortestPath) {
        expandedPath = shortestPath;
    };

    /**
     * Get the data for this relationship.
     * @returns {List|RelationshipReference} The relationship data
     */
    this.getData = function() {
        var List = (typeof module !== 'undefined' && module.exports ?
            require('../structures/List.js').List :
            CypherNG.structures.List);

        if (hasVariablePathLength) {
            return new List(
                expandedPath,
                (function(relationshipId) {
                    return db.getRelationshipById(relationshipId).value();
                })
            );
        }
        return db.getRelationshipById(matchedRelationship);
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
     * Get a property value by key from the matched relationship.
     * @param {string} key - The property key
     * @returns {*} The property value or null
     */
    this.getProperty = function(key) {
        if (!db.getRelationshipById(matchedRelationship)) return null;
        return db.getRelationshipById(matchedRelationship).getLocalProperty(key);
    };

    /**
     * Get the group key for aggregation.
     * @returns {number} The relationship ID
     */
    this.groupByKey = function() {
        return this.getData().id();
    };

    /**
     * Get the group value for aggregation.
     * @returns {Object} The relationship reference
     */
    this.groupByValue = function() {
        return this.getData().get();
    };

    /**
     * Create a copy of this relationship.
     * @returns {Relationship} A new Relationship instance with the same properties
     */
    this.copy = function() {
        var r = new Relationship(db);
        r.setType(relationshipType);
        r.setProperties(properties);
        r.setLeftDirection(leftDirection);
        r.setRightDirection(rightDirection);
        r.setFromNode(fromNode);
        r.setToNode(toNode);
        return r;
    };

    /**
     * Check if this relationship is mappable (for serialization).
     * @returns {boolean} True if the relationship is mappable
     */
    this.mappable = function() {
        if (referredRelationship) {
            if (referredRelationship.mappable && !referredRelationship.mappable()) {
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
    exports.Relationship = Relationship;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).core = (this.CypherNG = this.CypherNG || {}).core || {});
