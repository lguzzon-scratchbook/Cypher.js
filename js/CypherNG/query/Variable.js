/**
 * @fileoverview Variable class for CypherNG
 * 
 * Represents a variable in a Cypher query.
 * 
 * @module CypherNG/query/Variable
 */

/**
 * Variable class
 * @class
 */
class Variable {
    /**
     * Creates a new Variable
     * @param {Object} object - Object this variable references
     * @param {string} key - Variable key/name
     */
    constructor(object, key) {
        /** @private @type {Object} */
        this._object = object;
        /** @private @type {string} */
        this._objectKey = key;
        /** @private @type {*|null} */
        this._overriddenValue = null;
    }

    /**
     * Gets the object key
     * @returns {string} Object key
     */
    getObjectKey() {
        return this._objectKey;
    }

    /**
     * Gets the object
     * @returns {Object} Referenced object
     */
    getObject() {
        if (this._overriddenValue) {
            return this._overriddenValue;
        }
        if (this._object.constructor && this._object.constructor.name === 'Constant') {
            return this._object.getObject();
        }
        return this._object;
    }

    /**
     * Gets the value
     * @param {boolean} [asKey] - If true, returns ID
     * @returns {*} Value
     */
    value(asKey) {
        if (this._overriddenValue) {
            return this._overriddenValue;
        }
        try {
            return this._object.getData().get(asKey);
        } catch (e) {
            // Ignore
        }
        return null;
    }

    /**
     * Sets an overridden value
     * @param {*} overriddenValue - Value to override with
     */
    setOverriddenValue(overriddenValue) {
        this._overriddenValue = overriddenValue;
    }

    /**
     * Gets the type name
     * @returns {string} Type name
     */
    type() {
        return this.constructor.name;
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Variable;
}
