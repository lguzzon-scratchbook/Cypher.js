/**
 * @fileoverview Case - CASE WHEN expression handler.
 * Part of CypherNG data structures.
 */

/**
 * Case - Handles CASE WHEN expressions.
 *
 * @class
 * @memberof CypherNG.structures
 * @description
 * Implements SQL-style CASE WHEN expressions. Supports multiple
 * when/then clauses and an optional else clause.
 *
 * @example
 * var caseExpr = new Case();
 * caseExpr.when(condition1);
 * caseExpr.then(result1);
 * caseExpr.when(condition2);
 * caseExpr.then(result2);
 * caseExpr.else(defaultResult);
 * var result = caseExpr.value(); // Returns result of first true condition
 *
 * Persistence Design Note: This is a computed expression, not stored data.
 * For persistence, evaluate the expression and store the result value only.
 */
function Case() {
    var me = this;
    var whens = [];
    var thens = [];
    var _else;

    /**
     * Add a WHEN clause.
     *
     * @param {*} expression - The condition expression
     */
    this.when = function(expression) {
        whens.push(expression);
    };

    /**
     * Get the count of when clauses.
     *
     * @returns {number} Number of when clauses
     */
    this.whenCount = function() {
        return whens.length;
    };

    /**
     * Add a THEN clause.
     *
     * @param {*} expression - The result expression for the corresponding when
     */
    this.then = function(expression) {
        thens.push(expression);
    };

    /**
     * Set the ELSE clause.
     *
     * @param {*} expression - The default result expression
     */
    this.else = function(expression) {
        _else = expression;
    };

    /**
     * Get the value (alias for value).
     *
     * @returns {*} The result of the CASE expression
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
     * @returns {Case} This instance
     */
    this.getData = function() {
        return me;
    };

    /**
     * Evaluate the CASE expression.
     *
     * @returns {*} The result of the first matching then clause, or else value
     */
    this.value = function() {
        for (var i = 0; i < whens.length; i++) {
            if (whens[i].value()) {
                return thens[i].value();
            }
        }
        return _else.value();
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
     * @returns {*} The result of the CASE expression
     */
    this.groupByKey = function() {
        return me.get();
    };

    /**
     * Group by value (alias for get).
     *
     * @returns {*} The result of the CASE expression
     */
    this.groupByValue = function() {
        return me.get();
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Case = Case;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).structures = (this.CypherNG = this.CypherNG || {}).structures || {});
