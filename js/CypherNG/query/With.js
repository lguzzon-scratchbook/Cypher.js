/**
 * @fileoverview With class for CypherNG
 *
 * Handles WITH clause - similar to Return but used for intermediate results
 * in a query pipeline (e.g., after MERGE before RETURN).
 *
 * @module CypherNG/query/With
 */

const Return = require('./Return');

/**
 * With class - handles WITH clause execution
 * Extends Return to share functionality but marks as intermediary
 * @class
 */
class With extends Return {
    /**
     * Creates a new With operation
     * @param {Object} statement - Statement context
     */
    constructor(statement) {
        super(statement);
        this.setIsIntermediary();
    }

    /**
     * Get the type name
     * @returns {string} Type name (returns 'With' not 'Return')
     */
    type() {
        return 'With';
    }

    /**
     * Set the next action for a return value
     * Overrides parent to handle overridden values for GROUP BY
     * @param {Object} returnValue - Return value to configure
     */
    setReturnValueNextAction(returnValue) {
        if (returnValue.hidden()) {
            return;
        }

        const statement = this._statement;
        const hasGroupBy = this.hasGroupBy();

        returnValue.setNextAction(function() {
            if (hasGroupBy) {
                statement.getVariable(
                    returnValue.getAlias()
                ).setOverriddenValue(
                    returnValue.value()
                );
            }
        });
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = With;
}