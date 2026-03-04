/**
 * @fileoverview Where class for CypherNG.
 * Represents a WHERE condition handler.
 */

/**
 * Where - Represents a WHERE condition in a query.
 * Evaluates boolean expressions to filter results.
 *
 * @class
 * @memberof CypherNG.query
 * @param {Object} _expression - The boolean expression to evaluate
 */
function Where(_expression) {
    var expression = _expression;

    // Persistence Design Note: Where conditions are transient query filters.
    // They do not need persistence.

    /**
     * Evaluate the where condition.
     * @returns {boolean} True if condition is met
     */
    this.evaluate = function() {
        return expression.value() == true;
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Where"
     */
    this.type = function() {
        return this.constructor.name;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Where = Where;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query = (this.CypherNG = this.CypherNG || {}).query || {});
