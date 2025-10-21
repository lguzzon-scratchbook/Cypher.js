/**
 * @class Logger
 * @description Simple logging utility with level support.
 */
class Logger {
	/**
	 * @param {string} name - Logger name (usually module name)
	 * @param {string} level - Log level: 'debug', 'info', 'warn', 'error'
	 */
	constructor(name = "CypherNG", level = "info") {
		this.name = name;
		this.level = level;
		this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
	}

	#shouldLog(logLevel) {
		return this.levels[logLevel] >= this.levels[this.level];
	}

	/**
	 * @param {string} message
	 * @param {any} data
	 */
	debug(message, data) {
		if (this.#shouldLog("debug")) {
			console.log(`[DEBUG ${this.name}] ${message}`, data || "");
		}
	}

	/**
	 * @param {string} message
	 * @param {any} data
	 */
	info(message, data) {
		if (this.#shouldLog("info")) {
			console.log(`[INFO ${this.name}] ${message}`, data || "");
		}
	}

	/**
	 * @param {string} message
	 * @param {any} data
	 */
	warn(message, data) {
		if (this.#shouldLog("warn")) {
			console.warn(`[WARN ${this.name}] ${message}`, data || "");
		}
	}

	/**
	 * @param {string} message
	 * @param {any} data
	 */
	error(message, data) {
		if (this.#shouldLog("error")) {
			console.error(`[ERROR ${this.name}] ${message}`, data || "");
		}
	}

	/**
	 * Set log level
	 * @param {string} level
	 */
	setLevel(level) {
		this.level = level;
	}
}

module.exports = Logger;
