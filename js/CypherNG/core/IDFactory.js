/**
 * IDFactory - Generates unique sequential identifiers
 * 
 * Provides a simple counter-based ID generation mechanism for nodes and relationships.
 * 
 * @example
 * const factory = new IDFactory();
 * const id1 = factory.getId(); // Returns -1
 * const id2 = factory.getId(); // Returns -2
 */
class IDFactory {
  constructor() {
    /** @private */
    this._id = -1;
  }

  /**
   * Gets the next unique ID
   * @returns {number} The next sequential ID (negative numbers)
   */
  getId() {
    return this._id--;
  }

  /**
   * Gets the current ID without incrementing
   * @returns {number} The current ID value
   */
  currentId() {
    return this._id + 1;
  }

  /**
   * Resets the ID factory to initial state
   */
  reset() {
    this._id = -1;
  }

  /**
   * Sets the ID to a specific value (useful for testing)
   * @param {number} value - The value to set
   */
  setId(value) {
    this._id = value;
  }
}

module.exports = { IDFactory };
