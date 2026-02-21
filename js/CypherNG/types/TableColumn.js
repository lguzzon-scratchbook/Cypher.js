/**
 * TableColumn - Column in a table with run-length encoding
 * 
 * Provides efficient storage for columnar data using run-length encoding.
 */
class TableColumn {
  /**
   * @param {Table} table - Parent table
   * @param {string} columnName - Column name
   */
  constructor(table, columnName) {
    /** @private */
    this._table = table;
    /** @private */
    this._columnName = columnName;
    /** @private @type {Array<number>} */
    this._runLengths = [];
    /** @private @type {Array} */
    this._values = [];
    /** @private */
    this._valueIndex = 0;
    /** @private */
    this._runLengthIndex = 0;
  }

  /**
   * Adds a value to the column
   * @param {*} value - Value to add
   */
  addValue(value) {
    if (this._values.length > 0) {
      if (this._values[this._values.length - 1] === value) {
        this._runLengths[this._runLengths.length - 1]++;
      } else {
        this._values.push(value);
        this._runLengths.push(1);
      }
    } else {
      this._values.push(value);
      this._runLengths.push(1);
    }
  }

  /**
   * Gets the next value in the column
   * @returns {*}
   */
  value() {
    if (this._runLengthIndex >= this._runLengths[this._valueIndex]) {
      this._runLengthIndex = 0;
      this._valueIndex++;
    }
    this._runLengthIndex++;
    return this._values[this._valueIndex];
  }

  /**
   * Resets the column iterator
   */
  reset() {
    this._valueIndex = 0;
    this._runLengthIndex = 0;
  }

  /**
   * Gets the column name
   * @returns {string}
   */
  name() {
    return this._columnName;
  }

  /**
   * Gets the type name
   * @returns {string}
   */
  type() {
    return this.constructor.name;
  }

  /**
   * Gets all values (decoded)
   * @returns {Array}
   */
  getValues() {
    const result = [];
    for (let i = 0; i < this._values.length; i++) {
      for (let j = 0; j < this._runLengths[i]; j++) {
        result.push(this._values[i]);
      }
    }
    return result;
  }
}

module.exports = { TableColumn };
