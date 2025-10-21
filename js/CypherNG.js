/**
 * CypherNG.js - Next generation modular Cypher query engine
 * Drop-in replacement for original Cypher.js with pluggable data layer
 * @author Factory Droid
 */

const { QueryEngine } = require('./core/QueryEngine.js');
const { GraphProcessor } = require('./core/GraphProcessor.js');
const { ResultFormatter } = require('./core/ResultFormatter.js');
const { MemoryAdapter } = require('./adapters/MemoryAdapter.js');

/**
 * @class CypherNG
 * @description Main Cypher query engine implementation
 * Provides the same public API as original Cypher.js
 */
class CypherNG {
    /**
     * Creates a new CypherNG instance
     * @param {Object} options - Configuration options
     * @param {Object} options.adapter - Data adapter instance (defaults to MemoryAdapter)
     * @param {Object} options.queryEngine - Custom QueryEngine instance (optional)
     * @param {Object} options.graphProcessor - Custom GraphProcessor instance (optional) 
     * @param {Object} options.resultFormatter - Custom ResultFormatter instance (optional)
     */
    constructor(options = {}) {
        // Initialize components with dependency injection
        this.adapter = options.adapter || new MemoryAdapter();
        this.queryEngine = options.queryEngine || new QueryEngine(this.adapter);
        this.graphProcessor = options.graphProcessor || new GraphProcessor(this.adapter);
        this.resultFormatter = options.resultFormatter || new ResultFormatter();
        
        // Execution state
        this.currentStatement = null;
        this.currentResults = null;
        this.executionContext = {};
        
        // Callbacks
        this.successCallback = null;
        this.errorCallback = null;
        
        // Statistics
        this.stats = {
            queriesExecuted: 0,
            totalExecutionTime: 0,
            errors: 0
        };
        
        // Initialize adapter if needed
        this.initializeAdapter();
    }

    /**
     * Initializes the data adapter
     * @private
     */
    async initializeAdapter() {
        try {
            await this.adapter.connect();
        } catch (error) {
            console.error('Failed to initialize data adapter:', error);
            if (this.errorCallback) {
                this.errorCallback(error);
            }
        }
    }

    /**
     * Executes a Cypher query
     * @param {string} queryText - Cypher query string to execute
     * @param {Function} successCallback - Success callback function
     * @param {Function} errorCallback - Error callback function
     * @returns {void}
     */
    execute(queryText, successCallback, errorCallback) {
        // Store callbacks
        this.successCallback = successCallback;
        this.errorCallback = errorCallback;
        
        // Execute query asynchronously
        this.executeQuery(queryText)
            .then(results => {
                this.currentResults = results;
                if (successCallback) {
                    successCallback(results);
                }
            })
            .catch(error => {
                this.stats.errors++;
                if (errorCallback) {
                    errorCallback(error);
                }
            });
    }

    /**
     * Internal asynchronous query execution
     * @param {string} queryText - Query to execute
     * @returns {Promise<Object>} Query results
     * @private
     */
    async executeQuery(queryText) {
        const startTime = Date.now();
        
        try {
            // Parse the query
            const queryPlan = this.queryEngine.parse(queryText);
            
            // Log query details
            this.logQuery(queryText, queryPlan);
            
            // Execute the query plan
            const rawResults = await this.graphProcessor.execute(queryPlan);
            
            // Format the results
            const formattedResults = this.resultFormatter.format(rawResults, queryPlan);
            
            // Update statistics
            const executionTime = Date.now() - startTime;
            this.updateStats(executionTime, queryPlan.type);
            
            // Add execution metadata
            formattedResults.metadata.executionTime = executionTime;
            formattedResults.metadata.queryText = queryText;
            
            return formattedResults;
            
        } catch (error) {
            console.error('Query execution failed:', error);
            throw new Error(`Query execution failed: ${error.message}`);
        }
    }

    /**
     * Creates nodes and relationships in the graph
     * @param {Object} graphData - Graph data to create
     * @param {Object} graphData.nodes - Array of node objects
     * @param {Object} graphData.relationships - Array of relationship objects
     * @param {Function} successCallback - Success callback
     * @param {Function} errorCallback - Error callback
     * @returns {void}
     */
    addGraph(graphData, successCallback, errorCallback) {
        this.createGraphElements(graphData)
            .then(results => {
                if (successCallback) {
                    successCallback(results);
                }
            })
            .catch(error => {
                if (errorCallback) {
                    errorCallback(error);
                }
            });
    }

    /**
     * Internal method to create graph elements
     * @param {Object} graphData - Graph data
     * @returns {Promise<Object>} Creation results
     * @private
     */
    async createGraphElements(graphData) {
        const startTime = Date.now();
        const batch = [];
        
        // Process nodes
        if (graphData.nodes) {
            for (const nodeData of graphData.nodes) {
                const node = {
                    type: 'node',
                    id: nodeData.id,
                    labels: nodeData.labels || [],
                    properties: nodeData.properties || {}
                };
                batch.push(node);
            }
        }
        
        // Process relationships
        if (graphData.relationships) {
            for (const relData of graphData.relationships) {
                const relationship = {
                    type: 'relationship',
                    id: relData.id,
                    relType: relData.type,
                    from: relData.source || relData.from,
                    to: relData.target || relData.to,
                    properties: relData.properties || {}
                };
                batch.push(relationship);
            }
        }
        
        // Write batch to adapter
        await this.adapter.batchWrite(batch);
        
        return {
            graph: [],
            table: [],
            metadata: {
                nodesCreated: graphData.nodes ? graphData.nodes.length : 0,
                relationshipsCreated: graphData.relationships ? graphData.relationships.length : 0,
                nodesDeleted: 0,
                relationshipsDeleted: 0,
                executionTime: Date.now() - startTime
            }
        };
    }

    /**
     * Sets configuration options
     * @param {Object} options - Configuration options
     * @returns {void}
     */
    configure(options) {
        if (options.adapter && options.adapter !== this.adapter) {
            // Switch adapter
            this.adapter = options.adapter;
            this.queryEngine.adapter = this.adapter;
            this.graphProcessor.dataAdapter = this.adapter;
            
            // Reinitialize new adapter
            this.initializeAdapter();
        }
        
        if (options.resultFormatter) {
            this.resultFormatter = options.resultFormatter;
        }
        
        // Update formatter options
        if (options.formatOptions) {
            this.resultFormatter.formatOptions = {
                ...this.resultFormatter.formatOptions,
                ...options.formatOptions
            };
        }
    }

    /**
     * Gets current configuration
     * @returns {Object} Current configuration
     */
    getConfiguration() {
        return {
            adapter: this.adapter.constructor.name,
            adapterStats: this.adapter.getStats ? this.adapter.getStats() : null,
            queryEngine: this.queryEngine.constructor.name,
            graphProcessor: this.graphProcessor.constructor.name,
            resultFormatter: this.resultFormatter.constructor.name,
            stats: this.stats
        };
    }

    /**
     * Gets execution statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            averageExecutionTime: this.stats.queriesExecuted > 0 ? 
                (this.stats.totalExecutionTime / this.stats.queriesExecuted).toFixed(2) : 0,
            adapterStats: this.adapter.getStats ? this.adapter.getStats() : null
        };
    }

    /**
     * Clears all data from the adapter
     * @returns {Promise<void>}
     */
    async clear() {
        try {
            if (this.adapter.clear) {
                await this.adapter.clear();
            } else {
                // Fallback: disconnect and reconnect
                await this.adapter.disconnect();
                await this.adapter.connect();
            }
            
            this.currentResults = null;
            this.executionContext = {};
            
        } catch (error) {
            console.error('Failed to clear data:', error);
            throw error;
        }
    }

    /**
     * Performs health check on the system
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const checks = {
            engine: { status: 'unknown' },
            adapter: { status: 'unknown' },
            queries: this.stats.queriesExecuted,
            errors: this.stats.errors
        };
        
        try {
            // Check query engine
            checks.engine = {
                status: 'healthy',
                type: this.queryEngine.constructor.name
            };
            
            // Check adapter
            if (this.adapter.healthCheck) {
                checks.adapter = await this.adapter.healthCheck();
            } else {
                checks.adapter = {
                    status: 'unknown',
                    type: this.adapter.constructor.name,
                    message: 'Health check not implemented'
                };
            }
            
            // Overall status
            checks.overall = (checks.engine.status === 'healthy' && 
                             checks.adapter.status === 'healthy') ? 'healthy' : 'degraded';
            
        } catch (error) {
            checks.engine.status = 'error';
            checks.adapter.status = 'error';
            checks.overall = 'unhealthy';
            checks.error = error.message;
        }
        
        return checks;
    }

    /**
     * Logs query execution details
     * @param {string} queryText - Query text
     * @param {Object} queryPlan - Parsed query plan
     * @private
     */
    logQuery(queryText, queryPlan) {
        if (process.env && process.env.NODE_ENV === 'development') {
            console.log(`Executing ${queryPlan.type} query:`, queryText);
        }
    }

    /**
     * Updates execution statistics
     * @param {number} executionTime - Query execution time
     * @param {string} queryType - Type of query executed
     * @private
     */
    updateStats(executionTime, queryType) {
        this.stats.queriesExecuted++;
        this.stats.totalExecutionTime += executionTime;
        
        // Track query type stats
        if (!this.stats.byType) {
            this.stats.byType = {};
        }
        if (!this.stats.byType[queryType]) {
            this.stats.byType[queryType] = { count: 0, totalTime: 0 };
        }
        this.stats.byType[queryType].count++;
        this.stats.byType[queryType].totalTime += executionTime;
    }

    /**
     * Handles errors during execution
     * @param {Error} error - Error that occurred
     * @private
     */
    handleError(error) {
        this.stats.errors++;
        console.error('CypherNG Error:', error);
        
        if (this.errorCallback) {
            this.errorCallback(error);
        }
    }

    /**
     * Gets the current results
     * @returns {Object} Current query results
     */
    getCurrentResults() {
        return this.currentResults;
    }

    /**
     * Sets execution context variables
     * @param {Object} context - Context variables
     * @returns {void}
     */
    setContext(context) {
        this.executionContext = { ...this.executionContext, ...context };
    }

    /**
     * Gets execution context variables
     * @returns {Object} Current execution context
     */
    getContext() {
        return { ...this.executionContext };
    }

    /**
     * Validates if a string is a valid Cypher query
     * @param {string} queryText - Query text to validate
     * @returns {Object} Validation result
     */
    validateQuery(queryText) {
        try {
            this.queryEngine.parse(queryText);
            return { valid: true, errors: [] };
        } catch (error) {
            return { 
                valid: false, 
                errors: [error.message] 
            };
        }
    }

    /**
     * Creates a new instance with the same configuration
     * @returns {CypherNG} New instance
     */
    clone() {
        return new CypherNG({
            adapter: this.adapter,
            queryEngine: new QueryEngine(this.adapter),
            graphProcessor: new GraphProcessor(this.adapter),
            resultFormatter: new ResultFormatter()
        });
    }

    /**
     * Cleanup method to properly close resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            if (this.adapter && this.adapter.disconnect) {
                await this.adapter.disconnect();
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
}

// Create the main export function that matches the original Cypher.js API
function CypherJS() {
    return new CypherNG();
}

// Export both the class and the factory function
module.exports = {
    CypherNG,
    CypherJS
};

// Also provide the default export for compatibility
module.exports.default = CypherNG;
