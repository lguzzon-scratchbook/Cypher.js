/**
 * @fileoverview OrderBy class for CypherNG
 *
 * Handles ORDER BY clause functionality for result sorting.
 *
 * @module CypherNG/query/OrderBy
 */

/**
 * Sort direction enumeration
 * @readonly
 * @enum {string}
 */
const SortDirection = {
    ASC: 'ASC',
    DESC: 'DESC'
};

/**
 * OrderBy class - handles ORDER BY clause
 * @class
 */
class OrderBy {
    /**
     * Creates a new OrderBy
     * @param {Object} statement - Statement context
     */
    constructor(statement) {
        /** @private @type {Object} */
        this._statement = statement;
        /** @private @type {Array} */
        this._orderItems = [];
        /** @private @type {Object|null} */
        this._previousOperation = null;
        /** @private @type {Object|null} */
        this._nextOperation = null;
    }

    /**
     * Add an ordering expression
     * @param {Object} expression - Expression to order by
     * @param {string} [direction='ASC'] - Sort direction ('ASC' or 'DESC')
     * @returns {OrderBy} This instance for chaining
     */
    addOrderItem(expression, direction) {
        this._orderItems.push({
            expression: expression,
            direction: direction || SortDirection.ASC
        });
        return this;
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
     * Get variables
     * @returns {Array} Array of variables
     */
    variables() {
        if (this._previousOperation && this._previousOperation.variables) {
            return this._previousOperation.variables();
        }
        return [];
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
     * Compare function for sorting
     * @param {Object} a - First record
     * @param {Object} b - Second record
     * @returns {number} Comparison result
     */
    _compare(a, b) {
        for (let i = 0; i < this._orderItems.length; i++) {
            const item = this._orderItems[i];
            let valA, valB;

            // Get the value from the record
            const key = item.expression.getAlias ? item.expression.getAlias() : 'expr';
            valA = a[key];
            valB = b[key];

            // Handle null/undefined
            if (valA === null || valA === undefined) valA = '';
            if (valB === null || valB === undefined) valB = '';

            // Compare based on direction
            let result = 0;
            if (typeof valA === 'number' && typeof valB === 'number') {
                result = valA - valB;
            } else if (typeof valA === 'string' && typeof valB === 'string') {
                result = valA.localeCompare(valB);
            } else {
                // Generic comparison
                const strA = String(valA);
                const strB = String(valB);
                result = strA.localeCompare(strB);
            }

            if (result !== 0) {
                return item.direction === SortDirection.DESC ? -result : result;
            }
        }
        return 0;
    }

    /**
     * Execute the order by operation
     */
    doIt() {
        if (this._nextOperation && this._nextOperation.doIt) {
            this._nextOperation.doIt();
        }
    }

    /**
     * Finish execution - apply ordering to results
     */
    finish() {
        const results = this._statement.results();
        if (results && results.output && results.output.length > 0 && this._orderItems.length > 0) {
            // Sort the output array in place
            results.output.sort(this._compare.bind(this));
        }

        if (this._nextOperation && this._nextOperation.finish) {
            this._nextOperation.finish();
        } else if (!this._nextOperation) {
            this._statement.success();
        }
    }

    /**
     * Run the order by operation
     */
    run() {
        this.doIt();
        this.finish();
    }

    /**
     * Check if has order items
     * @returns {boolean} True if has order items
     */
    hasOrderBy() {
        return this._orderItems.length > 0;
    }

    /**
     * Get order items
     * @returns {Array} Array of order items
     */
    getOrderItems() {
        return this._orderItems;
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OrderBy;
}