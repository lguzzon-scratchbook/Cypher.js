/**
 * @fileoverview Query module index for CypherNG.
 * Re-exports all query layer components.
 */

(function(global) {
    // Initialize global namespace
    if (typeof global.CypherNG === 'undefined') {
        global.CypherNG = {};
    }

    var query = global.CypherNG.query = global.CypherNG.query || {};

    // Core query classes
    query.Expression = require('./Expression.js').Expression;
    query.Variable = require('./Variable.js').Variable;
    query.Statement = require('./Statement.js').Statement;
    query.Where = require('./Where.js').Where;
    query.GroupBy = require('./GroupBy.js').GroupBy;
    query.ReturnValue = require('./ReturnValue.js').ReturnValue;
    query.Return = require('./Return.js').Return;

    // Operations sub-module
    query.operations = {};
    query.operations.Create = require('./operations/Create.js').Create;
    query.operations.Match = require('./operations/Match.js').Match;
    query.operations.Merge = require('./operations/Merge.js').Merge;
    query.operations.With = require('./operations/With.js').With;
    query.operations.Unwind = require('./operations/Unwind.js').Unwind;
    query.operations.Load = require('./operations/Load.js').Load;
    query.operations.Setter = require('./operations/Setter.js').Setter;
    query.operations.Inserter = require('./operations/Inserter.js').Inserter;

})(typeof global !== 'undefined' ? global : (this || {}));

if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.CypherNG.query;
}
