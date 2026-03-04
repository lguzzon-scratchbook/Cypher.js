/**
 * @fileoverview Return class for CypherNG.
 * Represents a RETURN operation.
 */

// Import required classes
var Where = (typeof module !== 'undefined' && module.exports ?
    require('./Where.js').Where :
    CypherNG.query.Where);
var GroupBy = (typeof module !== 'undefined' && module.exports ?
    require('./GroupBy.js').GroupBy :
    CypherNG.query.GroupBy);
var ReturnValue = (typeof module !== 'undefined' && module.exports ?
    require('./ReturnValue.js').ReturnValue :
    CypherNG.query.ReturnValue);

/**
 * Return - Represents a RETURN operation in a query.
 * Manages return values, grouping, limits, and output.
 *
 * @class
 * @memberof CypherNG.query
 * @param {Object} _statement - The parent statement
 */
function Return(_statement) {
    var statement = _statement;
    var returnValues = [];
    var groupBy;
    var mapReturnValues;
    var mapReturnValuesIterator = 0;
    var reduceExpressions;
    var previousOperation;
    var nextOperation;

    var isIntermediary = false, hasReferredVariables = false, hasConstants = false;

    var me = this;

    var whereCondition;
    var limitExpression;

    var recordCount = 0;
    var doItCount = 0;

    // Persistence Design Note: Return is a transient query operation.
    // It produces results but does not need persistence itself.

    /**
     * Set a WHERE condition for filtering results.
     * @param {Object} expression - The boolean expression
     */
    this.where = function(expression) {
        whereCondition = new Where(expression);
    };

    /**
     * Set a LIMIT expression.
     * @param {Object} expression - The limit expression
     */
    this.limit = function(expression) {
        limitExpression = expression;
    };

    /**
     * Add an expression to return.
     * @param {Object} expression - The expression to return
     */
    this.expression = function(expression) {
        addReturnValue(expression);
    };

    /**
     * Get the last return value.
     * @returns {ReturnValue} The last return value
     */
    this.getLast = function() {
        return returnValues[lastIndex()];
    };

    /**
     * Get the GroupBy instance.
     * @returns {GroupBy} The GroupBy instance
     */
    this.getGroupBy = function() {
        if (groupBy == undefined) {
            groupBy = new GroupBy(this);
        }
        return groupBy;
    };

    /**
     * Check if this return has GROUP BY.
     * @returns {boolean} True if has GROUP BY
     */
    this.hasGroupBy = function() {
        return groupBy != undefined;
    };

    /**
     * Check if this return has map keys.
     * @returns {boolean} True if has map keys
     */
    this.hasMapKeys = function() {
        return mapReturnValues && (mapReturnValues.length > 0);
    };

    /**
     * Get the doIt count.
     * @returns {number} The count
     */
    this.doItCount = function() {
        return doItCount;
    };

    var hasLimit = function() {
        return limitExpression != undefined;
    };

    var limitReached = function() {
        return (hasLimit() && recordCount >= limitExpression.value());
    };

    var whereConditionMet = function() {
        return !whereCondition || whereCondition.evaluate();
    };

    /**
     * Add a reduce expression.
     * @param {Object} reduceExpression - The reduce expression
     */
    this.addReduceExpression = function(reduceExpression) {
        if (!reduceExpressions) {
            reduceExpressions = [];
        }
        reduceExpressions.push(reduceExpression);
    };

    /**
     * Set the next map value.
     * @param {*} mapValue - The map value
     */
    this.setNextMapValue = function(mapValue) {
        mapReturnValues[mapReturnValuesIterator++].setGroupByValue(
            mapValue
        );
    };

    /**
     * Move to the previous map value.
     */
    this.moveToPreviousMapValue = function() {
        mapReturnValuesIterator--;
    };

    /**
     * Add an aggregate output record.
     */
    this.addAggregateOutputRecord = function() {
        if (!whereConditionMet()) {
            return;
        }
        if (this.doItCount() == 0 && this.hasMapKeys()) {
            return;
        }
        if (limitReached()) {
            return;
        }
        for (var i = 0; i < returnValues.length; i++) {
            returnValues[i].nextAction();
        }
        recordCount++;
        if (nextOperation) {
            nextOperation.doIt();
        }
    };

    /**
     * Set the next action for a return value.
     * @param {ReturnValue} returnValue - The return value
     */
    this.setReturnValueNextAction = function(returnValue) {
        returnValue.setNextAction(
            function() {
                if (returnValue.getId() == 0) {
                    statement.addOutputRecord();
                }

                if (returnValue.hidden()) {
                    return;
                }
                statement.addOutputEntry(
                    returnValue.getAlias(),
                    returnValue.value(),
                    returnValue.getId()
                );
            }
        );
    };

    var addReturnValue = function(expression, isHidden) {
        var hasHiddenReturnValues = false;
        if (expression.isArray()) {
            var array = expression.root().element();
            for (var i = 0; i < array.getElements().length; i++) {
                var hiddenReturnValue = addReturnValue(array.getElements()[i], true);
                array.setElement(i, hiddenReturnValue);
                hasHiddenReturnValues = true;
            }
        } else if (expression.isAssociativeArray()) {
            var associativeArray = expression.root().element();
            var values = associativeArray.getValues();
            for (var i = 0; i < values.length; i++) {
                var hiddenReturnValue = addReturnValue(values[i], true);
                associativeArray.setValue(i, hiddenReturnValue);
                hasHiddenReturnValues = true;
            }
        }
        var returnValue = new ReturnValue(expression, statement, me, isHidden);
        returnValues.push(returnValue);
        returnValues[lastIndex()].setId(lastIndex());
        if (!returnValue.getExpression().isReduceExpression() &&
            !hasHiddenReturnValues &&
            returnValue.getExpression().mappable()) {
            if (!mapReturnValues) {
                mapReturnValues = [];
            }
            mapReturnValues.push(returnValue);
        }
        me.setReturnValueNextAction(returnValue);
        hasReferredVariables = hasReferredVariables || expression.hasReferredVariables();
        hasConstants = !hasReferredVariables;
        return returnValue;
    };

    /**
     * Set this return as intermediary (WITH-like).
     */
    this.setIsIntermediary = function() {
        isIntermediary = true;
    };

    /**
     * Check if this is at the end of the conveyor belt.
     * @returns {boolean} True if at conveyor belt end
     */
    this.conveyorBeltEnd = function() {
        return !hasReferredVariables && isIntermediary && !reduceExpressions && !hasConstants;
    };

    var lastIndex = function() {
        return returnValues.length - 1;
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
     * Get the variables passed through this return.
     * @returns {Array} Array of variables
     */
    this.variables = function() {
        if (!nextOperation && previousOperation) { // Last operation
            return previousOperation.variables();
        }
        var variableList = [];
        for (var i = 0; i < returnValues.length; i++) {
            if (returnValues[i].hidden()) {
                continue;
            }
            variableList.push(
                statement.getVariable(
                    returnValues[i].getAlias()
                )
            );
        }
        return variableList;
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Return"
     */
    this.type = function() {
        return this.constructor.name;
    };

    var internalDoIt = function() {
        doItCount++;
        if (!me.hasGroupBy()) {
            if (!whereConditionMet()) {
                return;
            }
            if (limitReached()) {
                return;
            }
            for (var i = 0; i < returnValues.length; i++) {
                returnValues[i].nextAction();
            }
            recordCount++;
            if (nextOperation) {
                const result = nextOperation.doIt();
                if (result instanceof Promise) {
                    result.then();
                }
            }
        } else if (me.hasGroupBy()) {
            // Map
            groupBy.beginMap();

            /*for(var i=0; i<returnValues.length; i++) {
                if(!returnValues[i].getExpression().isReduceExpression()) {
                    returnValues[i].getExpression().aggregate();
                }
            }*/
            if (mapReturnValues) {
                for (var i = 0; i < mapReturnValues.length; i++) {
                    mapReturnValues[i].getExpression().aggregate();
                }
            }
            // Reduce
            for (var i = 0; i < reduceExpressions.length; i++) {
                reduceExpressions[i].aggregate();
            }
        }
    };

    /**
     * Execute the return operation.
     */
    this.doIt = function() {
        if (!this.conveyorBeltEnd()) {
            internalDoIt();
        }
    };

    /**
     * Finish the return operation.
     */
    this.finish = function() {
        if (this.conveyorBeltEnd()) {
            internalDoIt();
        }
        if (this.hasGroupBy()) {
            // Read aggregated results
            groupBy.print();
        }
        if (nextOperation) {
            nextOperation.finish();
        } else if (!nextOperation) {
            statement.success();
        }
    };

    /**
     * Run the return operation.
     */
    this.run = function() {
        internalDoIt();
        if (nextOperation) {
            nextOperation.finish();
        } else if (!nextOperation) {
            this.finish();
        }
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Return = Return;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query = (this.CypherNG = this.CypherNG || {}).query || {});
