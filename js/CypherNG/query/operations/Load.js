/**
 * @fileoverview Load class for CypherNG.
 * Represents a LOAD CSV/JSON/TEXT operation.
 */

/**
 * Load - Represents a LOAD operation.
 * Loads data from CSV, JSON, or text sources via HTTP or direct values.
 *
 * @class
 * @memberof CypherNG.query.operations
 * @param {Object} _statement - The parent statement
 */
function Load(_statement) {
    var statement = _statement;
    var loadType = null;
    var requestType = "GET";
    var payload = null;
    var withHeaders = false;
    var httpHeaders = null;
    var fieldTerminator = ",";
    var from = null;
    var csvData = null;
    var data;
    var previousOperation;
    var nextOperation = null;
    var intermediateVariables = new Map();

    var HTTP_PROXY = statement.engine().getDataDownloadProxy();

    // Persistence Design Note: Load is an I/O operation that brings external
    // data into the query pipeline. The loaded data is transient but may
    // be used to create persistent entities via CREATE/MERGE operations.

    /**
     * Set load type to CSV.
     */
    this.csv = function() {
        loadType = "CSV";
    };

    /**
     * Set load type to JSON.
     */
    this.json = function() {
        loadType = "JSON";
    };

    /**
     * Set load type to TEXT.
     */
    this.text = function() {
        loadType = "TEXT";
    };

    /**
     * Set request type to POST.
     */
    this.post = function() {
        requestType = "POST";
    };

    /**
     * Get the load type.
     * @returns {string} The load type (CSV, JSON, or TEXT)
     */
    this.loadType = function() {
        return loadType;
    };

    /**
     * Get the request type.
     * @returns {string} The request type (GET or POST)
     */
    this.getRequestType = function() {
        return requestType;
    };

    /**
     * Get the payload for POST requests.
     * @returns {*} The payload value
     */
    this.getPayload = function() {
        if (payload) {
            return payload.value();
        }
        return null;
    };

    /**
     * Enable headers in CSV loading.
     */
    this.headers = function() {
        withHeaders = true;
    };

    /**
     * Set HTTP headers.
     * @param {Object} _httpHeaders - The headers object
     */
    this.setHTTPHeaders = function(_httpHeaders) {
        httpHeaders = _httpHeaders;
    };

    /**
     * Get HTTP headers.
     * @returns {Object} The headers object
     */
    this.getHTTPHeaders = function() {
        return httpHeaders;
    };

    /**
     * Set the field terminator for CSV.
     * @param {string} _fieldTerminator - The field terminator character
     * @throws {Error} If terminator is not exactly one character
     */
    this.setFieldTerminator = function(_fieldTerminator) {
        if (_fieldTerminator.length > 1 || _fieldTerminator.length == 0) {
            throw "Field terminator must be one char.";
        }
        fieldTerminator = _fieldTerminator;
    };

    /**
     * Get the field terminator.
     * @returns {string} The field terminator character
     */
    this.fieldTerminator = function() {
        return fieldTerminator;
    };

    /**
     * Set the from expression or payload expression.
     * @param {Object} expression - The expression
     */
    this.expression = function(expression) {
        if (from == null) {
            from = expression;
        } else if (payload == null) {
            payload = expression;
        }
    };

    /**
     * Get the last expression (from).
     * @returns {Object} The from expression
     */
    this.getLast = function() {
        return from;
    };

    /**
     * Add a variable for the loaded data.
     * @param {string} key - The variable key
     */
    this.variable = function(key) {
        statement.addVariable(key, this);
    };

    /**
     * Get a property from the loaded data.
     * @param {string} key - The property key
     * @returns {*} The property value
     */
    this.getProperty = function(key) {
        return data[key];
    };

    /**
     * Get the from URL/value (with proxy if configured).
     * @returns {string} The from value
     */
    this.from = function() {
        if (HTTP_PROXY) {
            return HTTP_PROXY + from.value();
        }
        return from.value();
    };

    /**
     * Get the loaded data.
     * @returns {Object} The data
     */
    this.get = function() {
        return data;
    };

    /**
     * Get the loaded data (alias for get()).
     * @returns {Object} The data
     */
    this.value = function() {
        return this.get();
    };

    /**
     * Get the group by key.
     * @returns {Object} The data
     */
    this.groupByKey = function() {
        return data;
    };

    /**
     * Get the group by value.
     * @returns {Object} The data
     */
    this.groupByValue = function() {
        return this.get();
    };

    /**
     * Get self as data.
     * @returns {Load} This instance
     */
    this.getData = function() {
        return this;
    };

    /**
     * Get the parent statement.
     * @returns {Statement} The statement
     */
    this.statement = function() {
        return statement;
    };

    /**
     * Set the previous operation.
     * @param {Object} _previousOperation - The previous operation
     */
    this.setPreviousOperation = function(_previousOperation) {
        previousOperation = _previousOperation;
    };

    /**
     * Set the next operation.
     * @param {Object} _nextOperation - The next operation
     */
    this.setNextOperation = function(_nextOperation) {
        nextOperation = _nextOperation;
        nextOperation.setPreviousOperation(this);
    };

    /**
     * Get the previous operation.
     * @returns {Object} The previous operation
     */
    this.previousOperation = function() {
        return previousOperation;
    };

    /**
     * Get the variables from the statement.
     * @returns {Array} Array of variables
     */
    this.variables = function() {
        return statement.variables();
    };

    var parseCSV = function(_fieldSeparator, nextOperation) {
        var fieldNames = [], fieldNumber = 0;
        var record = {};
        var lineNumber = 0;

        var c = '', i = 0;
        var inDoubleQuotes = false;

        var fieldSeparator = _fieldSeparator || ',';

        var next = function() {
            pc = c;
            c = csvData.charAt(i++);
            if (doubleQuote()) {
                inDoubleQuotes = !inDoubleQuotes;
                next();
            }
        };

        var consume = function() {
            if (isQuoteInQuote()) {
                c = csvData.charAt(++i);
                return '""';
            }
            return c;
        };

        var nextChar = function() {
            if (eof()) {
                return '\0';
            }
            return csvData.charAt(i);
        };

        var isQuoteInQuote = function() {
            if (doubleQuoted) {
                if (c == '"' && nextChar() == '"') return true;
            }
            return false;
        };

        var doubleQuote = function() {
            return !isQuoteInQuote() && c == '"';
        };

        var doubleQuoted = function() {
            return inDoubleQuotes;
        };

        var isFieldSeparator = function() {
            return c == fieldSeparator;
        };

        var newLine = function() {
            if (c == '\r' && nextChar() == '\n') {
                next();
            }
            return c == '\n';
        };

        var eof = function() {
            return i >= (csvData.length);
        };

        var more = function() {
            return !(isFieldSeparator() || newLine() || eof());
        };

        var addRecord = function() {
            if (lineNumber++ > 0) {
                data = record;
                record = {};
                fieldNumber = 0;
                const result = nextOperation();
                if (result instanceof Promise) {
                    result.then();
                }
            }
        };

        var field = function() {
            var field = "";
            while (more() || doubleQuoted()) {
                field += consume();
                next();
            }
            if (lineNumber == 0) {
                if (withHeaders) {
                    fieldNames.push(field);
                } else if (!withHeaders) {
                    fieldNames.push(fieldNames.length);
                }
            }
            if ((lineNumber > 0 && withHeaders) || !withHeaders) {
                record[fieldNames[fieldNumber++]] = field;
            }

            if (isFieldSeparator()) {
                next(); // Skip field separator
            }
        };

        while (!eof()) {
            while (!newLine() && !eof()) {
                field();
            }
            addRecord();
            next(); // Skip new line or last character
        }
    };

    var processJSON = function(jsonData, nextOperation) {
        // Helper to add associative array functions
        var addAssociativeArrayFunctions = function(obj) {
            if (typeof module !== 'undefined' && module.exports) {
                var utils = require('../structures/utils.js');
                return utils.addAssociativeArrayFunctions(obj);
            } else {
                return CypherNG.structures.addAssociativeArrayFunctions(obj);
            }
        };

        if (jsonData.constructor == Array) {
            for (var i = 0; i < jsonData.length; i++) {
                data = addAssociativeArrayFunctions(
                    jsonData[i]
                );
                nextOperation();
            }
        } else if (jsonData.constructor == Object) {
            data = addAssociativeArrayFunctions(jsonData);
            nextOperation();
        }
    };

    /**
     * Execute the load operation.
     * @returns {Promise|undefined} May return a promise for async operations
     */
    this.doIt = function() {
        return this.run();
    };

    /**
     * Finish the load operation.
     */
    this.finish = function() {
        ;
    };

    /**
     * Save current variables to intermediate storage.
     * @returns {number} The storage key
     */
    this.saveVariables = function() {
        var variables = Object.fromEntries(
            statement.variables().map((v) => [v.getObjectKey(), v.value()])
        );
        var key = intermediateVariables.size;
        intermediateVariables.set(key, variables);
        return key;
    };

    /**
     * Restore variables from intermediate storage.
     * @param {number} key - The storage key
     */
    this.setVariables = function(key) {
        var variables = intermediateVariables.get(key);
        for (let variableKey in variables) {
            let variable = statement.getVariable(variableKey);
            let variableValue = variables[variableKey];
            if (variable) {
                variable.setOverriddenValue(variableValue);
            }
        }
    };

    /**
     * Remove variables from intermediate storage.
     * @param {number} key - The storage key
     */
    this.removeVariables = function(key) {
        var variables = intermediateVariables.get(key);
        for (let variableKey in variables) {
            let variable = statement.getVariable(variableKey);
            if (variable) {
                variable.setOverriddenValue(null);
            }
        }
        intermediateVariables.delete(key);
    };

    /**
     * Check if variables storage is empty.
     * @returns {boolean} True if empty
     */
    this.isVariablesEmpty = function() {
        return intermediateVariables.size == 0;
    };

    /**
     * Run the load operation.
     */
    this.run = function() {
        var me = this;
        var from = me.from();
        var variablesKey = me.saveVariables();
        var handleResponse = function(responseText) { // Success
            me.setVariables(variablesKey);
            if (me.loadType() == "CSV") {
                csvData = responseText;
                parseCSV(
                    me.fieldTerminator(),
                    function() {
                        nextOperation.doIt();
                    }
                );
            } else if (me.loadType() == "JSON") {
                processJSON(
                    JSON.parse(responseText),
                    function() {
                        nextOperation.doIt();
                    }
                );
            } else if (me.loadType() == "TEXT") {
                data = responseText;
                nextOperation.doIt();
            }
            me.removeVariables(variablesKey);
            if (me.isVariablesEmpty()) {
                nextOperation.finish();
            }
        };
        var handleError = function(statusText) { // Error
            var error = "Error loading data from " + from + ": " + statusText;
            try {
                self.onerror(error);
            } catch (e) {
                throw error;
            }
        };

        var http;
        if (typeof module !== 'undefined' && module.exports) {
            http = require('../network/HTTP.js').HTTP;
        } else {
            http = CypherNG.network.HTTP;
        }

        if (from.constructor == String) {
            if (me.getRequestType() == "GET") {
                try {
                    http.get(
                        from,
                        me.getHTTPHeaders() ? me.getHTTPHeaders().value(false) : null,
                        handleResponse,
                        handleError
                    );
                } catch (e) {
                    handleError(e);
                }
            } else if (me.getRequestType() == "POST") {
                try {
                    http.post(
                        me.from(),
                        me.getPayload(),
                        me.getHTTPHeaders() ? me.getHTTPHeaders().value(false) : null,
                        handleResponse,
                        handleError
                    );
                } catch (e) {
                    handleError(e);
                }
            }
        } else if (from.constructor != String) {
            if (me.loadType() == "JSON") {
                processJSON(
                    from,
                    function() {
                        nextOperation.doIt();
                    }
                );
            }
        }
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Load"
     */
    this.type = function() {
        return this.constructor.name;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Load = Load;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query.operations = (this.CypherNG = this.CypherNG || {}).query.operations || {});
