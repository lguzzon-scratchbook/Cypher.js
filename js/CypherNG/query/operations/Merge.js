/**
 * @fileoverview Merge operation for CypherNG
 *
 * Implements the MERGE clause for matching or creating nodes/relationships.
 * MERGE behaves like a combination of MATCH and CREATE.
 *
 * @module CypherNG/query/operations/Merge
 */

const Pattern = require('../Pattern');
const Where = require('../Where');

/**
 * Merge operation class
 * @class
 */
class Merge {
    /**
     * Creates a new Merge operation
     * @param {Object} statement - Statement context
     */
    constructor(statement) {
        /** @private @type {Object} */
        this._statement = statement;
        /** @private @type {Array} */
        this._patterns = [];
        /** @private @type {Object|null} */
        this._previousOperation = null;
        /** @private @type {Object|null} */
        this._nextOperation = null;
        /** @private @type {Where|null} */
        this._whereCondition = null;
    }

    /**
     * Add a WHERE condition
     * @param {Object} expression - Expression to evaluate
     */
    where(expression) {
        this._whereCondition = new Where(expression);
    }

    /**
     * Add a new pattern
     * @returns {Pattern} New pattern
     */
    addPattern() {
        var pattern = new Pattern();
        this._patterns.push(pattern);
        return pattern;
    }

    /**
     * Get the last pattern
     * @returns {Pattern} Last pattern
     */
    getPattern() {
        return this._patterns[this._patterns.length - 1];
    }

    /**
     * Add a node to the last pattern
     * @param {Object} node - Node to add
     */
    addNode(node) {
        this.getPattern().addNode(node);
    }

    /**
     * Add a relationship to the last pattern
     * @param {Object} relationship - Relationship to add
     */
    addRelationship(relationship) {
        this.getPattern().addRelationship(relationship);
    }

    /**
     * Get the last object in the pattern
     * @returns {Object} Last object
     */
    getLast() {
        return this.getPattern().lastObject();
    }

    /**
     * Bind a variable
     * @param {string} key - Variable name
     */
    variable(key) {
        var lastObj = this.getLast();
        if (lastObj && lastObj.setVariableKey) {
            lastObj.setVariableKey(key);
        }
        this._statement.addVariable(key, lastObj);
    }

    /**
     * Set the previous operation
     * @param {Object} previousOperation - Previous operation
     */
    setPreviousOperation(previousOperation) {
        this._previousOperation = previousOperation;
    }

    /**
     * Set the next operation
     * @param {Object} nextOperation - Next operation
     */
    setNextOperation(nextOperation) {
        this._nextOperation = nextOperation;
        if (nextOperation && nextOperation.setPreviousOperation) {
            nextOperation.setPreviousOperation(this);
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
     * @private
     */
    _initializeConveyorBelt() {
        var lastPattern = this.getPattern();
        if (lastPattern && this._nextOperation) {
            var self = this;
            lastPattern.setNextAction(function() {
                if (!self._whereCondition || self._whereCondition.evaluate()) {
                    var result;
                    if (self._nextOperation && self._nextOperation.doIt) {
                        result = self._nextOperation.doIt();
                        if (result instanceof Promise) {
                            result.then();
                        }
                    }
                }
            });
        }
    }

    /**
     * Execute the merge operation
     */
    doIt() {
        this._initializeConveyorBelt();

        var self = this;
        // Use function reference to allow internal optimization
        this.doIt = function() {
            // First try to match
            for (var i = 0; i < self._patterns.length; i++) {
                self._patterns[i].merge();
            }
        };
        this.doIt();
    }

    /**
     * Run the merge operation (synchronous)
     */
    run() {
        this._initializeConveyorBelt();
        for (var i = 0; i < this._patterns.length; i++) {
            this._patterns[i].merge();
        }
        if (this._nextOperation) {
            this._nextOperation.finish();
        }
    }

    /**
     * Finish processing
     */
    finish() {
        if (this._nextOperation) {
            this._nextOperation.finish();
        } else if (!this._nextOperation) {
            this._statement.success();
        }
    }

    /**
     * Get variables from statement
     * @returns {Array} Variables
     */
    variables() {
        return this._statement.variables();
    }

    /**
     * Get operation type
     * @returns {string} Type name
     */
    type() {
        return this.constructor.name;
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Merge;
}