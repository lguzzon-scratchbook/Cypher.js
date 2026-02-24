/**
 * StorageAdapter - Base interface for persistence
 */
export class StorageAdapter {
	/**
	 * Save data to storage
	 * @param {string} key
	 * @param {*} data
	 * @returns {Promise<void>}
	 */
	async save(_key, _data) {
		throw new Error('Not implemented');
	}

	/**
	 * Load data from storage
	 * @param {string} key
	 * @returns {Promise<*>}
	 */
	async load(_key) {
		throw new Error('Not implemented');
	}

	/**
	 * Delete data from storage
	 * @param {string} key
	 * @returns {Promise<void>}
	 */
	async delete(_key) {
		throw new Error('Not implemented');
	}

	/**
	 * Check if key exists
	 * @param {string} key
	 * @returns {Promise<boolean>}
	 */
	async exists(_key) {
		throw new Error('Not implemented');
	}

	/**
	 * List all keys
	 * @returns {Promise<string[]>}
	 */
	async listKeys() {
		throw new Error('Not implemented');
	}

	/**
	 * Clear all data
	 * @returns {Promise<void>}
	 */
	async clear() {
		throw new Error('Not implemented');
	}
}

export default StorageAdapter;
