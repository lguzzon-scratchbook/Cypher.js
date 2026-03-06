/**
 * @fileoverview With class for CypherNG.
 * Represents a WITH operation (intermediary return).
 */

var Return = (typeof module !== 'undefined' && module.exports ?
    require('../Return.js').Return :
    CypherNG.query.Return);

/**
 * With - Represents a WITH operation.
 * Passes selected variables to the next part of the query.
 * Extends Return with intermediary semantics.
 *
 * @class
 * @memberof CypherNG.query.operations
 * @param {Object} _statement - The parent statement
 */
function With(_statement) {
    var statement = _statement;

    // Persistence Design Note: WITH is a query-flow control operation.
    // It does not persist data but controls query execution flow.

    var extendedObject = new Return(_statement);
    var descendentClassName = 'With';

    // Override setReturnValueNextAction for WITH-specific behavior
    extendedObject.setReturnValueNextAction = function(returnValue) {
        if (returnValue.hidden()) {
            return;
        }
        returnValue.setNextAction(
            function() {
                if (extendedObject.hasGroupBy()) {
                    statement.getVariable(
                        returnValue.getAlias()
                    ).setOverriddenValue(
                        returnValue.value()
                    );
                }
            }
        );
    };

    // Override type to return 'With' instead of 'Return'
    extendedObject.type = function() {
        return descendentClassName;
    };

    // Mark as intermediary operation
    extendedObject.setIsIntermediary();

    return extendedObject;
}

// Export for both browser and Node.js
(function(exports) {
    exports.With = With;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query.operations = (this.CypherNG = this.CypherNG || {}).query.operations || {});
