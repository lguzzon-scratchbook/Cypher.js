/**
 * @fileoverview Structures module exports for CypherNG.
 * Re-exports all data structures and utilities.
 */

(function(global) {
    // Initialize global namespace
    if (typeof global.CypherNG === 'undefined') {
        global.CypherNG = {};
    }

    var structures = global.CypherNG.structures = global.CypherNG.structures || {};

    structures.AssociativeArray = require('./AssociativeArray.js').AssociativeArray;
    structures.List = require('./List.js').List;
    structures.Table = require('./Table.js').Table;
    structures.TableColumn = require('./TableColumn.js').TableColumn;
    structures.Case = require('./Case.js').Case;
    structures.Predicate = require('./Predicate.js').Predicate;
    structures.FString = require('./FString.js').FString;
    structures.Constant = require('./Constant.js').Constant;
    structures.LinkedList = require('./LinkedList.js').LinkedList;
    structures.StringRecoder = require('./utils.js').StringRecoder;
    structures.IDFactory = require('./utils.js').IDFactory;
    structures.addArrayFunctions = require('./utils.js').addArrayFunctions;
    structures.addAssociativeArrayFunctions = require('./utils.js').addAssociativeArrayFunctions;
    structures.clean = require('./utils.js').clean;

})(typeof global !== 'undefined' ? global : (this || {}));

if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.CypherNG.structures;
}
