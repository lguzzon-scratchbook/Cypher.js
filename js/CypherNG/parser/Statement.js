/**
 * Statement represents a parsed Cypher query.
 * @module parser/Statement
 */

/**
 * Represents a parsed Cypher statement with operations and variables.
 * @class
 * @param {Object} engine - The query engine instance
 */
class Statement {
    constructor(engine) {
        /** @private @type {Object} */
        this._engine = engine;
        /** @private @type {Array} */
        this._operations = [];
        /** @private @type {Object} */
        this._variables = {};
        /** @private @type {*} */
        this._lastVariable = undefined;
        /** @private @type {string} */
        this._lastPropertyKey = undefined;
        /** @private @type {Array} */
        this._output = [];
        /** @private @type {Object} */
        this._graph = {
            nodes: {},
            relationships: {}
        };
        /** @private @type {number} */
        this._nodesAdded = 0;
        /** @private @type {number} */
        this._relationshipsAdded = 0;
        /** @private @type {Array} */
        this._overriddenContextStack = [];
        /** @private @type {*} */
        this._overriddenContext = undefined;
        /** @private @type {Function} */
        this._successCallback = undefined;
    }

    /**
     * Add an operation to the statement.
     * @param {Object} operation - The operation to add
     * @throws If RETURN is added when one already exists
     */
    addOperation(operation) {
        if (this.context() && this.context().type() === 'Return') {
            throw new Error('There can only be one return statement and it must be last in the query.');
        }
        if (this.context()) {
            this.context().setNextOperation(operation);
        }
        this._operations.push(operation);
    }

    /**
     * Get all operations in the statement.
     * @returns {Array} Array of operations
     */
    operations() {
        return this._operations;
    }

    /**
     * Get the current operation context.
     * @returns {*} The current operation or overridden context
     */
    context() {
        return this._overriddenContext || this._operations[this._operations.length - 1];
    }

    /**
     * Set the current context (overriding the operation).
     * @param {*} context - The context to set
     */
    setContext(context) {
        if (this._overriddenContext) {
            this._overriddenContextStack.push(this._overriddenContext);
        }
        this._overriddenContext = context;
    }

    /**
     * Reset context to previous state.
     */
    resetContext() {
        this._overriddenContext = this._overriddenContextStack.pop();
    }

    /**
     * Add a variable to the statement.
     * @param {string} key - Variable name
     * @param {*} object - Variable value/object
     * @throws If variable already exists
     */
    addVariable(key, object) {
        var Variable = require('./Variable').Variable;
        this._lastVariable = new Variable(object, key);
        if (this._variables[key]) {
            throw new Error('Variable `' + key + '` already declared.');
        }
        this._variables[key] = this._lastVariable;
    }

    /**
     * Get all variables.
     * @returns {Array} Array of Variable objects
     */
    variables() {
        return Object.values(this._variables);
    }

    /**
     * Get a variable by name.
     * @param {string} key - Variable name
     * @returns {*} The variable value
     * @throws If variable not found
     */
    getVariable(key) {
        if (this._variables[key] === undefined) {
            throw new Error('Variable `' + key + '` has not been declared.');
        }
        return this._variables[key];
    }

    /**
     * Check if a variable exists.
     * @param {string} key - Variable name
     * @returns {boolean} True if variable exists
     */
    hasVariable(key) {
        return this._variables[key] !== undefined;
    }

    /**
     * Get the last variable.
     * @returns {*} The last variable
     */
    getLastVariable() {
        return this._lastVariable;
    }

    /**
     * Set the last property key.
     * @param {string} key - Property key
     */
    setPropertyKey(key) {
        this._lastPropertyKey = key;
    }

    /**
     * Get the last property key.
     * @returns {string} The property key
     */
    getPropertyKey() {
        return this._lastPropertyKey;
    }

    /**
     * Clear the statement state.
     */
    clear() {
        this._operations = [];
        this._variables = {};
        this._lastVariable = undefined;
        this._lastPropertyKey = undefined;
        this._output = [];
        this._nodesAdded = 0;
        this._relationshipsAdded = 0;
        this._graph = {
            nodes: {},
            relationships: {}
        };
    }

    /**
     * Get the engine instance.
     * @returns {Object} The engine
     */
    engine() {
        return this._engine;
    }

    /**
     * Get the results of executing the statement.
     * @returns {Object} Results object with output, graph, and stats
     */
    results() {
        return {
            output: this._output,
            graph: {
                nodes: Object.values(this._graph.nodes),
                links: Object.values(this._graph.relationships)
            },
            stats: {
                nodesAdded: this._nodesAdded,
                relationshipsAdded: this._relationshipsAdded
            }
        };
    }

    /**
     * Add an output record.
     */
    addOutputRecord() {
        this._output.push({});
    }

    /**
     * Add an entry to the current output record.
     * @param {string} key - Entry key
     * @param {*} value - Entry value
     * @param {string} id - Unique identifier
     */
    addOutputEntry(key, value, id) {
        var _key = key;
        if (this._output[this._output.length - 1][_key] !== undefined) {
            _key += id;
        }
        this.addOutputEntryToGraph(value);
        this._output[this._output.length - 1][_key] = value;
    }

    /**
     * Add an entry to the graph output.
     * @param {*} entry - Entry to add
     */
    addOutputEntryToGraph(entry) {
        if (entry && entry.isNode && entry.isNode()) {
            if (this._graph.nodes[entry.id()] === undefined) {
                this._graph.nodes[entry.id()] = entry.toObject ? entry.toObject() : entry;
            }
        } else if (entry && entry.isRelationship && entry.isRelationship()) {
            if (this._graph.relationships[entry.id()] === undefined) {
                var e = entry.toObject ? entry.toObject() : entry;
                e.source = entry.getFromNode ? entry.getFromNode().id() : e.from;
                e.target = entry.getToNode ? entry.getToNode().id() : e.to;
                this._graph.relationships[entry.id()] = e;
            }
        } else if (entry && Array.isArray(entry)) {
            for (var i = 0; i < entry.length; i++) {
                this.addOutputEntryToGraph(entry[i]);
            }
        }
    }

    /**
     * Set the number of nodes added.
     * @param {number} value - Count
     */
    setNodesAdded(value) {
        this._nodesAdded = value;
    }

    /**
     * Set the number of relationships added.
     * @param {number} value - Count
     */
    setRelationshipsAdded(value) {
        this._relationshipsAdded = value;
    }

    /**
     * Get nodes added count.
     * @returns {number} Count
     */
    getNodesAdded() {
        return this._nodesAdded;
    }

    /**
     * Get relationships added count.
     * @returns {number} Count
     */
    getRelationshipsAdded() {
        return this._relationshipsAdded;
    }

    /**
     * Set the success callback.
     * @param {Function} callback - Callback function
     */
    setSuccessCallback(callback) {
        this._successCallback = callback;
    }

    /**
     * Call the success callback with results.
     */
    success() {
        if (this._successCallback) {
            this._successCallback(this.results());
        }
    }
}

/**
 * Variable class for tracking query variables.
 * @class
 * @param {*} object - The object this variable refers to
 * @param {string} key - Variable name
 */
class Variable {
    constructor(object, key) {
        this._object = object;
        this._key = key;
    }

    /**
     * Get the variable's object.
     * @returns {*} The object
     */
    getObject() {
        return this._object;
    }

    /**
     * Get the object key.
     * @returns {string} The key
     */
    getObjectKey() {
        return this._key;
    }

    /**
     * Get the variable value.
     * @returns {*} The value
     */
    value() {
        if (this._object && typeof this._object.value === 'function') {
            return this._object.value();
        }
        return this._object;
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Statement, Variable };
}