/**
 * @fileoverview Merge class for CypherNG.
 * Represents a MERGE operation.
 */

// Import Where class for WHERE conditions
var Where = (typeof module !== 'undefined' && module.exports ?
    require('../Where.js').Where :
    CypherNG.query.Where);

/**
 * Merge - Represents a MERGE operation.
 * Matches existing patterns or creates them if they don't exist.
 *
 * @class
 * @memberof CypherNG.query.operations
 * @param {Object} _statement - The parent statement
 */
function Merge(_statement) {
    var statement = _statement;
    var patterns = [];

    var previousOperation;
    var nextOperation;
    var whereCondition;

    // Persistence Design Note: MERGE persists new nodes and relationships
    // only if they don't already exist. It's a combination of MATCH and CREATE.

    /**
     * Set a WHERE condition for filtering.
     * @param {Object} expression - The boolean expression
     */
    this.where = function(expression) {
        whereCondition = new Where(expression);
    };

    /**
     * Add a new pattern to merge.
     */
    this.addPattern = function() {
        patterns.push(new Pattern());
    };

    var lastPattern = function() {
        return patterns[patterns.length - 1];
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
     * Get the last matched/created entity.
     * @returns {Node|Relationship} The last entity
     */
    this.getLast = function(node) {
        return lastPattern().lastObject();
    };

    /**
     * Add a variable for the last entity.
     * @param {string} key - The variable key
     */
    this.variable = function(key) {
        this.getLast().setVariableKey(key);
        statement.addVariable(key, this.getLast());
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
     * Execute the merge operation.
     */
    this.doIt = function() {
        initialiseConveyorBelt();
        this.doIt = function() {
            lastPattern().merge();
        };
        this.doIt();
    };

    /**
     * Finish the merge operation.
     */
    this.finish = function() {
        if (nextOperation) {
            nextOperation.finish();
        } else if (!nextOperation) {
            statement.success();
        }
    };

    /**
     * Run the merge operation.
     */
    this.run = function() {
        initialiseConveyorBelt();
        lastPattern().merge();
        if (nextOperation) {
            nextOperation.finish();
        }
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Merge"
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
    exports.Merge = Merge;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query.operations = (this.CypherNG = this.CypherNG || {}).query.operations || {});
