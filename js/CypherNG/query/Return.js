/**
 * @fileoverview Return class for CypherNG
 *
 * Handles RETURN clauses, WHERE conditions, LIMIT, and aggregation processing.
 *
 * @module CypherNG/query/Return
 */

const ReturnValue = require('./ReturnValue');
const GroupBy = require('./GroupBy');
const Where = require('./Where');

/**
 * Return class - handles RETURN clause execution
 * @class
 */
class Return {
    /**
     * Creates a new Return operation
     * @param {Object} statement - Statement context
     */
    constructor(statement) {
        /** @private @type {Object} */
        this._statement = statement;
        /** @private @type {Array} */
        this._returnValues = [];
        /** @private @type {GroupBy|null} */
        this._groupBy = null;
        /** @private @type {Array|null} */
        this._mapReturnValues = null;
        /** @private @type {number} */
        this._mapReturnValuesIterator = 0;
        /** @private @type {Array|null} */
        this._reduceExpressions = null;
        /** @private @type {Object|null} */
        this._previousOperation = null;
        /** @private @type {Object|null} */
        this._nextOperation = null;

        /** @private @type {boolean} */
        this._isIntermediary = false;
        /** @private @type {boolean} */
        this._hasReferredVariables = false;
        /** @private @type {boolean} */
        this._hasConstants = false;

        /** @private @type {Where|null} */
        this._whereCondition = null;
        /** @private @type {Object|null} */
        this._limitExpression = null;

        /** @private @type {number} */
        this._recordCount = 0;
        /** @private @type {number} */
        this._doItCount = 0;

        /** @private @type {Object} */
        this._me = this;
    }

    /**
     * Set WHERE condition
     * @param {Object} expression - Where expression
     * @returns {Return} This instance for chaining
     */
    where(expression) {
        this._whereCondition = new Where(expression);
        return this;
    }

    /**
     * Set LIMIT expression
     * @param {Object} expression - Limit expression
     * @returns {Return} This instance for chaining
     */
    limit(expression) {
        this._limitExpression = expression;
        return this;
    }

    /**
     * Add a return value expression
     * @param {Object} expression - Expression to return
     * @param {boolean} [isHidden=false] - Whether this is a hidden return value
     * @returns {ReturnValue} The created ReturnValue
     */
    expression(expression, isHidden = false) {
        return this._addReturnValue(expression, isHidden);
    }

    /**
     * Get the last return value
     * @returns {ReturnValue} Last return value
     */
    getLast() {
        return this._returnValues[this._lastIndex()];
    }

    /**
     * Get the GroupBy instance, creating if needed
     * @returns {GroupBy} GroupBy instance
     */
    getGroupBy() {
        if (this._groupBy === undefined) {
            this._groupBy = new GroupBy(this);
        }
        return this._groupBy;
    }

    /**
     * Check if this operation has GROUP BY
     * @returns {boolean} True if has GROUP BY
     */
    hasGroupBy() {
        return this._groupBy !== undefined && this._groupBy !== null;
    }

    /**
     * Check if has map keys
     * @returns {boolean} True if has map keys
     */
    hasMapKeys() {
        return this._mapReturnValues && (this._mapReturnValues.length > 0);
    }

    /**
     * Get the doIt execution count
     * @returns {number} Count
     */
    doItCount() {
        return this._doItCount;
    }

    /**
     * @private
     * Check if has limit
     * @returns {boolean} True if has limit
     */
    _hasLimit() {
        return this._limitExpression !== undefined && this._limitExpression !== null;
    }

    /**
     * @private
     * Check if limit has been reached
     * @returns {boolean} True if limit reached
     */
    _limitReached() {
        if (!this._hasLimit()) {
            return false;
        }
        const limitValue = this._limitExpression.value();
        return this._recordCount >= limitValue;
    }

    /**
     * @private
     * Check if WHERE condition is met
     * @returns {boolean} True if condition met
     */
    _whereConditionMet() {
        if (!this._whereCondition) {
            return true;
        }
        return this._whereCondition.evaluate();
    }

    /**
     * Add a reduce expression for aggregation
     * @param {Object} reduceExpression - Expression to add
     */
    addReduceExpression(reduceExpression) {
        if (!this._reduceExpressions) {
            this._reduceExpressions = [];
        }
        this._reduceExpressions.push(reduceExpression);
    }

    /**
     * Set the next map value for aggregation
     * @param {*} mapValue - Value to set
     */
    setNextMapValue(mapValue) {
        if (this._mapReturnValues && this._mapReturnValues[this._mapReturnValuesIterator]) {
            this._mapReturnValues[this._mapReturnValuesIterator].setGroupByValue(mapValue);
        }
        this._mapReturnValuesIterator++;
    }

    /**
     * Move to previous map value
     */
    moveToPreviousMapValue() {
        this._mapReturnValuesIterator--;
    }

    /**
     * Add an aggregate output record
     */
    addAggregateOutputRecord() {
        if (!this._whereConditionMet()) {
            return;
        }
        if (this.doItCount() === 0 && this.hasMapKeys()) {
            return;
        }
        if (this._limitReached()) {
            return;
        }
        for (let i = 0; i < this._returnValues.length; i++) {
            if (this._returnValues[i].nextAction) {
                this._returnValues[i].nextAction();
            }
        }
        this._recordCount++;
        if (this._nextOperation && this._nextOperation.doIt) {
            const result = this._nextOperation.doIt();
            if (result instanceof Promise) {
                result.then();
            }
        }
    }

    /**
     * @private
     * Set the next action for a return value
     * @param {ReturnValue} returnValue - Return value to configure
     */
    _setReturnValueNextAction(returnValue) {
        const me = this;
        returnValue.setNextAction(function() {
            if (returnValue.getId() === 0) {
                me._statement.addOutputRecord();
            }

            if (returnValue.hidden()) {
                return;
            }
            me._statement.addOutputEntry(
                returnValue.getAlias(),
                returnValue.value(),
                returnValue.getId()
            );
        });
    }

    /**
     * @private
     * Add a return value
     * @param {Object} expression - Expression to return
     * @param {boolean} [isHidden=false] - Whether hidden
     * @returns {ReturnValue} Created ReturnValue
     */
    _addReturnValue(expression, isHidden) {
        let hasHiddenReturnValues = false;

        // Handle array expressions
        if (expression.isArray && expression.isArray()) {
            const root = expression.root ? expression.root() : expression;
            const element = root.element ? root.element() : root;
            if (element && element.getElements) {
                const array = element;
                const elements = array.getElements ? array.getElements() : [];
                for (let i = 0; i < elements.length; i++) {
                    const hiddenReturnValue = this._addReturnValue(elements[i], true);
                    if (array.setElement) {
                        array.setElement(i, hiddenReturnValue);
                    }
                    hasHiddenReturnValues = true;
                }
            }
        }

        // Handle associative array expressions
        if (expression.isAssociativeArray && expression.isAssociativeArray()) {
            const root = expression.root ? expression.root() : expression;
            const assocArray = root.element ? root.element() : root;
            if (assocArray && assocArray.getValues) {
                const values = assocArray.getValues();
                for (let i = 0; i < values.length; i++) {
                    const hiddenReturnValue = this._addReturnValue(values[i], true);
                    if (assocArray.setValue) {
                        assocArray.setValue(i, hiddenReturnValue);
                    }
                    hasHiddenReturnValues = true;
                }
            }
        }

        const returnValue = new ReturnValue(expression, this._statement, this, isHidden);
        this._returnValues.push(returnValue);
        returnValue.setId(this._lastIndex());

        // Check if expression is mappable for aggregation
        const isMappable = expression.mappable && expression.mappable();
        const isReduce = expression.isReduceExpression && expression.isReduceExpression();

        if (!isReduce && !hasHiddenReturnValues && isMappable) {
            if (!this._mapReturnValues) {
                this._mapReturnValues = [];
            }
            this._mapReturnValues.push(returnValue);
        }

        this._setReturnValueNextAction(returnValue);

        // Track variable references
        if (expression.hasReferredVariables && expression.hasReferredVariables()) {
            this._hasReferredVariables = true;
        } else if (!this._hasReferredVariables) {
            this._hasConstants = true;
        }

        return returnValue;
    }

    /**
     * Mark this as an intermediary operation
     */
    setIsIntermediary() {
        this._isIntermediary = true;
    }

    /**
     * Check if this is the end of the conveyor belt
     * @returns {boolean} True if end
     */
    conveyorBeltEnd() {
        return !this._hasReferredVariables && this._isIntermediary &&
            !this._reduceExpressions && !this._hasConstants;
    }

    /**
     * @private
     * Get last index
     * @returns {number} Last index
     */
    _lastIndex() {
        return this._returnValues.length - 1;
    }

    /**
     * Set the previous operation
     * @param {Object} operation - Previous operation
     */
    setPreviousOperation(operation) {
        this._previousOperation = operation;
    }

    /**
     * Set the next operation
     * @param {Object} operation - Next operation
     */
    setNextOperation(operation) {
        this._nextOperation = operation;
        if (operation && operation.setPreviousOperation) {
            operation.setPreviousOperation(this);
        }
    }

    /**
     * Get the previous operation
     * @returns {Object} Previous operation
     */
    previousOperation() {
        return this._previousOperation;
    }

    /**
     * Get the next operation
     * @returns {Object} Next operation
     */
    nextOperation() {
        return this._nextOperation;
    }

    /**
     * Get all variables
     * @returns {Array} Array of variables
     */
    variables() {
        if (!this._nextOperation && this._previousOperation) {
            // Last operation
            if (this._previousOperation.variables) {
                return this._previousOperation.variables();
            }
        }
        const variableList = [];
        for (let i = 0; i < this._returnValues.length; i++) {
            if (this._returnValues[i].hidden()) {
                continue;
            }
            const alias = this._returnValues[i].getAlias();
            variableList.push(
                this._statement.getVariable(alias)
            );
        }
        return variableList;
    }

    /**
     * Get the type name
     * @returns {string} Type name
     */
    type() {
        return this.constructor.name;
    }

    /**
     * @private
     * Internal doIt implementation
     */
    _internalDoIt() {
        this._doItCount++;

        if (!this.hasGroupBy()) {
            // No aggregation
            if (!this._whereConditionMet()) {
                return;
            }
            if (this._limitReached()) {
                return;
            }
            for (let i = 0; i < this._returnValues.length; i++) {
                if (this._returnValues[i].nextAction) {
                    this._returnValues[i].nextAction();
                }
            }
            this._recordCount++;
            if (this._nextOperation) {
                const result = this._nextOperation.doIt();
                if (result instanceof Promise) {
                    result.then();
                }
            }
        } else {
            // Has GROUP BY - aggregation
            this._groupBy.beginMap();

            // Aggregate map values
            if (this._mapReturnValues) {
                for (let i = 0; i < this._mapReturnValues.length; i++) {
                    const expr = this._mapReturnValues[i].getExpression();
                    if (expr.aggregate) {
                        expr.aggregate();
                    }
                }
            }

            // Aggregate reduce expressions
            if (this._reduceExpressions) {
                for (let i = 0; i < this._reduceExpressions.length; i++) {
                    if (this._reduceExpressions[i].aggregate) {
                        this._reduceExpressions[i].aggregate();
                    }
                }
            }
        }
    }

    /**
     * Execute the return operation
     */
    doIt() {
        if (!this.conveyorBeltEnd()) {
            this._internalDoIt();
        }
    }

    /**
     * Finish execution - process aggregations if any
     */
    finish() {
        if (this.conveyorBeltEnd()) {
            this._internalDoIt();
        }
        if (this.hasGroupBy()) {
            // Read aggregated results
            this._groupBy.print();
        }
        if (this._nextOperation) {
            this._nextOperation.finish();
        } else if (!this._nextOperation) {
            this._statement.success();
        }
    }

    /**
     * Run the return operation
     */
    run() {
        this._internalDoIt();
        if (this._nextOperation) {
            this._nextOperation.finish();
        } else if (!this._nextOperation) {
            this.finish();
        }
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Return;
}