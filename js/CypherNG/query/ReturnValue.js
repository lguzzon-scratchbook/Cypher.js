/**
 * @fileoverview ReturnValue class for CypherNG.
 * Represents a return value wrapper.
 */

/**
 * ReturnValue - Represents a return value wrapper.
 * Wraps an expression for output in RETURN clauses.
 *
 * @class
 * @memberof CypherNG.query
 * @param {Object} _expression - The expression to return
 * @param {Object} _statement - The parent statement
 * @param {Object} _parent - The parent operation (Return)
 * @param {boolean} [isHidden] - Whether this is a hidden return value
 */
function ReturnValue(_expression, _statement, _parent, isHidden) {
    var expression = _expression;
    var statement = _statement;
    var alias = expression.getAlias();
    var id = 0;
    var groupByValue;
    var me = this;
    var hidden = isHidden;
    var parent = _parent;

    // Persistence Design Note: ReturnValues are transient result containers.
    // They do not need persistence but wrap persistent entity values.

    /**
     * Get the return value alias.
     * @returns {string} The alias
     */
    this.getAlias = function() {
        return alias;
    };

    /**
     * Set the return value alias.
     * @param {string} _alias - The new alias
     */
    this.setAlias = function(_alias) {
        alias = _alias;

        statement.addVariable(
            alias,
            this
        );
    };

    /**
     * Check if the return value has a key.
     * @returns {boolean} True if has key
     */
    this.hasKey = function() {
        return expression.hasKey();
    };

    /**
     * Set the return value id.
     * @param {number} _id - The id
     */
    this.setId = function(_id) {
        id = _id;
    };

    /**
     * Get the return value id.
     * @returns {number} The id
     */
    this.getId = function() {
        return id;
    };

    /**
     * Get the return value.
     * @returns {*} The value
     */
    this.value = function() {
        if (groupByValue != undefined) {
            return groupByValue;
        }
        return expression.value();
    };

    /**
     * Get the group by key.
     * @returns {*} The group by key
     */
    this.groupByKey = function() {
        return this.value();
    };

    /**
     * Get the group by value.
     * @returns {*} The group by value
     */
    this.groupByValue = function() {
        return this.value();
    };

    /**
     * Get the return value (alias for value()).
     * @returns {*} The value
     */
    this.get = function() {
        return me.value();
    };

    /**
     * Get the return value data (returns self).
     * @returns {ReturnValue} This instance
     */
    this.getData = function() {
        return me;
    };

    /**
     * Get the wrapped expression.
     * @returns {Object} The expression
     */
    this.getExpression = function() {
        return expression;
    };

    /**
     * Set the group by value.
     * @param {*} _groupByValue - The new group by value
     */
    this.setGroupByValue = function(_groupByValue) {
        if (expression.isArray() && expression.hasAggregateFunctions()) {
            // Means this is a consumer of map-reducers
            // so do not override
            return;
        }
        groupByValue = _groupByValue;
    };

    /**
     * Get the next action function.
     * @returns {Function} The next action
     */
    this.nextAction = function() {
        ;
    };

    /**
     * Set the next action function.
     * @param {Function} f - The action function
     */
    this.setNextAction = function(f) {
        this.nextAction = f;
    };

    /**
     * Check if this return value is hidden.
     * @returns {boolean} True if hidden
     */
    this.hidden = function() {
        return hidden;
    };

    /**
     * Get the parent operation.
     * @returns {Object} The parent operation
     */
    this.parent = function() {
        return parent;
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "ReturnValue"
     */
    this.type = function() {
        return this.constructor.name;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.ReturnValue = ReturnValue;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query = (this.CypherNG = this.CypherNG || {}).query || {});
