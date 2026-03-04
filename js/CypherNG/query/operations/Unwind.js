/**
 * @fileoverview Unwind class for CypherNG.
 * Represents an UNWIND operation.
 */

/**
 * Unwind - Represents an UNWIND operation.
 * Unwinds a list into individual rows.
 *
 * @class
 * @memberof CypherNG.query.operations
 * @param {Object} _statement - The parent statement
 */
function Unwind(_statement) {
    var statement = _statement;
    var previousOperation;
    var nextOperation;
    var expressionToUnwind;
    var collectionToUnwind;
    var unwindedVariableKey;
    var index = 0;

    // Persistence Design Note: UNWIND is a query transformation operation.
    // It does not persist data but transforms query results.

    /**
     * Execute the unwind operation.
     */
    this.doIt = function() {
        if (nextOperation) {
            collectionToUnwind = expressionToUnwind.value();
            if (!collectionToUnwind) {
                return;
            }
            if (!Array.isArray(collectionToUnwind)) {
                throw "Unwind expects list expression.";
            }
            for (index = 0; index < collectionToUnwind.length; index++) {
                const result = nextOperation.doIt();
                if (result instanceof Promise) {
                    result.then();
                }
            }
        }
    };

    /**
     * Finish the unwind operation.
     */
    this.finish = function() {
        if (nextOperation) {
            nextOperation.finish();
        }
    };

    /**
     * Run the unwind operation.
     */
    this.run = function() {
        this.doIt();
        if (nextOperation) {
            nextOperation.finish();
        }
    };

    /**
     * Add a variable for the unwound values.
     * @param {string} key - The variable key
     */
    this.variable = function(key) {
        unwindedVariableKey = key;
        statement.addVariable(key, this);
    };

    /**
     * Get the variables (just the unwound variable).
     * @returns {Array} Array with single variable
     */
    this.variables = function() {
        return [statement.getVariable(unwindedVariableKey)];
    };

    /**
     * Set the expression to unwind.
     * @param {Object} expression - The expression to unwind
     */
    this.expression = function(expression) {
        expressionToUnwind = expression;
    };

    /**
     * Set the previous operation.
     * @param {Object} _previousOperation - The previous operation
     */
    this.setPreviousOperation = function(_previousOperation) {
        previousOperation = _previousOperation;
    };

    /**
     * Set the next operation.
     * @param {Object} _nextOperation - The next operation
     */
    this.setNextOperation = function(_nextOperation) {
        nextOperation = _nextOperation;
        nextOperation.setPreviousOperation(this);
    };

    /**
     * Get the previous operation.
     * @returns {Object} The previous operation
     */
    this.previousOperation = function() {
        return previousOperation;
    };

    /**
     * Get the next operation.
     * @returns {Object} The next operation
     */
    this.nextOperation = function() {
        return nextOperation;
    };

    /**
     * Get the current unwound value.
     * @returns {*} The current value from the collection
     */
    this.value = function() {
        return collectionToUnwind[index];
    };

    // Alias methods for group by compatibility
    this.groupByKey = this.value;
    this.groupByValue = this.value;

    /**
     * Get the current value (alias for value()).
     * @returns {*} The current value
     */
    this.get = function() {
        return this.value();
    };

    /**
     * Get self as data.
     * @returns {Unwind} This instance
     */
    this.getData = function() {
        return this;
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Unwind"
     */
    this.type = function() {
        return this.constructor.name;
    };

    /**
     * Get the id of the current value.
     * @returns {*} The id of the current value
     */
    this.id = function() {
        return this.value().id();
    };

    /**
     * Get the full collection.
     * @returns {Array} The collection being unwound
     */
    this.collection = function() {
        return collectionToUnwind;
    };

    /**
     * Get the current index.
     * @returns {number} The current index
     */
    this.index = function() {
        return index;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Unwind = Unwind;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query.operations = (this.CypherNG = this.CypherNG || {}).query.operations || {});
