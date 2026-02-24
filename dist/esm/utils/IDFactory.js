/**
 * IDFactory - Sequential ID generation
 * Generates unique sequential IDs starting from 0
 */
export class IDFactory {
	/**
	 * @param {number} [start=0] - Starting ID
	 */
	constructor(start = 0) {
		this._id = start - 1;
	}

	/**
	 * Get the next ID
	 * @returns {number}
	 */
	getId() {
		this._id++;
		return this._id;
	}

	/**
	 * Reset the factory
	 * @param {number} [start=0] - Reset to this ID minus 1
	 */
	reset(start = 0) {
		this._id = start - 1;
	}

	/**
	 * Get current ID (without incrementing)
	 * @returns {number}
	 */
	peek() {
		return this._id;
	}
}

export default IDFactory;
