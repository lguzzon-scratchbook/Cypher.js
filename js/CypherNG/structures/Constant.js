/**
 * @fileoverview Constant - Constant value wrapper.
 * Part of CypherNG data structures.
 */

/**
 * Constant - A wrapper for constant values.
 *
 * @class
 * @memberof CypherNG.structures
 * @param {*} _value - The constant value to wrap
 * @description
 * Simple wrapper for constant values. Provides a uniform interface
 * for values that don't need evaluation or binding.
 *
 * Persistence Design Note: This wraps a simple value. For persistence,
 * store the underlying value directly (call value() or getObject()).
 */
function Constant(_value) {
    var value = _value;
    var me = this;

    /**
     * Get the value (alias for value).
     *
     * @returns {*} The constant value
     */
    this.get = function() {
        return value;
    };

    /**
     * Iterator: Get next element (not implemented).
     *
     * @returns {boolean} Always returns false
     */
    this.next = function() {
        return false;
    };

    /**
     * Iterator: Check if more elements exist.
     *
     * @returns {boolean} Always returns true
     */
    this.hasNext = function() {
        return true;
    };

    /**
     * Iterator: Reset iterator position.
     */
    this.reset = function() {
        ;
    };

    /**
     * Get the data object.
     *
     * @returns {Constant} This instance
     */
    this.getData = function() {
        return this;
    };

    /**
     * Get the object (alias for value).
     *
     * @returns {*} The constant value
     */
    this.getObject = function() {
        return value;
    };

    /**
     * Get the value.
     *
     * @returns {*} The constant value
     */
    this.value = function() {
        return value;
    };

    /**
     * Get the id property of the value (if it exists).
     *
     * @returns {*} The id property of the value
     */
    this.id = function() {
        return value.id;
    };

    /**
     * Set a new value.
     *
     * @param {*} _value - The new value
     */
    this.setValue = function(_value) {
        value = _value;
    };

    /**
     * Get the type name.
     *
     * @returns {string} The constructor name
     */
    this.type = function() {
        return this.constructor.name;
    };

    /**
     * Group by key (alias for value).
     *
     * @returns {*} The constant value
     */
    this.groupByKey = function() {
        return value;
    };

    /**
     * Group by value (alias for value).
     *
     * @returns {*} The constant value
     */
    this.groupByValue = function() {
        return value;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Constant = Constant;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).structures = (this.CypherNG = this.CypherNG || {}).structures || {});
