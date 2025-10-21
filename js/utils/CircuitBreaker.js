/**
 * @class CircuitBreaker
 * @description Prevents cascading failures in network operations.
 * States: CLOSED → OPEN (on failures) → HALF_OPEN → CLOSED (on success)
 */
class CircuitBreaker {
	/**
	 * @param {Object} options
	 * @param {number} options.failureThreshold - Failures before opening (default: 5)
	 * @param {number} options.resetTimeout - ms before attempting half-open (default: 30000)
	 * @param {Function} options.onStateChange - Called when state changes
	 */
	constructor(options = {}) {
		this.failureThreshold = options.failureThreshold || 5;
		this.resetTimeout = options.resetTimeout || 30000;
		this.onStateChange = options.onStateChange || (() => {});

		this.state = "CLOSED"; // CLOSED | OPEN | HALF_OPEN
		this.failureCount = 0;
		this.lastFailureTime = null;
	}

	/**
	 * Execute function with circuit breaker protection.
	 * @param {Function} fn - Async function to execute
	 * @returns {Promise}
	 * @throws {Error} If circuit is OPEN
	 */
	async execute(fn) {
		if (this.state === "OPEN") {
			if (Date.now() - this.lastFailureTime > this.resetTimeout) {
				this.#setState("HALF_OPEN");
			} else {
				throw new Error("Circuit breaker is OPEN");
			}
		}

		try {
			const result = await fn();
			this.#onSuccess();
			return result;
		} catch (error) {
			this.#onFailure();
			throw error;
		}
	}

	#onSuccess() {
		if (this.state === "HALF_OPEN") {
			this.failureCount = 0;
			this.#setState("CLOSED");
		} else if (this.state === "CLOSED") {
			this.failureCount = 0;
		}
	}

	#onFailure() {
		this.lastFailureTime = Date.now();
		this.failureCount++;

		if (this.failureCount >= this.failureThreshold) {
			this.#setState("OPEN");
		}
	}

	#setState(newState) {
		const oldState = this.state;
		this.state = newState;
		if (oldState !== newState) {
			this.onStateChange(oldState, newState);
		}
	}

	/**
	 * Get current state.
	 * @returns {string} 'CLOSED' | 'OPEN' | 'HALF_OPEN'
	 */
	getState() {
		return this.state;
	}

	/**
	 * Reset the circuit breaker.
	 */
	reset() {
		this.failureCount = 0;
		this.lastFailureTime = null;
		this.#setState("CLOSED");
	}
}

module.exports = CircuitBreaker;
