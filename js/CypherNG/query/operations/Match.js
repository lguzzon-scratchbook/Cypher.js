/**
 * @fileoverview Match class for CypherNG.
 * Represents a MATCH operation.
 */

// Import Where class for WHERE conditions
var Where = (typeof module !== 'undefined' && module.exports ?
    require('../Where.js').Where :
    CypherNG.query.Where);
var Pattern = (typeof module !== 'undefined' && module.exports ?
    require('../../core/Pattern.js').Pattern :
    CypherNG.core.Pattern);
var Merge = (typeof module !== 'undefined' && module.exports ?
    require('./Merge.js').Merge :
    CypherNG.query.operations.Merge);

/**
 * Match - Represents a MATCH operation.
 * Matches patterns against existing graph data.
 *
 * @class
 * @memberof CypherNG.query.operations
 * @param {Object} _statement - The parent statement
 */
function Match(_statement) {
    var statement = _statement;
    var patterns = [];
    var previousOperation;
    var nextOperation;
    var whereCondition;

    // Persistence Design Note: MATCH is a read operation.
    // It queries persistent data but does not modify it.

    /**
     * Set a WHERE condition for filtering.
     * @param {Object} expression - The boolean expression
     */
    this.where = function(expression) {
        whereCondition = new Where(expression);
    };

    /**
     * Add a new pattern to match.
     */
    this.addPattern = function() {
        patterns.push(new Pattern());
    };

    var lastPattern = function() {
        return patterns[patterns.length - 1];
    };

    /**
     * Get the current pattern.
     * @returns {Pattern} The last pattern
     */
    this.getPattern = function() {
        return lastPattern();
    };

    /**
     * Add a node to the current pattern.
     * @param {Node} node - The node to add
     */
    this.addNode = function(node) {
        lastPattern().addNode(node);
    };

    /**
     * Add a relationship to the current pattern.
     * @param {Relationship} relationship - The relationship to add
     */
    this.addRelationship = function(relationship) {
        lastPattern().addRelationship(relationship);
    };

    /**
     * Add a variable for the last matched entity.
     * @param {string} key - The variable key
     */
    this.variable = function(key) {
        statement.addVariable(key, this.getLast());
    };

    /**
     * Get the last matched entity.
     * @returns {Node|Relationship} The last entity
     */
    this.getLast = function(node) {
        return lastPattern().lastObject();
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

    var initialiseConveyorBelt = function() {
        if (nextOperation) {
            lastPattern().setNextAction(
                function() {
                    if (!whereCondition || whereCondition.evaluate()) {
                        const result = nextOperation.doIt();
                        if (result instanceof Promise) {
                            result.then();
                        }
                    }
                }
            );
        }
    };

    /**
     * Execute the match operation.
     */
    this.doIt = function() {
        if (previousOperation && previousOperation.constructor == Merge) {
            throw "WITH is required between MERGE and MATCH";
        }
        initialiseConveyorBelt();
        this.doIt = function() {
            for (var patternIdx = 0; patternIdx < patterns.length; patternIdx++) {
                patterns[patternIdx].match();
            }
        };
        this.doIt();
    };

    /**
     * Finish the match operation.
     */
    this.finish = function() {
        if (nextOperation) {
            for (var patternIdx = 0; patternIdx < patterns.length; patternIdx++) {
                patterns[patternIdx].finish();
            }
            nextOperation.finish();
        } else if (!nextOperation) {
            statement.success();
        }
    };

    /**
     * Run the match operation.
     */
    this.run = function() {
        initialiseConveyorBelt();
        for (var patternIdx = 0; patternIdx < patterns.length; patternIdx++) {
            patterns[patternIdx].match();
        }
        if (nextOperation) {
            for (var patternIdx = 0; patternIdx < patterns.length; patternIdx++) {
                patterns[patternIdx].finish();
            }
            nextOperation.finish();
        }
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Match"
     */
    this.type = function() {
        return this.constructor.name;
    };

    /**
     * Get the variables from the statement.
     * @returns {Array} Array of variables
     */
    this.variables = function() {
        return statement.variables();
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Match = Match;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query.operations = (this.CypherNG = this.CypherNG || {}).query.operations || {});
