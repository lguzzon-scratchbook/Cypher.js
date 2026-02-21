/**
 * AssociativeArray - Key-value map data structure for Cypher queries
 * 
 * Supports lazy evaluation of values and provides map-like functionality.
 */
class AssociativeArray {
  constructor() {
    /** @private @type {Object<string, *>} */
    this._associativeArray = {};
    /** @private @type {Object<string, *>} */
    this._boundAssociativeArray = {};
    /** @private @type {Array<string>} */
    this._keys = [];
  }

  /**
   * Binds all values (evaluates expressions)
   * @private
   */
  _bind() {
    for (const key in this._associativeArray) {
      const value = this._associativeArray[key];
      this._boundAssociativeArray[key] = value && value.value ? value.value() : value;
    }
  }

  /**
   * Adds an entry to the associative array
   * @param {string} key - Entry key
   * @param {*} element - Entry value (can be expression)
   */
  addEntry(key, element) {
    if (key in this._associativeArray) {
      throw new Error(`Key "${key}" already exists in associative array.`);
    }
    this._associativeArray[key] = element;
    this._boundAssociativeArray[key] = null;
    this._keys.push(key);
  }

  /**
   * Gets the bound associative array
   * @param {boolean} [addAssociativeArrayFunctions=true] - Whether to add helper functions
   * @returns {Object}
   */
  get(addAssociativeArrayFunctions = true) {
    this._bind();
    const copy = { ...this._boundAssociativeArray };
    if (addAssociativeArrayFunctions) {
      return this._addAssociativeArrayFunctions(copy);
    }
    return copy;
  }

  /**
   * Gets a property value
   * @param {string} key - Property key
   * @returns {*}
   */
  getProperty(key) {
    this._bind();
    return this._boundAssociativeArray[key];
  }

  /**
   * Gets all property keys
   * @returns {Array<string>}
   */
  getProperties() {
    return Object.keys(this._associativeArray);
  }

  /**
   * Gets all values
   * @returns {Array}
   */
  getValues() {
    return Object.values(this._associativeArray).map(v => v && v.value ? v.value() : v);
  }

  /**
   * Sets a value at a specific index
   * @param {number} index - Index in keys array
   * @param {*} element - Element to set
   */
  setValue(index, element) {
    const key = this._keys[index];
    if (key !== undefined) {
      this._associativeArray[key] = element;
    }
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
   * Resets the array
   */
  reset() {
    // No-op
  }

  /**
   * Gets this instance
   * @returns {AssociativeArray}
   */
  getData() {
    return this;
  }

  /**
   * Gets the object representation
   * @returns {Object}
   */
  getObject() {
    return this.get();
  }

  /**
   * Gets the value
   * @param {boolean} [addAssociativeArrayFunctions=true]
   * @returns {Object}
   */
  value(addAssociativeArrayFunctions = true) {
    return this.get(addAssociativeArrayFunctions);
  }

  /**
   * Gets the type name
   * @returns {string}
   */
  type() {
    return this.constructor.name;
  }

  /**
   * Converts to string
   * @returns {string}
   */
  toString() {
    this._bind();
    return JSON.stringify(this._boundAssociativeArray);
  }

  /**
   * Gets group by key
   * @returns {string}
   */
  groupByKey() {
    return this.toString();
  }

  /**
   * Gets group by value
   * @returns {Object}
   */
  groupByValue() {
    return this.get();
  }

  /**
   * @private
   * Adds helper functions to associative array
   */
  _addAssociativeArrayFunctions(obj) {
    obj.getKeys = function() { return Object.keys(this); };
    return obj;
  }
}

module.exports = { AssociativeArray };
