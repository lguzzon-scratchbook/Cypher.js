/**
 * StorageAdapter - Abstract base class for persistence adapters
 * 
 * This is an extension point for future persistence implementations.
 * Concrete implementations could include:
 * - LocalStorageAdapter (browser localStorage)
 * - IndexedDBAdapter (browser IndexedDB)
 * - FileSystemAdapter (Node.js filesystem)
 * - HTTPAdapter (remote API)
 * 
 * @abstract
 */
class StorageAdapter {
  constructor(options = {}) {
    /** @protected */
    this._options = options;
  }

  /**
   * Load graph data from storage
   * @abstract
   * @returns {Promise<{nodes: Array, relationships: Array}>}
   */
  async load() {
    throw new Error('StorageAdapter.load() must be implemented by subclass');
  }

  /**
   * Save graph data to storage
   * @abstract
   * @param {Object} data - Graph data with nodes and relationships
   * @param {Array} data.nodes - Array of node objects
   * @param {Array} data.relationships - Array of relationship objects
   * @returns {Promise<void>}
   */
  async save(data) {
    throw new Error('StorageAdapter.save() must be implemented by subclass');
  }

  /**
   * Check if storage is available
   * @abstract
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('StorageAdapter.isAvailable() must be implemented by subclass');
  }

  /**
   * Clear all data from storage
   * @abstract
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('StorageAdapter.clear() must be implemented by subclass');
  }

  /**
   * Get adapter name
   * @returns {string}
   */
  getName() {
    return this.constructor.name;
  }
}

module.exports = { StorageAdapter };
