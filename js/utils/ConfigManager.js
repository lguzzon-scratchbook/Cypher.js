/**
 * @class ConfigManager
 * @description Manages adapter configuration and plugin registry.
 */
class ConfigManager {
	constructor() {
		this.config = {};
		this.adapters = new Map();
	}

	/**
	 * Load configuration from object.
	 * @param {Object} cfg - Configuration object
	 * @example
	 * configMgr.load({
	 *   adapter: 'redis',
	 *   redis: { host: 'localhost', port: 6379 },
	 *   logLevel: 'info'
	 * });
	 */
	load(cfg) {
		this.config = { ...this.config, ...cfg };
	}

	/**
	 * Get configuration value by key (dot notation).
	 * @param {string} key - Config key (e.g., 'redis.host')
	 * @param {any} defaultValue - Default if not found
	 * @returns {any}
	 * @example configMgr.get('redis.host', 'localhost')
	 */
	get(key, defaultValue = null) {
		const keys = key.split(".");
		let value = this.config;
		for (const k of keys) {
			if (value && typeof value === "object" && k in value) {
				value = value[k];
			} else {
				return defaultValue;
			}
		}
		return value;
	}

	/**
	 * Set configuration value by key (dot notation).
	 * @param {string} key - Config key
	 * @param {any} value - Value to set
	 */
	set(key, value) {
		const keys = key.split(".");
		let obj = this.config;
		for (let i = 0; i < keys.length - 1; i++) {
			const k = keys[i];
			if (!(k in obj)) obj[k] = {};
			obj = obj[k];
		}
		obj[keys[keys.length - 1]] = value;
	}

	/**
	 * Register an adapter class by name.
	 * @param {string} name - Adapter name ('memory', 'filesystem', 'redis', etc.)
	 * @param {Function} adapterClass - Adapter class constructor
	 */
	registerAdapter(name, adapterClass) {
		this.adapters.set(name, adapterClass);
	}

	/**
	 * Create an adapter instance by name.
	 * @param {string} name - Adapter name
	 * @returns {DataAdapter}
	 * @throws {Error} If adapter not registered
	 */
	createAdapter(name) {
		const AdapterClass = this.adapters.get(name);
		if (!AdapterClass) {
			throw new Error(`Adapter '${name}' not registered`);
		}
		return new AdapterClass();
	}

	/**
	 * Get all configuration.
	 * @returns {Object}
	 */
	getAll() {
		return { ...this.config };
	}
}

module.exports = ConfigManager;
