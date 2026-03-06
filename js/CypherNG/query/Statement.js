/**
 * @fileoverview Statement class for CypherNG.
 * Represents a complete query statement container.
 */

var Variable = (typeof module !== 'undefined' && module.exports ?
    require('./Variable.js').Variable :
    CypherNG.query.Variable);
var clean = (typeof module !== 'undefined' && module.exports ?
    require('../structures/utils.js').clean :
    CypherNG.structures.clean);
var NodeReference = (typeof module !== 'undefined' && module.exports ?
    require('../core/References.js').NodeReference :
    CypherNG.core.NodeReference);
var RelationshipReference = (typeof module !== 'undefined' && module.exports ?
    require('../core/References.js').RelationshipReference :
    CypherNG.core.RelationshipReference);

/**
 * Statement - Represents a complete query statement.
 * Manages operations, variables, output, and graph results.
 *
 * @class
 * @memberof CypherNG.query
 * @param {Object} _engine - The query engine instance
 */
function Statement(_engine) {
    var engine = _engine;
    var operations = [];
    var variables = {};
    var lastVariable;
    var lastPropertyKey;
    var output = [];
    var graph = {
        nodes: {},
        relationships: {}
    };
    var nodesAdded = 0;
    var relationshipsAdded = 0;
    var overriddenContextStack = [];
    var overriddenContext = undefined;

    // Persistence Design Note: Statements are transient query containers.
    // Results may be persisted but the statement itself is not.

    /**
     * Add an operation to the statement.
     * @param {Object} operation - The operation to add
     */
    this.addOperation = function(operation) {
        if (this.context() && this.context().type() == 'Return') {
            throw "There can only be one return statement and it must be last in the query.";
        }
        if (this.context()) {
            this.context().setNextOperation(operation);
        }
        operations.push(operation);
    };

    /**
     * Get all operations in the statement.
     * @returns {Array} Array of operations
     */
    this.operations = function() {
        return operations;
    };

    /**
     * Get the current context (last operation or overridden context).
     * @returns {Object} The current operation context
     */
    this.context = function() {
        return overriddenContext || operations[operations.length - 1];
    };

    /**
     * Set an overridden context.
     * @param {Object} context - The context to set
     */
    this.setContext = function(context) {
        if (overriddenContext) {
            overriddenContextStack.push(overriddenContext);
        }
        overriddenContext = context;
    };

    /**
     * Reset the context to previous value.
     */
    this.resetContext = function() {
        overriddenContext = overriddenContextStack.pop();
    };

    /**
     * Add a variable to the statement.
     * @param {string} key - The variable key
     * @param {Object} object - The object the variable references
     */
    this.addVariable = function(key, object) {
        lastVariable = new Variable(object, key);
        if (variables[key]) {
            throw "Variable `" + key + "` already declared.";
        }
        variables[key] = lastVariable;
    };

    /**
     * Debug: log all variables to console.
     */
    this.debugVariables = function() {
        for (var key in variables) {
            console.log("Variable \"" + key + "\":");
            console.log(JSON.stringify(variables[key].value()));
        }
    };

    /**
     * Get all variables in the statement.
     * @returns {Array} Array of Variable objects
     */
    this.variables = function() {
        return Object.values(variables);
    };

    /**
     * Get a variable by key.
     * @param {string} key - The variable key
     * @returns {Variable} The variable
     * @throws {Error} If variable does not exist
     */
    this.getVariable = function(key) {
        if (variables[key] == undefined) {
            try {
                if (typeof window !== 'undefined' && key in window) {
                    return { value: function() { return window[key]; } };
                }
            } catch (e) {
                ;
            }
            throw "Variable `" + key + "` has not been declared.";
        }
        return variables[key];
    };

    /**
     * Check if a variable exists.
     * @param {string} key - The variable key
     * @returns {boolean} True if variable exists
     */
    this.hasVariable = function(key) {
        return variables[key] != undefined;
    };

    /**
     * Get the last added variable.
     * @returns {Variable} The last variable
     */
    this.getLastVariable = function() {
        return lastVariable;
    };

    /**
     * Set the last property key.
     * @param {string} key - The property key
     */
    this.setPropertyKey = function(key) {
        lastPropertyKey = key;
    };

    /**
     * Get the last property key.
     * @returns {string} The property key
     */
    this.getPropertyKey = function() {
        return lastPropertyKey;
    };

    /**
     * Clear all statement state.
     */
    this.clear = function() {
        operations = [];
        variables = {};
        var variableList = [];
        lastVariable = undefined;
        lastPropertyKey = undefined;
        output = [];
        nodesAdded = 0;
        relationshipsAdded = 0;
        graph = {
            nodes: {},
            relationships: {}
        };
    };

    /**
     * Get the query engine.
     * @returns {Object} The engine instance
     */
    this.engine = function() {
        return engine;
    };

    /**
     * Get the query results.
     * @returns {Object} Results object with output, graph, and stats
     */
    this.results = function() {
        checkGraphConsistency();
        return {
            output: output,
            graph: {
                nodes: Object.values(graph.nodes),
                links: Object.values(graph.relationships)
            },
            stats: {
                nodesAdded: nodesAdded,
                relationshipsAdded: relationshipsAdded
            }
        };
    };

    /**
     * Add an output record.
     */
    this.addOutputRecord = function() {
        output.push({});
    };

    /**
     * Add an output entry.
     * @param {string} key - The entry key
     * @param {*} value - The entry value
     * @param {number} id - The entry id
     */
    this.addOutputEntry = function(key, value, id) {
        var _key = key;
        if (output[output.length - 1][_key] != undefined) {
            _key += id;
        }
        this.addOutputEntryToGraph(value);
        output[output.length - 1][_key] = clean(value);
    };

    var checkGraphConsistency = function() {
        var rel, relIdsToDelete = [];
        for (var relationshipId in graph.relationships) {
            rel = graph.relationships[relationshipId];
            if (!graph.nodes[rel.source] || !graph.nodes[rel.target]) {
                relIdsToDelete.push(relationshipId);
            }
        }
        for (var i = 0; i < relIdsToDelete.length; i++) {
            delete graph.relationships[relIdsToDelete[i]];
        }
    };

    /**
     * Add an output entry to the graph.
     * @param {*} entry - The entry to add
     */
    this.addOutputEntryToGraph = function(entry) {
        if (entry && entry.constructor == NodeReference) { // Node
            if (graph.nodes[entry.id()] == undefined) {
                graph.nodes[entry.id()] = clean(entry);
            }
        } else if (entry && entry.constructor == RelationshipReference) { // Relationship
            if (graph.relationships[entry.id()] == undefined) {
                var e = entry.getObject().toObject();
                e.source = e.fromNode.id();
                e.target = e.toNode.id();
                graph.relationships[entry.id()] = clean(e);
            }
        } else if (entry && entry.constructor == Array) { // Array
            for (var i = 0; i < entry.length; i++) {
                this.addOutputEntryToGraph(entry[i]);
            }
        }
    };

    /**
     * Set the number of nodes added.
     * @param {number} value - The node count
     */
    this.setNodesAdded = function(value) {
        nodesAdded = value;
    };

    /**
     * Set the number of relationships added.
     * @param {number} value - The relationship count
     */
    this.setRelationshipsAdded = function(value) {
        relationshipsAdded = value;
    };

    /**
     * Get the number of nodes added.
     * @returns {number} The node count
     */
    this.getNodesAdded = function() {
        return nodesAdded;
    };

    /**
     * Get the number of relationships added.
     * @returns {number} The relationship count
     */
    this.getRelationshipsAdded = function() {
        return relationshipsAdded;
    };

    var successCallback;

    /**
     * Set the success callback.
     * @param {Function} _successCallback - The callback function
     */
    this.setSuccessCallback = function(_successCallback) {
        successCallback = _successCallback;
    };

    /**
     * Call the success callback with results.
     */
    this.success = function() {
        successCallback(this.results());
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Statement = Statement;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query = (this.CypherNG = this.CypherNG || {}).query || {});
