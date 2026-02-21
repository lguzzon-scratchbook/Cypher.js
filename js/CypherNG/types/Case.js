/**
 * Case - CASE expression implementation for Cypher queries
 * 
 * Supports WHEN/THEN/ELSE logic similar to SQL CASE expressions.
 */
class Case {
  constructor() {
    /** @private @type {Array} */
    this._whens = [];
    /** @private @type {Array} */
    this._thens = [];
    /** @private */
    this._else = null;
  }

  /**
   * Adds a WHEN condition
   * @param {*} expression - Condition expression
   */
  when(expression) {
    this._whens.push(expression);
  }

  /**
   * Gets the count of WHEN clauses
   * @returns {number}
   */
  whenCount() {
    return this._whens.length;
  }

  /**
   * Adds a THEN result for the last WHEN
   * @param {*} expression - Result expression
   */
  then(expression) {
    this._thens.push(expression);
  }

  /**
   * Sets the ELSE result
   * @param {*} expression - Default result expression
   */
  else(expression) {
    this._else = expression;
  }

  /**
   * Gets the result
   * @returns {*}
   */
  get() {
    return this.value();
  }

  /**
   * Iterator method
   * @returns {boolean}
   */
  next() {
    return false;
  }

  /**
   * Checks if has next
   * @returns {boolean}
   */
  hasNext() {
    return true;
  }

  /**
   * Resets the case
   */
  reset() {
    // No-op
  }

  /**
   * Gets this instance
   * @returns {Case}
   */
  getData() {
    return this;
  }

  /**
   * Evaluates the CASE expression
   * @returns {*}
   */
  value() {
    for (let i = 0; i < this._whens.length; i++) {
      const whenValue = this._whens[i] && this._whens[i].value ? this._whens[i].value() : this._whens[i];
      if (whenValue) {
        return this._thens[i] && this._thens[i].value ? this._thens[i].value() : this._thens[i];
      }
    }
    return this._else && this._else.value ? this._else.value() : this._else;
  }

  /**
   * Gets the type name
   * @returns {string}
   */
  type() {
    return this.constructor.name;
  }

  /**
   * Gets group by key
   * @returns {*}
   */
  groupByKey() {
    return this.get();
  }

  /**
   * Gets group by value
   * @returns {*}
   */
  groupByValue() {
    return this.get();
  }
}

module.exports = { Case };
