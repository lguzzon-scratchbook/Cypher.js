/**
 * @fileoverview Inserter class for CypherNG.
 * Represents an INTO table operation.
 */

// Import Table class
var Table = (typeof module !== 'undefined' && module.exports ?
    require('../../structures/Table.js').Table :
    CypherNG.structures.Table);

/**
 * Inserter - Represents an INTO table operation.
 * Inserts query results into a named table.
 *
 * @class
 * @memberof CypherNG.query.operations
 * @param {Object} _db - The database instance
 * @param {string} _tableName - The table name
 */
function Inserter(_db, _tableName) {
    var db = _db;
    var tableName = _tableName;
    var tableColumns = [];

    var table = new Table(
        db,
        tableName
    );

    var previousOperation;
    var nextOperation;

    // Persistence Design Note: Inserter bridges query results to table storage.
    // Tables are persisted data structures separate from the graph.

    /**
     * Set the previous operation.
     * @param {Object} _previousOperation - The previous operation
     */
    this.setPreviousOperation = function(_previousOperation) {
        previousOperation = _previousOperation;
        var variable;
        for (var i = 0; i < previousOperation.variables().length; i++) {
            variable = previousOperation.variables()[i];
            tableColumns.push(
                table.addColumn(variable.getObjectKey())
            );
        }
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
     * Get the variables from the previous operation.
     * @returns {Array} Array of variables
     */
    this.variables = function() {
        return previousOperation.variables();
    };

    /**
     * Execute the insert operation.
     */
    this.doIt = function() {
        var variable;
        for (var i = 0; i < previousOperation.variables().length; i++) {
            variable = previousOperation.variables()[i];
            tableColumns[i].addValue(
                tableColumns[i].name(),
                variable.value()
            );
        }
        if (nextOperation) {
            const result = nextOperation.doIt();
            if (result instanceof Promise) {
                result.then();
            }
        }
    };

    /**
     * Finish the insert operation.
     */
    this.finish = function() {
        if (nextOperation) {
            nextOperation.finish();
        }
    };

    /**
     * Run the insert operation.
     * @throws {Error} Always throws - Inserter cannot be first in statement
     */
    this.run = function() {
        throw "Into-operation cannot be first in statement.";
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Inserter"
     */
    this.type = function() {
        return this.constructor.name;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Inserter = Inserter;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query.operations = (this.CypherNG = this.CypherNG || {}).query.operations || {});
