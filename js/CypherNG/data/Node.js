/**
 * @fileoverview Node class for CypherNG
 *
 * Represents a node in the graph database.
 *
 * @module CypherNG/data/Node
 */

/**
 * Node class for representing graph nodes
 * @class
 */
class Node {
    /**
     * Creates a new Node
     * @param {Database} db - Database instance
     */
    constructor(db) {
        /** @private @type {Database} */
        this._db = db;
        /** @private @type {number|null} */
        this._id = null;
        /** @private @type {Object} */
        this._labels = {};
        /** @private @type {Object} */
        this._propertyExpressions = {};
        /** @private @type {Object} */
        this._properties = {};
        /** @private @type {string|undefined} */
        this._variableKey = undefined;
        /** @private @type {Node|null} */
        this._referredNode = null;
        /** @private @type {Node|null} */
        this._expandedNode = null;
        /** @private @type {Object|null} */
        this._previousObject = null;
        /** @private @type {Object|null} */
        this._nextObject = null;
        /** @private @type {string|null} */
        this._pattern = null;
        /** @private @type {boolean} */
        this._expandedIsMatched = false;
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
     * Gets the next node in the path
     * @returns {Node|null} Next node
     */
    nextNode() {
        if (this.getNextObject()) {
            if (this.getNextObject().isRelationship()) {
                return this.getNextObject().getNextObject();
            } else if (this.getNextObject().isNode()) {
                return this.getNextObject();
            }
        }
        return null;
    }

    /**
     * Gets the previous node in the path
     * @returns {Node|null} Previous node
     */
    previousNode() {
        if (this.getPreviousObject()) {
            if (this.getPreviousObject().isRelationship()) {
                return this.getPreviousObject().getPreviousObject();
            } else if (this.getPreviousObject().isNode()) {
                return this.getPreviousObject();
            }
        }
        return null;
    }

    /**
     * Gets incoming relationship
     * @returns {Relationship|null} Incoming relationship
     */
    incomingRelationship() {
        if (this.getPreviousObject()) {
            if (this.getPreviousObject().isRelationship()) {
                return this.getPreviousObject();
            }
        }
        return null;
    }

    /**
     * Gets outgoing relationship
     * @returns {Relationship|null} Outgoing relationship
     */
    outgoingRelationship() {
        if (this.getNextObject()) {
            if (this.getNextObject().isRelationship()) {
                return this.getNextObject();
            }
        }
        return null;
    }

    /**
     * Sets the node ID
     * @param {number} id - Node ID
     */
    setId(id) {
        this._id = id;
    }

    /**
     * Gets the node ID
     * @returns {number|null} Node ID
     */
    id() {
        return this._id;
    }

    /**
     * Gets the node ID (alias for id())
     * @returns {number|null} Node ID
     */
    getId() {
        return this.id();
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
     * Sets multiple properties
     * @param {Object} properties - Properties object
     */
    setProperties(properties) {
        for (var key in properties) {
            this._properties[key] = properties[key];
        }
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
     * Sets a label
     * @param {string} labelName - Label name
     * @param {number} nodeId - Node ID
     */
    setLabel(labelName, nodeId) {
        this._labels[labelName] = true;
        this._db._addLabelNodeIdLookup(labelName, nodeId);
    }

    /**
     * Checks if node has a label
     * @param {string} labelName - Label name
     * @returns {boolean} True if label exists
     */
    hasLabel(labelName) {
        return this._labels[labelName];
    }

    /**
     * Sets multiple labels
     * @param {Object} labels - Labels object
     */
    setLabels(labels) {
        for (var label in labels) {
            this._labels[label] = labels[label];
        }
    }

    /**
     * Sets the variable key
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
     * Checks if node has a variable key
     * @returns {boolean} True if variable key exists
     */
    hasVariableKey() {
        return this._variableKey != undefined;
    }

    /**
     * Gets all properties
     * @returns {Object} Properties object
     */
    getProperties() {
        return {...this._properties};
    }

    /**
     * Gets raw properties (reference)
     * @returns {Object} Properties object
     */
    getRawProperties() {
        return this._properties;
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
     * Gets labels
     * @returns {Object} Labels object
     */
    labels() {
        return this._labels;
    }

    /**
     * Gets labels as array
     * @returns {string[]} Array of label names
     */
    getLabels() {
        return Object.keys(this._labels);
    }

    /**
     * Checks if node has any labels
     * @returns {boolean} True if has labels
     */
    hasLabels() {
        return Object.keys(this._labels).length > 0;
    }

    /**
     * Checks if node has any properties
     * @returns {boolean} True if has properties
     */
    hasProperties() {
        return Object.keys(this._properties).length > 0;
    }

    /**
     * Gets the node reference
     * @param {boolean} [asKey] - If true, returns ID only
     * @returns {Object} Node reference
     */
    get(asKey) {
        if (asKey) {
            return this._id;
        }
        // Return NodeReference - for now return this
        // Full implementation would return NodeReference(db, id)
        return this;
    }

    /**
     * Converts node to object representation
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            id: this._id,
            labels: this.getLabels(),
            properties: this._properties,
            getProperty: (key) => this._properties[key],
            getProperties: () => this._properties,
            getLabels: () => this._labels,
            getKeys: () => Object.keys(this._properties)
        };
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
     * @returns {boolean} False for Node
     */
    isRelationship() {
        return false;
    }

    /**
     * Checks if this is a node
     * @returns {boolean} True for Node
     */
    isNode() {
        return true;
    }

    /**
     * Sets the referred node
     * @param {Node} referredNode - Referred node
     */
    setReferredNode(referredNode) {
        this._referredNode = referredNode;
    }

    /**
     * Gets the referred node
     * @returns {Node|null} Referred node
     */
    getReferredNode() {
        return this._referredNode;
    }

    /**
     * Checks if node is referred
     * @returns {boolean} True if referred
     */
    isReferred() {
        return this._referredNode != null;
    }

    /**
     * Gets the underlying data object
     * @returns {Node} This node
     */
    getData() {
        return this;
    }

    /**
     * Gets the object for grouping
     * @returns {number} Node ID
     */
    groupByKey() {
        return this._id;
    }

    /**
     * Gets the object for grouping value
     * @returns {Node} This node
     */
    groupByValue() {
        return this;
    }

    /**
     * Converts to string
     * @returns {string} JSON string
     */
    toString() {
        return JSON.stringify(this.get());
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Node;
}