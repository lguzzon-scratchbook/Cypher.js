/**
 * @fileoverview Relationship class for CypherNG
 *
 * Represents a relationship between nodes in the graph database.
 *
 * @module CypherNG/data/Relationship
 */

/**
 * Relationship class for representing graph relationships
 * @class
 */
class Relationship {
    /**
     * Creates a new Relationship
     * @param {Database} db - Database instance
     */
    constructor(db) {
        /** @private @type {Database} */
        this._db = db;
        /** @private @type {number|null} */
        this._id = null;
        /** @private @type {string|null} */
        this._relationshipType = null;
        /** @private @type {Object} */
        this._properties = {};
        /** @private @type {Object} */
        this._propertyExpressions = {};
        /** @private @type {Node|null} */
        this._fromNode = null;
        /** @private @type {Node|null} */
        this._toNode = null;
        /** @private @type {boolean} */
        this._leftDirection = false;
        /** @private @type {boolean} */
        this._rightDirection = false;
        /** @private @type {string|undefined} */
        this._variableKey = undefined;
        /** @private @type {Object|null} */
        this._previousObject = null;
        /** @private @type {Object|null} */
        this._nextObject = null;
        /** @private @type {boolean} */
        this._isAdded = false;
        /** @private @type {boolean} */
        this._hasVariablePathLength = false;
        /** @private @type {number|null} */
        this._pathLengthFrom = 1;
        /** @private @type {number|null} */
        this._pathLengthTo = 1;
        /** @private @type {string|null} */
        this._pattern = null;
        /** @private @type {Relationship|null} */
        this._referredRelationship = null;
    }

    /**
     * Sets the previous object in the path
     * @param {Object} object - Previous object
     */
    setPreviousObject(object) {
        this._previousObject = object;
    }

    /**
     * Gets the previous object in the path
     * @returns {Object|null} Previous object
     */
    getPreviousObject() {
        return this._previousObject;
    }

    /**
     * Sets the next object in the path
     * @param {Object} object - Next object
     */
    setNextObject(object) {
        this._nextObject = object;
    }

    /**
     * Gets the next object in the path
     * @returns {Object|null} Next object
     */
    getNextObject() {
        return this._nextObject;
    }

    /**
     * Sets the pattern
     * @param {string} pattern - Pattern string
     */
    setPattern(pattern) {
        this._pattern = pattern;
    }

    /**
     * Gets the pattern
     * @returns {string|null} Pattern string
     */
    getPattern() {
        return this._pattern;
    }

    /**
     * Sets the relationship ID
     * @param {number} id - Relationship ID
     */
    setId(id) {
        this._id = id;
    }

    /**
     * Gets the relationship ID
     * @returns {number|null} Relationship ID
     */
    id() {
        return this._id;
    }

    /**
     * Sets the stored type
     * @param {string} type - Relationship type
     */
    setStoredType(type) {
        this._relationshipType = type;
    }

    /**
     * Sets the relationship type
     * @param {string} type - Relationship type
     * @param {number} relationshipId - Relationship ID
     */
    setType(type, relationshipId) {
        this._relationshipType = type;
    }

    /**
     * Gets the relationship type
     * @returns {string|null} Relationship type
     */
    getType() {
        return this._relationshipType;
    }

    /**
     * Sets a property
     * @param {string} key - Property key
     * @param {Object} expression - Expression containing value function
     */
    setProperty(key, expression) {
        this._properties[key] = null;
        this._propertyExpressions[key] = expression.value;
    }

    /**
     * Binds a property value from expression
     * @param {string} key - Property key
     */
    bindProperty(key) {
        this._properties[key] = this._propertyExpressions[key]();
    }

    /**
     * Binds all properties
     */
    bindProperties() {
        for (var key in this._properties) {
            this.bindProperty(key);
        }
    }

    /**
     * Sets multiple properties
     * @param {Object} properties - Properties object
     */
    setProperties(properties) {
        for (var key in properties) {
            this._properties[key] = properties[key];
        }
    }

    /**
     * Gets a property value
     * @param {string} key - Property key
     * @returns {*} Property value
     */
    getProperty(key) {
        return this._properties[key];
    }

    /**
     * Gets all properties
     * @returns {Object} Properties object
     */
    getProperties() {
        return this._properties;
    }

    /**
     * Gets relationship properties
     * @returns {Object} Properties object
     */
    getRelationshipProperties() {
        return this._properties;
    }

    /**
     * Sets the from node
     * @param {Node} node - From node
     */
    setFromNode(node) {
        this._fromNode = node;
    }

    /**
     * Sets the to node
     * @param {Node} node - To node
     */
    setToNode(node) {
        this._toNode = node;
    }

    /**
     * Gets the from node
     * @param {number} [fromNodeId] - Optional from node ID for direction calculation
     * @returns {Node|null} From node
     */
    getFromNode(fromNodeId) {
        if (fromNodeId != undefined) {
            if (fromNodeId != this._fromNode.id()) {
                return this._toNode;
            }
        }
        return this._fromNode;
    }

    /**
     * Gets the to node
     * @param {number} [fromNodeId] - Optional from node ID for direction calculation
     * @returns {Node|null} To node
     */
    getToNode(fromNodeId) {
        if (fromNodeId != undefined) {
            if (fromNodeId != this._fromNode.id()) {
                return this._fromNode;
            }
        }
        return this._toNode;
    }

    /**
     * Sets left direction
     * @param {boolean} leftDirection - Left direction flag (default true)
     */
    setLeftDirection(leftDirection) {
        this._leftDirection = leftDirection !== undefined ? leftDirection : true;
    }

    /**
     * Sets right direction
     * @param {boolean} rightDirection - Right direction flag (default true)
     */
    setRightDirection(rightDirection) {
        this._rightDirection = rightDirection !== undefined ? rightDirection : true;
    }

    /**
     * Gets left direction
     * @param {number} [fromNodeId] - Optional from node ID for direction calculation
     * @returns {boolean} Left direction flag
     */
    leftDirection(fromNodeId) {
        if (fromNodeId != undefined) {
            if (fromNodeId != this._fromNode.id()) {
                return !this._leftDirection && this._rightDirection;
            }
        }
        return this._leftDirection && !this._rightDirection;
    }

    /**
     * Gets right direction
     * @param {number} [fromNodeId] - Optional from node ID for direction calculation
     * @returns {boolean} Right direction flag
     */
    rightDirection(fromNodeId) {
        if (fromNodeId != undefined) {
            if (fromNodeId != this._fromNode.id()) {
                return !this._rightDirection && this._leftDirection;
            }
        }
        return this._rightDirection && !this._leftDirection;
    }

    /**
     * Checks if relationship is bidirectional
     * @returns {boolean} True if bidirectional
     */
    uniDirectional() {
        return (this._rightDirection && this._leftDirection) || (!this._leftDirection && !this._rightDirection);
    }

    /**
     * Checks if relationship has no direction
     * @returns {boolean} True if no direction
     */
    noDirection() {
        return !this._leftDirection && !this._rightDirection;
    }

    /**
     * Gets direction string
     * @returns {string} Direction: "left", "right", "both", or "none"
     */
    direction() {
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
    }

    /**
     * Gets type name
     * @returns {string} Type name
     */
    type() {
        return this.constructor.name;
    }

    /**
     * Checks if this is a relationship
     * @returns {boolean} True for Relationship
     */
    isRelationship() {
        return true;
    }

    /**
     * Checks if this is a node
     * @returns {boolean} False for Relationship
     */
    isNode() {
        return false;
    }

    /**
     * Sets the referred relationship
     * @param {Relationship} referredRelationship - Referred relationship
     */
    setReferredRelationship(referredRelationship) {
        this._referredRelationship = referredRelationship;
    }

    /**
     * Checks if relationship is referred
     * @returns {boolean} True if referred
     */
    isReferred() {
        return this._referredRelationship != null;
    }

    /**
     * Gets the referred relationship
     * @returns {Relationship|null} Referred relationship
     */
    getReferredRelationship() {
        return this._referredRelationship;
    }

    /**
     * Checks if relationship is added
     * @returns {boolean} True if added
     */
    isAdded() {
        return this._isAdded;
    }

    /**
     * Marks relationship as added
     */
    setIsAdded() {
        this._isAdded = true;
    }

    /**
     * Sets variable path length
     */
    setHasVariablePathLength() {
        this._hasVariablePathLength = true;
        this._pathLengthFrom = null;
        this._pathLengthTo = null;
    }

    /**
     * Checks if has variable path length
     * @returns {boolean} True if variable path length
     */
    hasVariablePathLength() {
        return this._hasVariablePathLength;
    }

    /**
     * Sets path length from
     * @param {number} pathLengthFrom - Path length from
     */
    setPathLengthFrom(pathLengthFrom) {
        this._pathLengthFrom = pathLengthFrom;
    }

    /**
     * Gets path length from
     * @returns {number|null} Path length from
     */
    pathLengthFrom() {
        return this._pathLengthFrom;
    }

    /**
     * Sets path length to
     * @param {number} pathLengthTo - Path length to
     */
    setPathLengthTo(pathLengthTo) {
        this._pathLengthTo = pathLengthTo;
    }

    /**
     * Gets path length to
     * @returns {number|null} Path length to
     */
    pathLengthTo() {
        return this._pathLengthTo;
    }

    /**
     * Checks if should expand path
     * @returns {boolean} True if should expand path
     */
    expandPath() {
        return this._hasVariablePathLength;
    }

    /**
     * Gets a local property value
     * @param {string} key - Property key
     * @returns {*} Property value
     */
    getLocalProperty(key) {
        return this._properties[key];
    }

    /**
     * Gets the relationship data
     * @returns {Relationship} This relationship
     */
    getData() {
        return this;
    }

    /**
     * Gets the object for grouping
     * @returns {number} Relationship ID
     */
    groupByKey() {
        return this._id;
    }

    /**
     * Gets the object for grouping value
     * @returns {Relationship} This relationship
     */
    groupByValue() {
        return this;
    }

    /**
     * Sets variable key
     * @param {string} variableKey - Variable key
     */
    setVariableKey(variableKey) {
        this._variableKey = variableKey;
    }

    /**
     * Gets the variable key
     * @returns {string|undefined} Variable key
     */
    getVariableKey() {
        return this._variableKey;
    }

    /**
     * Checks if has variable key
     * @returns {boolean} True if has variable key
     */
    hasVariableKey() {
        return this._variableKey != undefined;
    }

    /**
     * Converts to string
     * @returns {string} JSON string
     */
    toString() {
        return JSON.stringify({
            id: this._id,
            type: this._relationshipType,
            from: this._fromNode ? this._fromNode.id() : null,
            to: this._toNode ? this._toNode.id() : null,
            properties: this._properties
        });
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Relationship;
}