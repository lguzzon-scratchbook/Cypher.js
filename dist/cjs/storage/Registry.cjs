

/**
 * Registry - Provider registry for storage adapters
 */
class Registry {
	constructor() {
		/** @type {Map<string, StorageAdapter>} */
		this._adapters = new Map();
		/** @type {StorageAdapter|null} */
		this._default = null;
	}

	/**
	 * Register a storage adapter
	 * @param {string} name - Adapter name
	 * @param {StorageAdapter} adapter - Adapter instance
	 * @param {boolean} [asDefault=false] - Set as default adapter
	 */
	register(name, adapter, asDefault = false) {
		if (!(adapter instanceof StorageAdapter)) {
			throw new Error('Adapter must extend StorageAdapter');
		}

		this._adapters.set(name, adapter);

		if (asDefault || this._default === null) {
			this._default = adapter;
		}
	}

	/**
	 * Get an adapter by name
	 * @param {string} name
	 * @returns {StorageAdapter|undefined}
	 */
	get(name) {
		return this._adapters.get(name);
	}

	/**
	 * Get the default adapter
	 * @returns {StorageAdapter|null}
	 */
	getDefault() {
		return this._default;
	}

	/**
	 * Set the default adapter
	 * @param {string} name
	 */
	setDefault(name) {
		const adapter = this._adapters.get(name);
		if (!adapter) {
			throw new Error(`Adapter '${name}' not found`);
		}
		this._default = adapter;
	}

	/**
	 * Check if adapter exists
	 * @param {string} name
	 * @returns {boolean}
	 */
	has(name) {
		return this._adapters.has(name);
	}

	/**
	 * List all registered adapters
	 * @returns {string[]}
	 */
	list() {
		return Array.from(this._adapters.keys());
	}

	/**
	 * Unregister an adapter
	 * @param {string} name
	 */
	unregister(name) {
		this._adapters.delete(name);

		// Reset default if it was removed
		if (this._default && !this._adapters.has(name)) {
			this._default = this._adapters.values().next().value || null;
		}
	}
}

module.exports = Registry;

module.exports.Registry = Registry;