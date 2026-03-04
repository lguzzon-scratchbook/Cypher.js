/**
 * @fileoverview Built-in Cypher functions for parsing and evaluation.
 * Defines scalar functions like PI, sqrt, log, string functions, etc.
 */

/**
 * _Function - Represents a built-in Cypher function.
 *
 * @class
 * @memberof CypherNG.parser
 * @param {string} _displayValue - The function name
 * @param {number} _minimumExpectedParameterCount - Minimum parameters required
 * @param {number} _maximumExpectedParameterCount - Maximum parameters allowed
 * @param {Function} _valueFunction - Function to evaluate the function
 * @param {*} [_returnType] - Optional return type hint
 */
function _Function(_displayValue, _minimumExpectedParameterCount, _maximumExpectedParameterCount, _valueFunction, _returnType) {
    var displayValue = _displayValue;
    var minimumExpectedParameterCount = _minimumExpectedParameterCount;
    var maximumExpectedParameterCount = _maximumExpectedParameterCount;
    var returnType = _returnType;

    this.value = _valueFunction;
    this.getObject = _valueFunction;
    this.groupByKey = _valueFunction;
    this.groupByValue = _valueFunction;
    this.isFunction = true;
    this.displayValue = function() {
        return displayValue;
    };
    this.parametric = function() {
        return minimumExpectedParameterCount > 0;
    };
    this.precedence = function() {
        return 12;
    };
    this.leftAssociativity = function() {
        return true;
    };
    this.rightAssociativity = function() {
        return !this.leftAssociativity;
    };
    this.verifyParsedParameterCount = function(_parsedParameterCount) {
        if (_parsedParameterCount < minimumExpectedParameterCount) {
            throw "Too few parameters for function \"" + displayValue + "\".";
        } else if (_parsedParameterCount > maximumExpectedParameterCount) {
            throw "Too many parameters for function \"" + displayValue + "\".";
        }
    };
    this.returnType = function() {
        return returnType;
    };
}

/**
 * Collection of all Cypher built-in functions.
 * @namespace
 */
_Function.f = {};

// Mathematical constants
_Function.f.PI = new _Function("PI", 0, 0, function() { return Math.PI; });
_Function.f.E = new _Function("E", 0, 0, function() { return Math.E; });

// Mathematical functions
_Function.f.exp = new _Function("exp", 1, 1, function() { return Math.pow(Math.E, this.p[0].value()); });
_Function.f.sqrt = new _Function("sqrt", 1, 1, function() { return Math.sqrt(this.p[0].value()); });
_Function.f.log = new _Function("log", 2, 2, function() { return Math.log(this.p[0].value()) / (this.p[1].value() ? Math.log(this.p[1].value()) : 1); });
_Function.f.ln = new _Function("ln", 1, 1, function() { return Math.log(this.p[0].value()); });
_Function.f.sin = new _Function("sin", 1, 1, function() { return Math.sin(this.p[0].value()); });
_Function.f.cos = new _Function("cos", 1, 1, function() { return Math.cos(this.p[0].value()); });
_Function.f.round = new _Function("round", 1, 1, function() { return Math.round(this.p[0].value()); });
_Function.f.rand = new _Function("rand", 0, 0, function() { return Math.random(); });
_Function.f.rand.non_deterministic = true;

// Node/Relationship introspection functions
_Function.f.id = new _Function("id", 1, 1, function() {
    return this.p[0].value().id();
});
_Function.f.labels = new _Function("labels", 1, 1, function() {
    return this.p[0].value().getLabels();
});
_Function.f.type = new _Function("type", 1, 1, function() {
    return this.p[0].value().getType();
});
_Function.f.startnode = new _Function("startnode", 1, 1, function() {
    return this.p[0].value().startNode();
});
_Function.f.endnode = new _Function("endnode", 1, 1, function() {
    return this.p[0].value().endNode();
});
_Function.f.properties = new _Function("properties", 1, 1, function() {
    return this.p[0].value().getProperties();
});
_Function.f.exists = new _Function("exists", 1, 1, function() {
    return (this.p[0].value() != undefined);
});
_Function.f.keys = new _Function("keys", 1, 1, function() {
    try {
        return this.p[0].value().getKeys();
    } catch (e) {
        ;
    }
    return Object.keys(this.p[0].value());
});
_Function.f.nodes = new _Function("nodes", 1, 1, function() {
    return this.p[0].value().getNodes();
});
_Function.f.relationships = new _Function("relationships", 1, 1, function() {
    return this.p[0].value().getRelationships();
});

// List functions
_Function.f.head = new _Function("head", 1, 1, function() {
    return (this.p[0].value().shift ? this.p[0].value().shift() : null);
});
_Function.f.last = new _Function("last", 1, 1, function() {
    return (this.p[0].value().length > 0 ? this.p[0].value()[this.p[0].value().length - 1] : null);
});
_Function.f.size = new _Function("size", 1, 1, function() {
    return this.p[0].value().length;
});

// Lookup functions
_Function.f.object_lookup = new _Function("object_lookup", 2, 2, function() {
    if (this.p[0].value() && this.p[0].value().getProperty) {
        return this.p[0].value().getProperty(this.p[1].value());
    }
    try {
        return this.p[0].value()[this.p[1].value()];
    } catch (e) {
        ;
    }
    return null;
});
_Function.f.array_lookup = new _Function("array_lookup", 2, 2, function() {
    try {
        var lookup = this.p[1].value();
        if (lookup.constructor == Number || lookup.constructor == String) {
            return this.p[0].value()[lookup];
        } else if (lookup.constructor == Array) {
            var a = [];
            for (var i = 0; i < lookup.length; i++) {
                a.push(this.p[0].value()[lookup[i]]);
            }
            return a;
        }
    } catch (e) {
        ;
    }
    return null;
});

// String functions
_Function.f.split = new _Function("split", 2, 2, function() {
    var addArrayFunctions = (typeof module !== 'undefined' && module.exports ?
        require('../structures/utils.js').addArrayFunctions :
        CypherNG.structures.addArrayFunctions);
    var list = addArrayFunctions(
        this.p[0].value().split(this.p[1].value())
    );
    return list;
});
_Function.f.join = new _Function("join", 1, 2, function() {
    var joinBy = ((this.p[1] != undefined) && this.p[1].value()) || ",";
    return this.p[0].value().join(joinBy);
});
_Function.f.trim = new _Function("trim", 1, 1, function() {
    return this.p[0].value().trim();
});
_Function.f.lower = new _Function("lower", 1, 1, function() { return this.p[0].value().toLowerCase(); });
_Function.f.upper = new _Function("upper", 1, 1, function() { return this.p[0].value().toUpperCase(); });
_Function.f.replace = new _Function("replace", 3, 3, function() {
    var s = this.p[0].value();
    if (s.replace) {
        return s.replace(new RegExp(this.p[1].value(), "g"), this.p[2].value());
    } else {
        return s;
    }
});

// Type conversion functions
_Function.f.toint = new _Function("toint", 1, 1, function() {
    return parseInt(this.p[0].value());
});
_Function.f.tofloat = new _Function("tofloat", 1, 1, function() { return parseFloat(this.p[0].value()); });
_Function.f.tostring = new _Function("tostring", 1, 1, function() {
    try {
        return this.p[0].value().toString();
    } catch (e) {
        ;
    }
    return this.p[0].value() + "";
});
_Function.f.stringify = new _Function("stringify", 2, 2, function() {
    try {
        return JSON.stringify(this.p[0].value(), null, this.p[1].value());
    } catch (e) {
        ;
    }
    return null;
});
_Function.f.todate = new _Function("todate", 1, 1, function() { return new Date(this.p[0].value()); });
_Function.f.tojson = new _Function("tojson", 1, 1, function() {
    return JSON.parse(this.p[0].value());
});

// Range function
_Function.f.range = new _Function(
    "range",
    2,
    3,
    function() {
        var addArrayFunctions = (typeof module !== 'undefined' && module.exports ?
            require('../structures/utils.js').addArrayFunctions :
            CypherNG.structures.addArrayFunctions);
        var start = parseInt(this.p[0].value());
        var end = parseInt(this.p[1].value());
        var step = ((this.p[2] != undefined) && parseInt(this.p[2].value())) || 1;
        if (step == 0) {
            throw "Zero step-size not allowed";
        } else if (step < 0 && end > 0 && end > start) {
            throw "Negative step-size and positive end of range not allowed.";
        } else if (step > 0 && end < 0) {
            throw "Positive step-size and negative end of range not allowed.";
        } else if (end < start && step > 0) {
            throw "End of range smaller than start of range and positive step-size not allowed.";
        }
        var a = [];
        for (var i = start; i != end; i += step) {
            a.push(i);
        }
        return addArrayFunctions(a);
    }
);

// Utility functions
_Function.f.coalesce = new _Function("coalesce", 2, 2, function() {
    return (this.p[0].value() == null ? this.p[1].value() : this.p[0].value());
});
_Function.f.timestamp = new _Function("timestamp", 0, 0, function() {
    return new Date();
});
_Function.f.not = new _Function("not", 1, 1, function() { return !this.p[0].value(); });

// Build trie for fast function lookup
_Function.trie = (function() {
    var buildTrie = function(f) {
        var trie = {};
        for (var key in f) {
            var displayValue = f[key].displayValue();
            var trieNode = trie;
            for (var i = 0; i < displayValue.length; i++) {
                var char = displayValue.charAt(i).toUpperCase();
                if (!trieNode[char]) {
                    trieNode[char] = {};
                }
                trieNode = trieNode[char];
            }
            trieNode.isF = true;
            trieNode.f = f[key];
        }
        return trie;
    };
    return buildTrie(_Function.f);
})();

_Function.latestParsed = null;

/**
 * Check if text at position is a function.
 *
 * @memberof CypherNG.parser._Function
 * @param {string} expression - The expression text
 * @param {number} position - The position to check
 * @returns {number} Number of characters matched, or 0 if not a function
 */
_Function.isFunction = function(expression, position) {
    var isF = function(what, trie, expr, pos, noEndOfKeyWordCheck) {
        var trieNode = trie;
        var i = pos;
        var get = function(ix) {
            return expr.charAt(ix).toUpperCase();
        };
        var endOfKeyWord = function(ix) {
            if (noEndOfKeyWordCheck) {
                return true;
            }
            return get(ix) == " " ||
                get(ix) == "(" ||
                get(ix) == ")" ||
                get(ix) == "," ||
                get(ix) == "" ||
                get(ix) == "}" ||
                get(ix) == "\t" ||
                get(ix) == "\n" ||
                get(ix) == "\r" ||
                (get(ix) == "/" && get(ix + 1) == "/");
        };
        for (;;) {
            if (trieNode[get(i)]) {
                trieNode = trieNode[get(i)];
                if (trieNode.isF && !trieNode[get(i + 1)] && endOfKeyWord(i + 1)) {
                    what.latestParsed = trieNode.f;
                    return (i - pos) + 1;
                }
                i++;
            } else {
                return 0;
            }
        }
    };
    return isF(_Function, _Function.trie, expression, position);
};

// Export for both browser and Node.js
(function(exports) {
    exports._Function = _Function;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).parser = (this.CypherNG = this.CypherNG || {}).parser || {});
