/**
 * @fileoverview FString - Format string with expressions.
 * Part of CypherNG data structures.
 */

/**
 * FString - Format string builder with embedded expressions.
 *
 * @class
 * @memberof CypherNG.structures
 * @description
 * Builds strings by combining literal string parts with dynamic
 * expressions. Expressions are evaluated when the string is accessed.
 *
 * @example
 * var fstr = new FString();
 * fstr.string("Hello, ");
 * fstr.expression(nameExpression);
 * fstr.string("!");
 * var result = fstr.value(); // "Hello, John!"
 *
 * Persistence Design Note: This is a computed expression, not stored data.
 * For persistence, evaluate the expression and store the result string only.
 */
function FString() {
    var parts = [];
    var me = this;

    /**
     * Add a literal string part.
     *
     * @param {string} _string - The literal string to add
     */
    this.string = function(_string) {
        parts.push(_string);
    };

    /**
     * Add an expression part.
     *
     * @param {*} expression - The expression to evaluate and add
     */
    this.expression = function(expression) {
        parts.push(expression);
    };

    /**
     * Get the value (alias for value).
     *
     * @returns {string} The combined string
     */
    this.get = function() {
        return this.value();
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
     * @returns {FString} This instance
     */
    this.getData = function() {
        return me;
    };

    /**
     * Evaluate and combine all parts into a string.
     *
     * @returns {string} The combined string with all expressions evaluated
     */
    this.value = function() {
        var combined = '';
        for (var i = 0; i < parts.length; i++) {
            if (parts[i].value) {
                combined += parts[i].value();
            } else {
                combined += parts[i];
            }
        }
        return combined;
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
     * Group by key (alias for get).
     *
     * @returns {string} The combined string
     */
    this.groupByKey = function() {
        return me.get();
    };

    /**
     * Group by value (alias for get).
     *
     * @returns {string} The combined string
     */
    this.groupByValue = function() {
        return me.get();
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.FString = FString;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).structures = (this.CypherNG = this.CypherNG || {}).structures || {});
