/**
 * @fileoverview CypherNG - Main entry point for the refactored Cypher.js engine.
 * This is a modular refactoring of Cypher.js with improved maintainability and testability.
 *
 * @module CypherNG
 * @author Niclas Kjäll-Ohlsson
 * @copyright 2024
 * @license GPL-3.0-or-later
 *
 * CypherNG is a graph database query engine implementing a subset of Cypher query language.
 * It supports MATCH, CREATE, MERGE, RETURN, WITH, UNWIND, and LOAD operations.
 *
 * @example
 * // Basic usage
 * var cypher = new CypherNG();
 * cypher.execute(
 *   "CREATE (n:Person {name: 'Alice'}) RETURN n",
 *   function(results) { console.log(results); },
 *   function(error) { console.error(error); }
 * );
 *
 * @example
 * // Using Web Worker (if available)
 * var cypher = new CypherNG({ runInWebWorker: true });
 * cypher.execute("MATCH (n) RETURN n", successCallback, errorCallback);
 */

(function(global) {
    // Module references - will be populated from sub-modules
    var CypherNG = global.CypherNG || {};

    // Node.js: Load modules if not already loaded
    if (typeof module !== 'undefined' && module.exports && !CypherNG.core) {
        // Load all submodules - they attach to CypherNG namespace
        global.CypherNG = global.CypherNG || {};
        require('./core/index.js');
        require('./structures/index.js');
        require('./network/index.js');
        require('./query/index.js');
        require('./parser/index.js');

        // Refresh reference
        CypherNG = global.CypherNG;
    }

    /**
     * StringRecoder - String interning using trie for memory efficiency.
     * Compresses repeated strings to numeric codes.
     *
     * @class
     * @memberof CypherNG
     * @private
     */
    function StringRecoder() {
        var TrieNode = function() {
            return [{}, null];
        };
        var root = TrieNode();
        var code_factory = 1;
        var CHARS = 0;
        var CODE = 1;

        /**
         * Recode a string to a numeric code (or return original if not a string).
         * @param {*} val - The value to recode
         * @returns {*} The recoded value (number for strings, original otherwise)
         */
        this.recode = function(_val) {
            if (!_val) return _val;
            var val = _val;
            if (!val.charAt) {
                val = '' + _val;
            }
            var n = root, char;
            for (var i = 0; i < val.length; i++) {
                char = val.charAt(i);
                if (!n[CHARS][char]) {
                    n[CHARS][char] = TrieNode();
                }
                n = n[CHARS][char];
            }
            return n[CODE] || (n[CODE] = code_factory++);
        };
    }

    /**
     * IDFactory - Sequential ID generator.
     *
     * @class
     * @memberof CypherNG
     * @private
     */
    function IDFactory() {
        var ID = -1;

        /**
         * Get the next sequential ID.
         * @returns {number} The next ID
         */
        this.getId = function() {
            return ID++;
        };
    }

    /**
     * Main CypherNG constructor.
     * Creates a new Cypher graph database engine instance.
     *
     * @class
     * @global
     * @param {Object} [options] - Configuration options
     * @param {boolean} [options.runInWebWorker=false] - Run queries in Web Worker (browser only)
     * @param {string} [options.dataDownloadProxy] - Proxy URL for CORS avoidance
     *
     * @property {Function} execute - Execute a Cypher query
     * @property {Function} addGraph - Add nodes and edges to the database
     * @property {Function} resetDataBase - Reset the database to empty state
     *
     * @example
     * var cypher = new Cypher({ runInWebWorker: true });
     * cypher.execute("MATCH (n) RETURN count(n)", function(results) {
     *   console.log("Node count:", results.output[0].cnt);
     * });
     */
    function Cypher(options) {
        var singleThreaded = !options || !options.runInWebWorker;

        // Internal modules
        var core = CypherNG.core;
        var structures = CypherNG.structures;
        var network = CypherNG.network;
        var query = CypherNG.query;
        var parser = CypherNG.parser;

        // Create database instance
        var db = new core.DB(this);

        // Create statement instance
        var statement = new query.Statement(this);

        // Create parser instance
        var queryParser = new parser.Parser(this);

        var printStackTrace = function(f) {
            var c = f;
            try {
                while (c) {
                    c = c.caller;
                }
            } catch (e) {
                // Best-effort debugging helper; ignore in strict environments.
            }
        };

        if (queryParser.setDependencies) {
            queryParser.setDependencies({
                db: db,
                statement: statement,
                Pattern: core.Pattern,
                Node: core.Node,
                Relationship: core.Relationship,
                Case: structures.Case,
                FString: structures.FString,
                List: structures.List,
                AssociativeArray: structures.AssociativeArray,
                Predicate: structures.Predicate,
                Constant: structures.Constant,
                Expression: query.Expression,
                Unwind: query.operations.Unwind
            });
        }

        // Options
        var dataDownloadProxy;

        /**
         * Execute a Cypher query statement.
         *
         * @param {string} statementText - The Cypher query to execute
         * @param {Function} successCallback - Callback on success with results object
         * @param {Function} errorCallback - Callback on error with error message
         *
         * @example
         * cypher.execute(
         *   "MATCH (n:Person) RETURN n.name",
         *   function(results) {
         *     console.log(results.output); // [{name: "Alice"}, {name: "Bob"}]
         *   },
         *   function(error) {
         *     console.error("Query failed:", error);
         *   }
         * );
         */
        this.execute = function(statementText, successCallback, errorCallback) {
            statement.clear();
            var callee = arguments.callee;

            // Error handler
            try {
                self.onerror = function(message, filename, lineno, colno, error) {
                    console.log(message);
                    errorCallback(message);
                    printStackTrace(callee);
                };
            } catch (e) {
                // Ignore if onerror not available
            }

            try {
                queryParser.parse(statementText);
                statement.setSuccessCallback(successCallback);
                this.run();
            } catch (e) {
                errorCallback(e);
                printStackTrace(callee);
                try {
                    console.log(e);
                } catch (e2) {
                    // Ignore
                }
            }
        };

        /**
         * Add nodes and edges to the database from plain objects.
         *
         * @param {Object[]} nodes - Array of node objects with id, labels, properties
         * @param {Object[]} edges - Array of edge objects with id, from, to, type, properties
         *
         * @example
         * cypher.addGraph(
         *   [{id: 0, labels: {Person: true}, properties: {name: "Alice"}}],
         *   [{id: 0, from: 0, to: 1, type: "KNOWS", properties: {}}]
         * );
         */
        this.addGraph = function(nodes, edges) {
            for (var i = 0; i < nodes.length; i++) {
                db.addNode(nodes[i]);
            }
            for (var i = 0; i < edges.length; i++) {
                db.addRelationship(edges[i]);
            }
        };

        /**
         * Reset the database, removing all nodes and relationships.
         *
         * @example
         * cypher.resetDataBase();
         */
        this.resetDataBase = function() {
            db = new core.DB(this);
        };

        /**
         * Set the data download proxy URL for CORS avoidance.
         * @param {string} proxyUrl - The proxy URL
         */
        this.setDataDownloadProxy = function(proxyUrl) {
            dataDownloadProxy = proxyUrl;
        };

        /**
         * Get the data download proxy URL.
         * @returns {string} The proxy URL
         */
        this.getDataDownloadProxy = function() {
            return dataDownloadProxy;
        };

        /**
         * Get the database instance (internal use).
         * @returns {DB} The database instance
         * @private
         */
        this.db = function() {
            return db;
        };

        /**
         * Get the statement instance (internal use).
         * @returns {Statement} The statement instance
         * @private
         */
        this.statement = function() {
            return statement;
        };

        /**
         * Run the current statement (internal use).
         * @private
         */
        this.run = function() {
            switch (statement.context().type()) {
                case 'Match':
                case 'With':
                    throw "A " + statement.context().type() + "-statement cannot conclude the query.";
            }
            statement.operations()[0].run();
        };

        // Parser integration methods (internal use)
        this.optional = function() { return this; };
        this.create = function() { statement.addOperation(new query.operations.Create(statement)); return this; };
        this.match = function() { statement.addOperation(new query.operations.Match(statement)); return this; };
        this.pattern = function() { statement.context().addPattern(); return this; };
        this.node = function() { statement.context().addNode(new core.Node(db)); return this; };
        this.relationship = function() { statement.context().addRelationship(new core.Relationship(db)); return this; };
        this.expression = function() { statement.context().expression(queryParser.getExpression()); return this; };
        this.variable = function(key) { statement.context().variable(key); return this; };
        this.variableExists = function(key) { return statement.hasVariable(key); };
        this.getVariable = function(key) { return statement.getVariable(key); };
        this.lastObject = function() { return statement.context().getLast(); };
        this.label = function(labelName) { statement.context().getLast().setLabel(labelName); return this; };
        this.type = function(typeName) { statement.context().getLast().setType(typeName); return this; };
        this.readProperty = function(key) { statement.context().getLast().readProperty(key); return this; };
        this.propertyValue = function(expression) {
            statement.context().getLast().setProperty(statement.getPropertyKey(), expression);
            return this;
        };
        this.propertyKey = function(key) { statement.setPropertyKey(key); return this; };
        this.as = function(alias) { statement.context().getLast().setAlias(alias); return this; };
        this.leftDirection = function() { statement.context().getLast().setLeftDirection(true); return this; };
        this.setter = function() { statement.addOperation(new query.operations.Setter()); return this; };
        this.relStart = function() { return this; };
        this.relMiddle = function() { return this; };
        this.relEnd = function() { return this; };
        this.rightDirection = function() { statement.context().getLast().setRightDirection(true); return this; };
        this.variableProperty = function(key) { return this; };
        this.equals = function() { return this; };
        this.constant = function(value) { statement.context().constant(value); return this; };
        this.load = function() { statement.addOperation(new query.operations.Load(statement)); return this; };
        this.csv = function() { statement.context().csv(); return this; };
        this.json = function() { statement.context().json(); return this; };
        this.text = function() { statement.context().text(); return this; };
        this.post = function() { statement.context().post(); return this; };
        this._with = function() { statement.addOperation(new query.operations.With(statement)); return this; };
        this._return = function() { statement.addOperation(new query.Return(statement)); return this; };
        this.into = function() { return this; };
        this.insertInto = function(tableName) {
            statement.addOperation(new query.operations.Inserter(db, tableName));
        };
        this.merge = function() { statement.addOperation(new query.operations.Merge(statement)); return this; };
        this.unwind = function() { statement.addOperation(new query.operations.Unwind(statement)); return this; };
        this.limit = function(expression) { statement.context().limit(expression); return this; };
        this.where = function(expression) { statement.context().where(expression); return this; };

        // Context accessors (internal use)
        this.operation = function() { return statement.context().type(); };
        this.context = function() { return statement.context().getLast(); };
        this.operationContext = function() { return statement.context(); };
    }

    // Web Worker detection
    var Cypher_context_is_worker = (typeof document === 'undefined');
    var isStandaloneJSEngine = false;

    try {
        if (module) {
            isStandaloneJSEngine = true;
        }
    } catch (e) {
        isStandaloneJSEngine = false;
    }

    // IE compatibility fixes
    if (!Object.values) {
        Object.values = function(object) {
            var values = [];
            for (var key in object) {
                values.push(object[key]);
            }
            return values;
        };
    }
    if (!Object.keys) {
        Object.keys = function(object) {
            var keys = [];
            for (var key in object) {
                keys.push(key);
            }
            return keys;
        };
    }
    if (!Array.prototype.fill) {
        Array.prototype.fill = function(value) {
            var o = Object(this);
            for (var i = 0; i < o.length; i++) {
                o[i] = value;
            }
            return o;
        };
    }
    if (!Array.prototype.concat) {
        Array.prototype.concat = function(other_array) {
            var this_array = Object(this);
            var new_array = new Array(this_array.length + other_array.length);
            var i = 0;
            for (; i < this_array.length; i++) {
                new_array[i] = this_array[i];
            }
            for (; i < new_array.length; i++) {
                new_array[i] = other_array[i - this_array.length];
            }
            return new_array;
        };
    }
    if (!Number.MAX_SAFE_INTEGER) {
        Number.MAX_SAFE_INTEGER = 9007199254740991;
    }

    // Handle Web Worker context
    if (Cypher_context_is_worker) {
        (new Cypher());
    }

    // Export for Node.js
    try {
        if (module && module.exports) {
            module.exports = Cypher;
        }
    } catch (e) {
        // Ignore
    }

    // Export for browser
    if (global) {
        global.Cypher = Cypher;
        global.CypherJS = Cypher;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// End of CypherNG main file
