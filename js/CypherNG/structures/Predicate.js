/**
 * @fileoverview Predicate - Predicate functions (all, any, sum).
 * Part of CypherNG data structures.
 */

/**
 * Predicate - Implements predicate functions for list comprehension.
 *
 * @class
 * @memberof CypherNG.structures
 * @description
 * Implements predicate functions like all(), any(), and sum() for
 * evaluating conditions over lists. Used in Cypher list comprehensions.
 *
 * @example
 * var pred = new Predicate();
 * pred.setPredicateFunctionName("all");
 * pred.variable("x");
 * pred.list(myList);
 * pred.where(condition);
 * var result = pred.value(); // true if all elements match condition
 *
 * Persistence Design Note: This is a computed expression, not stored data.
 * For persistence, evaluate the expression and store the result value only.
 */
function Predicate() {
    var me = this;
    var predicateFunctionName = null;
    var _variable = null;
    var list = null;
    var where = null;

    /**
     * Set the predicate function name.
     *
     * @param {string} _predicateFunctionName - One of: "all", "any", "sum"
     */
    this.setPredicateFunctionName = function(_predicateFunctionName) {
        predicateFunctionName = _predicateFunctionName;
    };

    /**
     * Set the variable name for iteration.
     *
     * @param {string} _variableName - The variable name
     */
    this.variable = function(_variableName) {
        var Variable = (typeof module !== 'undefined' && module.exports ?
            require('../query/Expression.js').Variable :
            CypherNG.query.Variable);
        _variable = new Variable(null, _variableName);
    };

    /**
     * Set the list to iterate over.
     *
     * @param {*} _list - The list expression
     */
    this.list = function(_list) {
        list = _list;
    };

    /**
     * Set the where condition.
     *
     * @param {*} _where - The where condition expression
     */
    this.where = function(_where) {
        where = _where;
        if ("setLocalVariable" in where && _variable) {
            where.setLocalVariable(_variable.getObjectKey(), _variable);
        }
    };

    /**
     * Get the value (alias for value).
     *
     * @returns {*} The predicate result
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
     * @returns {Predicate} This instance
     */
    this.getData = function() {
        return me;
    };

    /**
     * Evaluate the predicate.
     *
     * @returns {boolean|number} Result depends on predicate function:
     *   - "all": true if all elements match
     *   - "any": true if any element matches
     *   - "sum": count of matching elements
     * @throws {Error} If list value is not an array
     */
    this.value = function() {
        var _list = list.value();
        if (_list.constructor != Array) {
            throw "Predicate list must be an array.";
        }
        var trues = 0;
        for (var i = 0; i < _list.length; i++) {
            _variable.setOverriddenValue(_list[i]);
            if (where.value()) {
                trues++;
            }
        }
        if (predicateFunctionName == "all") {
            return trues == _list.length;
        } else if (predicateFunctionName == "any") {
            return trues > 0;
        } else if (predicateFunctionName == "sum") {
            return trues;
        }
        return false;
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
     * @returns {*} The predicate result
     */
    this.groupByKey = function() {
        return me.get();
    };

    /**
     * Group by value (alias for get).
     *
     * @returns {*} The predicate result
     */
    this.groupByValue = function() {
        return me.get();
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Predicate = Predicate;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).structures = (this.CypherNG = this.CypherNG || {}).structures || {});
