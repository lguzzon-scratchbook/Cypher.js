/**
 * @interface
 * @description Defines the contract for all storage backend adapters.
 * @author Factory Droid
 * 
 * All storage plugins MUST implement this interface to ensure compatibility
 * with the CypherNG query engine.
 */
class DataAdapter {
    /**
     * Connects to the data source.
     * @param {Object} config - Connection configuration object
     * @throws {Error} When connection fails
     * @returns {Promise<void>}
     */
    async connect(config) {
        throw new Error("connect() method must be implemented by DataAdapter subclass");
    }

    /**
     * Disconnects from the data source.
     * @returns {Promise<void>}
     */
    async disconnect() {
        throw new Error("disconnect() method must be implemented by DataAdapter subclass");
    }

    /**
     * Streams graph elements matching the query criteria.
     * @param {Object} query - Query object containing match criteria
     * @param {Object} [options] - Additional streaming options
     * @param {number} [options.batchSize=1000] - Size of result batches
     * @param {number} [options.timeout=30000] - Query timeout in milliseconds
     * @returns {AsyncGenerator<GraphElement>} A stream of graph elements
     * @example
     * for await (const element of adapter.stream({ type: 'node', labels: ['Person'] })) {
     *   console.log('Found:', element);
     * }
     */
    async *stream(query, options = {}) {
        throw new Error("stream() method must be implemented by DataAdapter subclass");
    }

    /**
     * Writes a batch of graph elements to storage.
     * @param {GraphElement[]} batch - Array of nodes/relationships to write
     * @param {Object} [options] - Write operation options
     * @param {boolean} [options.atomic=true] - Whether to perform atomic write
     * @returns {Promise<void>}
     * @example
     * await adapter.batchWrite([
     *   { type: 'node', labels: ['Person'], properties: { name: 'John' } },
     *   { type: 'relationship', from: 1, to: 2, type: 'KNOWS' }
     * ]);
     */
    async batchWrite(batch, options = {}) {
        throw new Error("batchWrite() method must be implemented by DataAdapter subclass");
    }

    /**
     * Deletes elements matching the given criteria.
     * @param {Object} criteria - Criteria to match elements for deletion
     * @param {Object} [options] - Deletion options
     * @param {boolean} [options.cascade=true] - Whether to delete related elements
     * @returns {Promise<number>} The number of elements deleted
     * @example
     * const deletedCount = await adapter.delete({ type: 'node', labels: ['Temp'] });
     */
    async delete(criteria, options = {}) {
        throw new Error("delete() method must be implemented by DataAdapter subclass");
    }

    /**
     * Subscribes to real-time changes matching the pattern.
     * Required for reactive backends but optional for others.
     * @param {Object} pattern - Subscription pattern
     * @param {Function} callback - Callback function for changes
     * @throws {Error} When subscription is not supported
     * @returns {Function} An unsubscribe function
     * @example
     * const unsubscribe = adapter.subscribe(
     *   { type: 'node', labels: ['User'] },
     *   (change) => console.log('Change detected:', change)
     * );
     * // Later: unsubscribe();
     */
    subscribe(pattern, callback) {
        throw new Error("subscribe() method must be implemented by DataAdapter subclass");
    }

    /**
     * Gets adapter capabilities and metadata.
     * @returns {Object} Adapter capabilities
     * @returns {boolean} supportsStreaming - Whether async streaming is supported
     * @returns {boolean} supportsBatching - Whether batch operations are supported
     * @returns {boolean} supportsTransactions - Whether transactions are supported
     * @returns {boolean} supportsReactive - Whether real-time subscriptions are supported
     * @returns {string[]} features - List of supported features
     */
    getCapabilities() {
        return {
            supportsStreaming: false,
            supportsBatching: false,
            supportsTransactions: false,
            supportsReactive: false,
            features: []
        };
    }

    /**
     * Performs health check on the adapter connection.
     * @returns {Promise<Object>} Health status
     * @returns {boolean} healthy - Whether adapter is healthy
     * @returns {string} status - Health status message
     * @returns {number} latency - Connection latency in milliseconds
     */
    async healthCheck() {
        throw new Error("healthCheck() method must be implemented by DataAdapter subclass");
    }
}

/**
 * @typedef {Object} GraphElement
 * @property {string} type - Either 'node' or 'relationship'
 * @property {number} id - Unique identifier
 * @property {string[]} [labels] - Node labels (for nodes)
 * @property {string} [relType] - Relationship type (for relationships)
 * @property {number} [from] - Source node ID (for relationships)
 * @property {number} [to] - Target node ID (for relationships)
 * @property {Object} properties - Element properties
 */

module.exports = { DataAdapter };
