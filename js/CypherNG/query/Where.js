/**
 * @fileoverview Where class for CypherNG
 *
 * Implements WHERE clause evaluation for filtering query results.
 *
 * @module CypherNG/query/Where
 */

/**
 * Where class for filtering query results
 * @class
 * @param {Object} expression - Expression to evaluate
 */
class Where {
    /**
     * Creates a new Where
     * @param {Object} expression - Expression to evaluate
     */
    constructor(expression) {
        /** @private @type {Object} */
        this._expression = expression;
    }

    /**
     * Evaluate the WHERE condition
     * @returns {boolean} True if condition passes
     */
    evaluate() {
        try {
            return this._expression.value() == true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Gets the expression
     * @returns {Object} Expression
     */
    getExpression() {
        return this._expression;
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
    module.exports = Where;
}