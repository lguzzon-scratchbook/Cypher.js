/**
 * List - Dynamic list data structure for Cypher queries
 * 
 * Supports lazy evaluation through bind functions and provides
 * array-like functionality for query results.
 */
class List {
  /**
   * @param {Array} [list] - Initial list data
   * @param {Function} [bindFunction] - Function to bind/transform elements
   */
  constructor(list, bindFunction) {
    /** @private */
    this._list = (list && list.constructor === Array) ? list : [];
    /** @private */
    this._boundList = [];
    /** @private */
    this._bindFunction = bindFunction;
  }

  /**
   * Binds the list elements
   * @private
   */
  _bind() {
    this._boundList = [];
    if (!this._bindFunction) {
      for (let i = 0; i < this._list.length; i++) {
        const item = this._list[i];
        this._boundList[i] = item && item.value ? item.value() : item;
      }
    } else {
      for (let i = 0; i < this._list.length; i++) {
        this._boundList[i] = this._bindFunction(this._list[i]);
      }
    }
  }

  /**
   * Adds an element to the list
   * @param {*} expression - Element to add (can be expression with value() method)
   */
  add(expression) {
    if (!expression) return;
    this._list.push(expression);
  }

  /**
   * Gets the bound list
   * @returns {Array}
   */
  get() {
    this._bind();
    return this._boundList.slice();
  }

  /**
   * Sets an element at a specific index
   * @param {number} elementIndex - Index to set
   * @param {*} element - Element to set
   */
  setElement(elementIndex, element) {
    this._list[elementIndex] = element;
  }

  /**
   * Gets the raw elements array
   * @returns {Array}
   */
  getElements() {
    return this._list;
  }

  /**
   * Iterator method - always returns false (not used as iterator)
   * @returns {boolean}
   */
  next() {
    return false;
  }

  /**
   * Checks if has next (always true for List)
   * @returns {boolean}
   */
  hasNext() {
    return true;
  }

  /**
   * Resets the list
   */
  reset() {
    // No-op for List
  }

  /**
   * Gets this list instance
   * @returns {List}
   */
  getData() {
    return this;
  }

  /**
   * Gets the list value
   * @returns {Array}
   */
  value() {
    return this.get();
  }

  /**
   * Gets the type name
   * @returns {string}
   */
  type() {
    return this.constructor.name;
  }

  /**
   * Gets group by key (for aggregation)
   * @returns {Array}
   */
  groupByKey() {
    return this.get();
  }

  /**
   * Gets group by value (for aggregation)
   * @returns {Array}
   */
  groupByValue() {
    return this.get();
  }

  /**
   * Gets the list length
   * @returns {number}
   */
  length() {
    return this._list.length;
  }

  /**
   * Gets element at index
   * @param {number} index - Element index
   * @returns {*}
   */
  getAt(index) {
    return this._list[index];
  }
}

module.exports = { List };
