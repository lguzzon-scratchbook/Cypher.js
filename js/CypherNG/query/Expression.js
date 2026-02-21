/**
 * Expression - Query expression representation
 * 
 * Represents a parsed expression with its tree structure,
 * aggregation functions, and variable references.
 */

class Expression {
  /**
   * @param {*} root - Root element of expression tree
   * @param {string} alias - Expression alias
   * @param {Array} aggregationFunctions - Array of aggregation functions
   * @param {*} context - Query context
   * @param {Array} variableReferences - Array of variable references
   * @param {boolean} nonDeterministic - Whether expression is non-deterministic
   */
  constructor(root, alias, aggregationFunctions, context, variableReferences, nonDeterministic) {
    this._root = root;
    this._alias = alias;
    this._aggregationFunctions = aggregationFunctions;
    this._context = context;
    this._variableReferences = variableReferences;
    this._nonDeterministic = nonDeterministic;
    this._localVariables = {};

    if (aggregationFunctions) {
      context.addReduceExpression(this);
      for (let i = 0; i < aggregationFunctions.length; i++) {
        aggregationFunctions[i].setGroupBy(context.getGroupBy());
        const reducerId = context.getGroupBy()._reducers.length;
        context.getGroupBy().addReducer();
        aggregationFunctions[i].setReducer(reducerId);
        aggregationFunctions[i].initialize();
      }
    }
  }

  /**
   * Gets the root element
   * @returns {*}
   */
  root() {
    return this._root;
  }

  /**
   * Gets the root object
   * @returns {*}
   */
  rootObject() {
    if (this._root.element && this._root.element().getObject) {
      return this._root.element().getObject();
    }
    return this._root.element ? this._root.element() : this._root;
  }

  /**
   * Evaluates the expression
   * @returns {*}
   */
  value() {
    return this._root.value ? this._root.value() : this._root;
  }

  /**
   * Gets the expression data
   * @returns {*}
   */
  getData() {
    return this.value();
  }

  /**
   * Gets the alias
   * @returns {string}
   */
  getAlias() {
    return this._alias;
  }

  /**
   * Sets the alias
   * @param {string} alias
   */
  setAlias(alias) {
    this._alias = alias;
  }

  /**
   * Gets variable references
   * @returns {Array}
   */
  variableReferences() {
    return this._variableReferences;
  }

  /**
   * Checks if expression has referred variables
   * @returns {boolean}
   */
  hasReferredVariables() {
    return this._variableReferences && this._variableReferences.length > 0;
  }

  /**
   * Checks if expression has a key
   * @returns {boolean}
   */
  hasKey() {
    return this._root.hasKey && this._root.hasKey();
  }

  /**
   * Checks if this is a reduce expression
   * @returns {boolean}
   */
  isReduceExpression() {
    return this._aggregationFunctions !== undefined;
  }

  /**
   * Performs aggregation
   */
  aggregate() {
    if (this._aggregationFunctions) {
      for (let i = 0; i < this._aggregationFunctions.length; i++) {
        this._aggregationFunctions[i].aggregate();
      }
      return;
    }
    if (this._context && this._context.getGroupBy) {
      this._context.getGroupBy().map(this._root);
    }
  }

  /**
   * Checks if expression has aggregate functions
   * @returns {boolean}
   */
  hasAggregateFunctions() {
    return this._aggregationFunctions !== undefined;
  }

  /**
   * Checks if expression is an array
   * @returns {boolean}
   */
  isArray() {
    const List = require('../types/List.js').List;
    return this._root.element && this._root.element().constructor === List;
  }

  /**
   * Checks if expression is an associative array
   * @returns {boolean}
   */
  isAssociativeArray() {
    const AssociativeArray = require('../types/AssociativeArray.js').AssociativeArray;
    return this._root.element && this._root.element().constructor === AssociativeArray;
  }

  /**
   * Gets aggregate functions
   * @returns {Array}
   */
  getAggregateFunctions() {
    return this._aggregationFunctions;
  }

  /**
   * Gets the expression type
   * @returns {string}
   */
  type() {
    return this.constructor.name;
  }

  /**
   * Checks if expression is mappable
   * @returns {boolean}
   */
  mappable() {
    return this._root.mappable ? this._root.mappable() : true;
  }

  /**
   * Sets a local variable
   * @param {string} key
   * @param {*} value
   */
  setLocalVariable(key, value) {
    this._localVariables[key] = value;
  }

  /**
   * Gets a local variable
   * @param {string} key
   * @returns {*}
   */
  getLocalVariable(key) {
    return this._localVariables[key];
  }

  /**
   * Checks if expression is non-deterministic
   * @returns {boolean}
   */
  nonDeterministic() {
    return this._nonDeterministic;
  }
}

module.exports = { Expression };
