/**
 * @fileoverview Expression class for CypherNG.
 * Represents a query expression with aggregation support.
 */

var List = (typeof module !== 'undefined' && module.exports ?
    require('../structures/List.js').List :
    CypherNG.structures.List);
var AssociativeArray = (typeof module !== 'undefined' && module.exports ?
    require('../structures/AssociativeArray.js').AssociativeArray :
    CypherNG.structures.AssociativeArray);

/**
 * Expression - Represents a query expression with aggregation support.
 * Used in RETURN, WHERE, and other clauses to define computed values.
 *
 * @class
 * @memberof CypherNG.query
 * @param {Object} root - The root expression element
 * @param {string} [_alias] - Optional alias for the expression
 * @param {Array} [_aggregationFunctions] - Optional aggregation functions
 * @param {Object} [_context] - Optional context (e.g., Return statement)
 * @param {Array} [_variableReferences] - Optional variable references
 * @param {boolean} [_non_deterministic] - Whether expression is non-deterministic
 */
function Expression(_root, _alias, _aggregationFunctions, _context, _variableReferences, _non_deterministic) {
    var root = _root;
    var alias = (root.element ? (root.element().getKey ? root.element().getKey() : _alias) : _alias);
    var aggregationFunctions = _aggregationFunctions;
    var context = _context;
    var variableReferences = _variableReferences;
    var childrenHasVariableReferences = false;
    var localVariables = {};
    var me = this;

    // Persistence Design Note: Expressions are transient query constructs.
    // They do not need persistence but may reference persistent entities.

    if (aggregationFunctions) {
        context.addReduceExpression(this);
        for (var i = 0; i < aggregationFunctions.length; i++) {
            aggregationFunctions[i].setGroupBy(
                context.getGroupBy()
            );
            aggregationFunctions[i].setReducer(
                context.getGroupBy().addReducer()
            );
            aggregationFunctions[i].initialize();
        }
    }

    var _childrenHasVariableReferences = function(children) {
        if (!children) {
            return false;
        }
        for (var i = 0; i < children.length; i++) {
            if (children[i].element().hasReferredVariables && children[i].element().hasReferredVariables()) {
                return true;
            } else {
                return _childrenHasVariableReferences(children[i].p);
            }
        }
        return false;
    };
    childrenHasVariableReferences = _childrenHasVariableReferences(root.p);

    /**
     * Get the root expression element.
     * @returns {Object} The root element
     */
    this.root = function() {
        return root;
    };

    /**
     * Get the root object (with getObject if available).
     * @returns {Object} The root object
     */
    this.rootObject = function() {
        if (root.element().getObject) {
            return root.element().getObject();
        }
        return root.element();
    };

    /**
     * Evaluate and return the expression value.
     * @returns {*} The computed value
     */
    this.value = function() {
        return root.value();
    };

    /**
     * Get the expression data (alias for value()).
     * @returns {*} The computed value
     */
    this.getData = function() {
        return this.value();
    };

    /**
     * Get the expression alias.
     * @returns {string} The alias
     */
    this.getAlias = function() {
        return alias;
    };

    /**
     * Get variable references in this expression.
     * @returns {Array} Array of variable references
     */
    this.variableReferences = function() {
        return variableReferences;
    };

    /**
     * Check if expression has referred variables.
     * @returns {boolean} True if has variable references
     */
    this.hasReferredVariables = function() {
        return (variableReferences && (variableReferences.length > 0)) || childrenHasVariableReferences;
    };

    /**
     * Set the expression alias.
     * @param {string} newAlias - The new alias
     */
    this.setAlias = function(newAlias) {
        alias = newAlias;
    };

    /**
     * Check if expression has a key.
     * @returns {boolean} True if has key
     */
    this.hasKey = function() {
        return root.hasKey && root.hasKey();
    };

    /**
     * Check if this is a reduce expression (has aggregation).
     * @returns {boolean} True if is reduce expression
     */
    this.isReduceExpression = function() {
        return (aggregationFunctions != undefined);
    };

    /**
     * Perform aggregation on the expression.
     */
    this.aggregate = function() {
        if (aggregationFunctions) {
            for (var i = 0; i < aggregationFunctions.length; i++) {
                aggregationFunctions[i].aggregate();
            }
            return;
        }
        context.getGroupBy().map(root);
    };

    /**
     * Check if expression has aggregate functions.
     * @returns {boolean} True if has aggregate functions
     */
    this.hasAggregateFunctions = function() {
        return aggregationFunctions != undefined;
    };

    /**
     * Check if expression is an array.
     * @returns {boolean} True if is array
     */
    this.isArray = function() {
        return root.element().constructor == List;
    };

    /**
     * Check if expression is an associative array.
     * @returns {boolean} True if is associative array
     */
    this.isAssociativeArray = function() {
        return root.element().constructor == AssociativeArray;
    };

    /**
     * Get the aggregate functions.
     * @returns {Array|undefined} Array of aggregation functions
     */
    this.getAggregateFunctions = function() {
        return aggregationFunctions;
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Expression"
     */
    this.type = function() {
        return this.constructor.name;
    };

    if (root.element().constructor == List) {
        var me = this;
        var elements = root.element().getElements();
        for (var i = 0; i < elements.length; i++) {
            if (elements[i].hasAggregateFunctions) {
                me.hasAggregateFunctions = function() {
                    return true;
                };
            }
            return;
        }
    }

    root.non_deterministic = function() {
        return _non_deterministic;
    };

    /**
     * Check if expression is mappable (for serialization).
     * @returns {boolean} True if mappable
     */
    this.mappable = function() {
        return root.mappable();
    };

    /**
     * Set a local variable.
     * @param {string} key - The variable key
     * @param {*} value - The variable value
     */
    this.setLocalVariable = function(key, value) {
        localVariables[key] = value;
    };

    /**
     * Get a local variable.
     * @param {string} key - The variable key
     * @returns {*} The variable value
     */
    this.getLocalVariable = function(key) {
        return localVariables[key];
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Expression = Expression;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query = (this.CypherNG = this.CypherNG || {}).query || {});
