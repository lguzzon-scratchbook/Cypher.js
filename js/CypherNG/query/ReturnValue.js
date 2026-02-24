/**
 * @fileoverview ReturnValue class for CypherNG
 * 
 * Represents a value to be returned from a query.
 * 
 * @module CypherNG/query/ReturnValue
 */

/**
 * ReturnValue class
 * @class
 */
class ReturnValue {
    /**
     * Creates a new ReturnValue
     * @param {Object} expression - Expression to evaluate
     * @param {Object} statement - Statement context
     * @param {Object} parent - Parent operation
     * @param {boolean} [isHidden=false] - Whether this is a hidden return value
     */
    constructor(expression, statement, parent, isHidden = false) {
        /** @private @type {Object} */
        this._expression = expression;
        /** @private @type {Object} */
        this._statement = statement;
        /** @private @type {string} */
        this._alias = expression.getAlias ? expression.getAlias() : 'expr';
        /** @private @type {number} */
        this._id = 0;
        /** @private @type {*|undefined} */
        this._groupByValue = undefined;
        /** @private @type {boolean} */
        this._hidden = isHidden;
        /** @private @type {Object} */
        this._parent = parent;
    }

    /**
     * Gets the alias
     * @returns {string} Alias
     */
    getAlias() {
        return this._alias;
    }

    /**
     * Sets the alias
     * @param {string} alias - New alias
     */
    setAlias(alias) {
        this._alias = alias;
        this._statement.addVariable(alias, this);
    }

    /**
     * Checks if has key
     * @returns {boolean} True if has key
     */
    hasKey() {
        return this._expression.hasKey && this._expression.hasKey();
    }

    /**
     * Sets the ID
     * @param {number} id - ID value
     */
    setId(id) {
        this._id = id;
    }

    /**
     * Gets the ID
     * @returns {number} ID
     */
    getId() {
        return this._id;
    }

    /**
     * Gets the value
     * @returns {*} Evaluated value
     */
    value() {
        if (this._groupByValue !== undefined) {
            return this._groupByValue;
        }
        return this._expression.value();
    }

    /**
     * Gets the group by key
     * @returns {*} Value as key
     */
    groupByKey() {
        return this.value();
    }

    /**
     * Gets the group by value
     * @returns {*} Value
     */
    groupByValue() {
        return this.value();
    }

    /**
     * Alias for value
     * @returns {*} Value
     */
    get() {
        return this.value();
    }

    /**
     * Gets the data
     * @returns {ReturnValue} This instance
     */
    getData() {
        return this;
    }

    /**
     * Gets the expression
     * @returns {Object} Expression
     */
    getExpression() {
        return this._expression;
    }

    /**
     * Sets the group by value
     * @param {*} groupByValue - Group by value
     */
    setGroupByValue(groupByValue) {
        if (this._expression.isArray && this._expression.isArray() && 
            this._expression.hasAggregateFunctions && this._expression.hasAggregateFunctions()) {
            return;
        }
        this._groupByValue = groupByValue;
    }

    /**
     * Default next action
     */
    nextAction() {
        // No-op, overridden by parent
    }

    /**
     * Sets the next action
     * @param {Function} f - Action function
     */
    setNextAction(f) {
        this.nextAction = f;
    }

    /**
     * Checks if hidden
     * @returns {boolean} True if hidden
     */
    hidden() {
        return this._hidden;
    }

    /**
     * Gets the parent
     * @returns {Object} Parent operation
     */
    parent() {
        return this._parent;
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
    module.exports = ReturnValue;
}
