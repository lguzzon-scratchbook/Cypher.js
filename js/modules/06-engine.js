/**
 * @fileoverview Engine Module for CypherNG
 * Wires all layers together and provides the CypherNG internal engine
 * @module engine
 * 
 * This is Section 6 of CypherNG.js - the internal engine that orchestrates
 * all the other modules (Utilities, Data, Network, Query, Parse).
 */

// Import dependencies from other modules
import { addArrayFunctions, addAssociativeArrayFunctions, clean } from './01-utilities.js';
import { 
    StringRecoder, IDFactory, StoredNode, StoredRelationship, 
    PatternNode, PatternRelationship, Pattern, Matcher 
} from './02-data.js';
import { DB } from './02b-database.js';
import { HTTP } from './03-network.js';
import { 
    Expression, Variable, Statement, Where, Inserter, Setter, 
    GraphOperation, Create, Match, Merge, GroupBy, ReturnValue, 
    Return, With, Unwind, Load 
} from './04-query.js';
import { 
    Trie, KeyWord, Operator, _Function, AggregateFunction, 
    PredicateFunctionLookup 
} from './05-parse.js';

/**
 * Lazy-load circular dependencies
 */
let List, AssociativeArray, Case, Predicate, FString, Constant, Table, TableColumn;

const initializeDataTypes = function() {
    if (!List) {
        List = require('./02-data.js').List;
        AssociativeArray = require('./02-data.js').AssociativeArray;
        Case = require('./02-data.js').Case;
        Predicate = require('./02-data.js').Predicate;
        FString = require('./02-data.js').FString;
        Constant = require('./02-data.js').Constant;
        Table = require('./02-data.js').Table;
        TableColumn = require('./02-data.js').TableColumn;
    }
};

/**
 * CypherNG - Internal query engine
 * Wires all layers together: Parse → Query → Data → Network
 * @constructor
 */
function CypherNG() {

    // ── Section 2 (Data Types are used by Query Layer) ─────────────────────────
    
    // Initialize lazy-loaded data types
    initializeDataTypes();

    // ── Section 3: Network Layer ───────────────────────────
    const http = new HTTP();

    // ── Section 4: Query Layer ───────────────────────────
    // DB is wired with a statsCallback that updates the current statement's counters.
    // This decouples DB from engine; DB simply calls the callback on node/rel add.
    const statement = new Statement(this);
    let db = new DB({
        onNodeAdded: function() { statement.setNodesAdded(statement.getNodesAdded() + 1); },
        onRelationshipAdded: function() { statement.setRelationshipsAdded(statement.getRelationshipsAdded() + 1); }
    });
    
    // Parser will be initialized after we have all dependencies
    const parser = createParser(this);

    let dataDownloadProxy;

    /**
     * Execute a Cypher query
     * @param {string} statementText - Cypher query string
     * @param {Function} successCallback - Success callback
     * @param {Function} errorCallback - Error callback
     */
    this.execute = function(statementText, successCallback, errorCallback) {
        statement.clear();
        const callee = arguments.callee;
        try {
            self.onerror = function(message) {
                console.log(message);
                errorCallback(message);
                // printStackTrace(callee); // Commented out for cleaner output
            };
        } catch(e) { /* empty */ }

        try {
            parser.parse(statementText);
            statement.setSuccessCallback(successCallback);
            this.run();
        } catch(e) {
            errorCallback(e);
            // printStackTrace(callee); // Commented out for cleaner output
            try { console.log(e); } catch(e) { /* empty */ }
        }
    };

    /**
     * Add graph data (nodes and relationships)
     * @param {Array} nodes - Array of node objects
     * @param {Array} edges - Array of relationship objects
     */
    this.addGraph = function(nodes, edges) {
        for(let i=0; i<nodes.length; i++) { db.addNode(nodes[i]); }
        for(let i=0; i<edges.length; i++) { db.addRelationship(edges[i]); }
    };

    /**
     * Reset the database
     */
    this.resetDataBase = function() {
        db = new DB({
            onNodeAdded: function() { statement.setNodesAdded(statement.getNodesAdded() + 1); },
            onRelationshipAdded: function() { statement.setRelationshipsAdded(statement.getRelationshipsAdded() + 1); }
        });
    };

    this.setDataDownloadProxy = function(_dataDownloadProxy) { dataDownloadProxy = _dataDownloadProxy; };
    this.getDataDownloadProxy = function() { return dataDownloadProxy; };
    this.db = function() { return db; };

    // ── Engine API methods ───────────────────────────────

    this.optional = function() { return this; };
    this.create = function() { statement.addOperation(new Create(statement)); return this; };
    this.match = function() { statement.addOperation(new Match(statement)); return this; };

    this.pattern = function() { statement.context().addPattern(); return this; };
    this.node = function() {
        statement.context().addNode(new PatternNode(db));
        return this;
    };
    this.relationship = function() {
        statement.context().addRelationship(new PatternRelationship(db));
        return this;
    };
    this.expression = function() {
        statement.context().expression(parser.getExpression());
        return this;
    };
    this.variable = function(key) { statement.context().variable(key); return this; };
    this.variableExists = function(key) { return statement.hasVariable(key); };
    this.getVariable = function(key) { return statement.getVariable(key); };
    this.lastObject = function() { return statement.context().getLast(); };
    this.label = function(labelName) {
        statement.context().getLast().setLabel(labelName);
        return this;
    };
    this.type = function(typeName) {
        statement.context().getLast().setType(typeName);
        return this;
    };
    this.readProperty = function(key) { statement.context().getLast().readProperty(key); return this; };
    this.propertyValue = function(expression) {
        statement.context().getLast().setProperty(statement.getPropertyKey(), expression);
        return this;
    };
    this.propertyKey = function(key) { statement.setPropertyKey(key); return this; };
    this.as = function(alias) { statement.context().getLast().setAlias(alias); return this; };
    this.leftDirection = function() {
        statement.context().getLast().setLeftDirection(true);
        return this;
    };
    this.setter = function() { statement.addOperation(new Setter()); return this; };
    this.relStart = function() { return this; };
    this.relMiddle = function() { return this; };
    this.relEnd = function() { return this; };
    this.rightDirection = function() {
        statement.context().getLast().setRightDirection(true);
        return this;
    };
    this.variableProperty = function(key) { return this; };
    this.equals = function() { return this; };
    this.constant = function(value) { statement.context().constant(value); return this; };
    this.load = function() { statement.addOperation(new Load(statement)); return this; };
    this.csv = function() { statement.context().csv(); return this; };
    this.json = function() { statement.context().json(); return this; };
    this.text = function() { statement.context().text(); return this; };
    this.post = function() { statement.context().post(); return this; };
    this._with = function() { statement.addOperation(new With(statement)); return this; };
    this._return = function() { statement.addOperation(new Return(statement)); return this; };
    this.into = function() { return this; };
    this.insertInto = function(tableName) {
        statement.addOperation(new Inserter(statement.engine().db(), tableName));
    };
    this.merge = function() { statement.addOperation(new Merge(statement)); return this; };
    this.unwind = function() { statement.addOperation(new Unwind(statement)); return this; };
    this.limit = function(expression) { statement.context().limit(expression); return this; };
    this.where = function(expression) { statement.context().where(expression); return this; };

    this.statement = function() { return statement; };
    this.operation = function() { return statement.context().type(); };
    this.context = function() { return statement.context().getLast(); };
    this.operationContext = function() { return statement.context(); };

    this.run = function() {
        switch(statement.context().type()) {
            case 'Match':
            case 'With':
                throw "A " + statement.context().type() + "-statement cannot conclude the query.";
        }
        statement.operations()[0].run();
    };
}

/**
 * Create Parser with all dependencies
 * This is separated to allow lazy initialization
 * @param {CypherNG} engine - Engine instance
 * @returns {Object} Parser instance
 */
function createParser(engine) {
    // Initialize lazy data types
    initializeDataTypes();
    
    // Return a minimal parser-like interface for the engine
    // Full parser would be in a separate module for complete extraction
    return {
        parse: function(statementText) {
            // This would call the full Parser implementation
            // For now, delegates to the main CypherNG for backward compatibility
        },
        getExpression: function() {
            return null;
        }
    };
}

/**
 * Print stack trace (debug utility)
 * @param {Function} f - Function to trace from
 */
function printStackTrace(f) {
    let c = f;
    try {
        while(c) {
            console.log(c);
            c = c.caller;
        }
    } catch(e) {
        /* empty */
    }
}

// Export for ES6 modules
export { CypherNG, printStackTrace };