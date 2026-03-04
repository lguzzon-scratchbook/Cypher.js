/**
 * @fileoverview Table - Table class with columns.
 * Part of CypherNG data structures.
 */

/**
 * Table - A table with typed columns.
 *
 * @class
 * @memberof CypherNG.structures
 * @param {DB} _db - The database instance
 * @param {string} _tableName - The table name
 * @description
 * Table storage with run-length encoded columns. Each column is
 * stored separately for efficient compression and querying.
 *
 * Persistence Design Note: Tables are registered with the DB instance.
 * For persistence, serialize column data (values and runLengths arrays)
 * along with table name. The DB class maintains a tables dictionary.
 */
function Table(_db, _tableName) {
    var me = this;
    var db = _db;
    var tableName = _tableName;
    var tableColumns = {};

    /**
     * Add a column to the table.
     *
     * @param {string} columnName - The column name
     * @returns {TableColumn} The created column instance
     */
    this.addColumn = function(columnName) {
        var TableColumn = (typeof module !== 'undefined' && module.exports ?
            require('./TableColumn.js').TableColumn :
            CypherNG.structures.TableColumn);
        tableColumns[columnName] = new TableColumn(this, columnName);
        return tableColumns[columnName];
    };

    /**
     * Add a value to a column.
     *
     * @param {string} columnName - The column name
     * @param {*} value - The value to add
     */
    this.addValue = function(columnName, value) {
        tableColumns[columnName].addValue(value);
    };

    /**
     * Get a column by name.
     *
     * @param {string} columnName - The column name
     * @returns {TableColumn} The column instance
     */
    this.getColumn = function(columnName) {
        return tableColumns[columnName];
    };

    /**
     * Get the table name.
     *
     * @returns {string} The table name
     */
    this.name = function() {
        return tableName;
    };

    /**
     * Get the type name.
     *
     * @returns {string} The constructor name
     */
    this.type = function() {
        return this.constructor.name;
    };

    // Initialize: Register with database
    {
        db.addTable(me);
    }
}

// Export for both browser and Node.js
(function(exports) {
    exports.Table = Table;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).structures = (this.CypherNG = this.CypherNG || {}).structures || {});
