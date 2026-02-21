/**
 * Table - Table data structure for query results
 * 
 * Supports columnar storage with run-length encoding for compression.
 */
class Table {
  /**
   * @param {DB} db - Database instance
   * @param {string} tableName - Table name
   */
  constructor(db, tableName) {
    /** @private */
    this._db = db;
    /** @private */
    this._tableName = tableName;
    /** @private @type {Object<string, TableColumn>} */
    this._tableColumns = {};

    // Auto-register with database
    if (db && db.addTable) {
      db.addTable(this);
    }
  }

  /**
   * Adds a column to the table
   * @param {string} columnName - Column name
   * @returns {TableColumn}
   */
  addColumn(columnName) {
    const TableColumn = require('./TableColumn.js').TableColumn;
    this._tableColumns[columnName] = new TableColumn(this, columnName);
    return this._tableColumns[columnName];
  }

  /**
   * Adds a value to a column
   * @param {string} columnName - Column name
   * @param {*} value - Value to add
   */
  addValue(columnName, value) {
    if (this._tableColumns[columnName]) {
      this._tableColumns[columnName].addValue(value);
    }
  }

  /**
   * Gets a column
   * @param {string} columnName - Column name
   * @returns {TableColumn|undefined}
   */
  getColumn(columnName) {
    return this._tableColumns[columnName];
  }

  /**
   * Gets the table name
   * @returns {string}
   */
  name() {
    return this._tableName;
  }

  /**
   * Gets the type name
   * @returns {string}
   */
  type() {
    return this.constructor.name;
  }
}

module.exports = { Table };
