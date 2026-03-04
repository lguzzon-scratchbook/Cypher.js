/**
 * @fileoverview Jest test setup for CypherNG.
 * Provides common test utilities and matchers.
 */

// Global test utilities
global.testUtils = {
    /**
     * Create a fresh CypherNG instance for testing.
     * @returns {Cypher} A new Cypher instance
     */
    createCypher: function() {
        const Cypher = require('../../js/CypherNG/CypherNG.js');
        return new Cypher();
    },

    /**
     * Execute a query and return results as a promise.
     * @param {Cypher} cypher - The Cypher instance
     * @param {string} query - The Cypher query
     * @returns {Promise} Promise resolving to results
     */
    executeQuery: function(cypher, query) {
        return new Promise((resolve, reject) => {
            cypher.execute(query, resolve, reject);
        });
    },

    /**
     * Reset database and execute a query.
     * @param {Cypher} cypher - The Cypher instance
     * @param {string} query - The Cypher query
     * @returns {Promise} Promise resolving to results
     */
    query: async function(cypher, query) {
        cypher.resetDataBase();
        return this.executeQuery(cypher, query);
    }
};

// Custom matchers
expect.extend({
    /**
     * Check if a value is a valid graph result.
     */
   .toBeValidGraphResult(received) {
        const pass = received &&
            typeof received === 'object' &&
            'output' in received &&
            'graph' in received &&
            'stats' in received;

        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid graph result`,
                pass: true
            };
        } else {
            return {
                message: () => `expected ${received} to be a valid graph result with output, graph, and stats properties`,
                pass: false
            };
        }
    },

    /**
     * Check if a value is a valid node reference.
     */
    .toBeValidNode(received) {
        const pass = received &&
            typeof received === 'object' &&
            'id' in received;

        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid node`,
                pass: true
            };
        } else {
            return {
                message: () => `expected ${received} to be a valid node with an id property`,
                pass: false
            };
        }
    }
});
