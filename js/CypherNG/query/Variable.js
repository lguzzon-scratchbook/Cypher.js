/**
 * @fileoverview Variable class for CypherNG.
 * Represents a variable reference in a query.
 */

var Constant = (typeof module !== 'undefined' && module.exports ?
    require('../structures/Constant.js').Constant :
    CypherNG.structures.Constant);

/**
 * Variable - Represents a variable reference in a query.
 * Variables hold references to nodes, relationships, or computed values.
 *
 * @class
 * @memberof CypherNG.query
 * @param {Object} _object - The object the variable references
 * @param {string} key - The variable key/name
 */
function Variable(_object, key) {
    var object = _object;
    var objectKey = key;
    var overriddenValue = null;

    // Persistence Design Note: Variables are transient query-state containers.
    // They do not need persistence but may reference persistent entities.

    /**
     * Get the variable key/name.
     * @returns {string} The variable key
     */
    this.getObjectKey = function() {
        return objectKey;
    };

    /**
     * Get the object this variable references.
     * @returns {Object} The referenced object
     */
    this.getObject = function() {
        if (overriddenValue) {
            return overriddenValue;
        }
        if (object.constructor == Constant) {
            return object.getObject();
        }
        return object;
    };

    /**
     * Get the variable value.
     * @param {string} [asKey] - Optional key to retrieve from object
     * @returns {*} The variable value
     */
    this.value = function(asKey) {
        if (overriddenValue) {
            return overriddenValue;
        }
        try {
            return object.getData().get(asKey);
        } catch (e) {
            ;
        }
        return null;
    };

    /**
     * Set an overridden value for this variable.
     * @param {*} _overriddenValue - The new value
     */
    this.setOverriddenValue = function(_overriddenValue) {
        overriddenValue = _overriddenValue;
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Variable"
     */
    this.type = function() {
        return this.constructor.name;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Variable = Variable;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query = (this.CypherNG = this.CypherNG || {}).query || {});
