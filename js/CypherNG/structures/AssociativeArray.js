/**
 * @fileoverview AssociativeArray - Associative array with binding support.
 * Part of CypherNG data structures.
 */

/**
 * AssociativeArray - A key-value store with lazy binding support.
 *
 * @class
 * @memberof CypherNG.structures
 * @description
 * Associative array that supports binding - values can be expressions
 * that are evaluated when the array is accessed. Useful for query
 * results where values may be computed lazily.
 *
 * Persistence Design Note: The internal associativeArray object stores
 * raw values (potentially expressions). For persistence, serialize
 * the bound values only (call value() on each entry before storage).
 */
function AssociativeArray() {
    var associativeArray = {};
    var boundAssociativeArray = {};
    var keys = [];
    var me = this;

    /**
     * Bind all values - evaluate expressions and store in bound array.
     * @private
     */
    var bind = function() {
        for (var key in associativeArray) {
            boundAssociativeArray[key] =
                associativeArray[key].value();
        }
    };

    /**
     * Add an entry to the associative array.
     *
     * @param {string} key - The key for the entry
     * @param {*} element - The value or expression to store
     * @throws {Error} If key already exists
     */
    this.addEntry = function(key, element) {
        if (key in associativeArray) {
            throw "Key \"" + key + "\" already exists in associative array.";
        }
        associativeArray[key] = element;
        boundAssociativeArray[key] = null;
        keys.push(key);
    };

    /**
     * Get the associative array as a plain object.
     *
     * @param {boolean} [_addAssociativeArrayFunctions=true] - Whether to add helper functions
     * @returns {Object} The bound associative array as a plain object
     */
    this.get = function(_addAssociativeArrayFunctions = true) {
        bind();
        var boundAssociativeArrayCopy = {};
        for (var key in boundAssociativeArray) {
            boundAssociativeArrayCopy[key] = boundAssociativeArray[key];
            if (boundAssociativeArrayCopy[key]) {
                boundAssociativeArrayCopy[key].constructor =
                    boundAssociativeArray[key].constructor;
            }
        }
        if (_addAssociativeArrayFunctions) {
            var addAssociativeArrayFunctions = (typeof module !== 'undefined' && module.exports ?
                require('./utils.js').addAssociativeArrayFunctions :
                CypherNG.structures.addAssociativeArrayFunctions);
            return addAssociativeArrayFunctions(
                boundAssociativeArrayCopy
            );
        }
        return boundAssociativeArray;
    };

    /**
     * Get a property by key.
     *
     * @param {string} key - The property key
     * @returns {*} The property value
     */
    this.getProperty = function(key) {
        bind();
        return boundAssociativeArray[key];
    };

    /**
     * Get all property keys.
     *
     * @returns {string[]} Array of property keys
     */
    this.getProperties = function() {
        return Object.keys(associativeArray);
    };

    /**
     * Get all values (without keys).
     *
     * @returns {*[]} Array of values
     */
    this.getValues = function() {
        return Object.values(associativeArray);
    };

    /**
     * Set a value by index.
     *
     * @param {number} index - The index in the keys array
     * @param {*} element - The new value
     */
    this.setValue = function(index, element) {
        associativeArray[keys[index]] = element;
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
     * @returns {AssociativeArray} This instance
     */
    this.getData = function() {
        return me;
    };

    /**
     * Get the object (alias for getData).
     *
     * @returns {AssociativeArray} This instance
     */
    this.getObject = function() {
        return me;
    };

    /**
     * Get the value (alias for get).
     *
     * @param {boolean} [_addAssociativeArrayFunctions=true] - Whether to add helper functions
     * @returns {Object} The bound associative array
     */
    this.value = function(_addAssociativeArrayFunctions = true) {
        return me.get(_addAssociativeArrayFunctions);
    };

    /**
     * Get the type name.
     *
     * @returns {string} The constructor name
     */
    this.type = function() {
        return me.constructor.name;
    };

    /**
     * Get a string representation.
     *
     * @returns {string} JSON string representation
     */
    this.toString = function() {
        bind();
        return JSON.stringify(boundAssociativeArray);
    };

    /**
     * Group by key (alias for toString).
     *
     * @returns {string} JSON string representation
     */
    this.groupByKey = function() {
        return me.toString();
    };

    /**
     * Group by value (alias for get).
     *
     * @returns {Object} The bound associative array
     */
    this.groupByValue = function() {
        return me.get();
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.AssociativeArray = AssociativeArray;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).structures = (this.CypherNG = this.CypherNG || {}).structures || {});
