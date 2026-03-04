/**
 * @fileoverview TableColumn - Table column with run-length encoding.
 * Part of CypherNG data structures.
 */

/**
 * TableColumn - A column with run-length encoding for compression.
 *
 * @class
 * @memberof CypherNG.structures
 * @param {Table} _table - The parent table
 * @param {string} _columnName - The column name
 * @description
 * Table column that uses run-length encoding (RLE) for efficient
 * storage of repeated values. Stores unique values and their
 * consecutive run lengths separately.
 *
 * Example: Values [A, A, A, B, B, C] becomes:
 *   values: [A, B, C]
 *   runLengths: [3, 2, 1]
 *
 * Persistence Design Note: For persistence, serialize both the values
 * and runLengths arrays. The column can be reconstructed by loading
 * these two arrays and restoring the iterator state.
 */
function TableColumn(_table, _columnName) {
    var table = _table;
    var columnName = _columnName;
    var runLengths = [];
    var values = [];
    var valueIndex = 0;
    var runLengthIndex = 0;

    /**
     * Add a value to the column (with run-length encoding).
     *
     * @param {*} value - The value to add
     */
    this.addValue = function(value) {
        if (values.length > 0) {
            if (values[values.length - 1] == value) {
                // Same as previous value, increment run length
                runLengths[runLengths.length - 1]++;
            } else if (values[values.length - 1] != value) {
                // Different value, start new run
                values.push(value);
                runLengths.push(1);
            }
        } else if (values.length == 0) {
            // First value
            values.push(value);
            runLengths.push(1);
        }
    };

    /**
     * Get the next value from the column (iterator).
     *
     * @returns {*} The next value in the column
     */
    this.value = function() {
        if (runLengthIndex >= runLengths[valueIndex]) {
            runLengthIndex = 0;
            valueIndex++;
        }
        runLengthIndex++;
        return values[valueIndex];
    };

    /**
     * Reset the iterator to the beginning.
     */
    this.reset = function() {
        valueIndex = 0;
        runLengthIndex = 0;
    };

    /**
     * Get the column name.
     *
     * @returns {string} The column name
     */
    this.name = function() {
        return columnName;
    };

    /**
     * Get the type name.
     *
     * @returns {string} The constructor name
     */
    this.type = function() {
        return this.constructor.name;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.TableColumn = TableColumn;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).structures = (this.CypherNG = this.CypherNG || {}).structures || {});
