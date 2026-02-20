/**
 * @fileoverview Parse Layer Module for CypherNG
 * Contains Trie, KeyWord, Operator, _Function, AggregateFunction, Parser
 * @module parse
 * 
 * This module handles Cypher query parsing including:
 * - Lexical analysis (Trie-based keyword/operator lookup)
 * - Syntax parsing (recursive descent parser)
 * - Expression tree building (shunting yard algorithm)
 */

// Lazy imports to avoid circular dependencies
let addArrayFunctions, addAssociativeArrayFunctions;
let List, AssociativeArray, Case, Predicate, FString, Constant;
let PatternNode, PatternRelationship, Pattern;
let StoredNode, StoredRelationship;
let Variable, Where, Inserter, Setter, GraphOperation, Create, Match, Merge;
let Return, With, Unwind, Load, GroupBy, ReturnValue;
let VariableReference, ExpressionElement, AggregateExpressionElement;

/**
 * Initialize dependencies from other modules
 * @param {Object} deps - Module dependencies
 */
export function initializeParseLayer(deps) {
    addArrayFunctions = deps.addArrayFunctions;
    addAssociativeArrayFunctions = deps.addAssociativeArrayFunctions;
    List = deps.List;
    AssociativeArray = deps.AssociativeArray;
    Case = deps.Case;
    Predicate = deps.Predicate;
    FString = deps.FString;
    Constant = deps.Constant;
    PatternNode = deps.PatternNode;
    PatternRelationship = deps.PatternRelationship;
    Pattern = deps.Pattern;
    StoredNode = deps.StoredNode;
    StoredRelationship = deps.StoredRelationship;
    Variable = deps.Variable;
    Where = deps.Where;
    Inserter = deps.Inserter;
    Setter = deps.Setter;
    GraphOperation = deps.GraphOperation;
    Create = deps.Create;
    Match = deps.Match;
    Merge = deps.Merge;
    Return = deps.Return;
    With = deps.With;
    Unwind = deps.Unwind;
    Load = deps.Load;
    GroupBy = deps.GroupBy;
    ReturnValue = deps.ReturnValue;
    VariableReference = deps.VariableReference;
    ExpressionElement = deps.ExpressionElement;
    AggregateExpressionElement = deps.AggregateExpressionElement;
}

// ============================================================
// Trie - Prefix tree for keyword/operator/function lookup
// ============================================================

/**
 * Trie - Prefix tree data structure for efficient keyword matching
 * @namespace
 */
const Trie = {
    /**
     * Build a trie from a collection of functions/keywords
     * @param {Object} f - Object with displayValue() methods
     * @returns {Object} Built trie
     */
    buildTrie: function(f) {
        const trie = {};
        for(const key in f) {
            const displayValue = f[key].displayValue();
            let trieNode = trie;
            for(let i=0; i<displayValue.length; i++) {
                const char = displayValue.charAt(i).toUpperCase();
                if(!trieNode[char]) trieNode[char] = {};
                trieNode = trieNode[char];
            }
            trieNode.isF = true;
            trieNode.f = f[key];
        }
        return trie;
    },
    
    /**
     * Check if expression matches a trie entry
     * @param {Object} trie - Trie to search
     * @param {string} expression - Expression string
     * @param {number} position - Starting position
     * @param {boolean} noEndOfKeyWordCheck - Skip end-of-keyword check
     * @returns {Object} {length, matched}
     */
    isF: function(trie, expression, position, noEndOfKeyWordCheck) {
        let trieNode = trie;
        let i = position;
        const get = function(ix) { return expression.charAt(ix).toUpperCase(); };
        const endOfKeyWord = function(ix) {
            if(noEndOfKeyWordCheck) return true;
            const c = get(ix);
            return c === " " || c === "(" || c === ")" || c === "," || c === "" ||
                c === "}" || c === "\t" || c === "\n" || c === "\r" ||
                (c === "/" && get(ix+1) === "/");
        };
        for(;;) {
            if(trieNode[get(i)]) {
                trieNode = trieNode[get(i)];
                if(trieNode.isF && !trieNode[get(i+1)] && endOfKeyWord(i+1)) {
                    return { length: (i-position)+1, matched: trieNode.f };
                }
                i++;
            } else {
                return { length: 0, matched: null };
            }
        }
    }
};

// ============================================================
// KeyWord - Cypher keyword definitions
// ============================================================

/**
 * KeyWord - Represents a Cypher keyword
 * @constructor
 * @param {string} displayValue - Keyword text
 * @param {Function} actionFunction - Action to execute when parsed
 */
function KeyWord(displayValue, actionFunction) {
    const dv = displayValue;
    this.action = actionFunction;
    this.displayValue = function() { return dv; };
}
KeyWord.f = {};

// Cypher keywords
KeyWord.f.CREATE = new KeyWord("CREATE", function(e) { e.create(); });
KeyWord.f.MATCH = new KeyWord("MATCH", function(e) { e.match(); });
KeyWord.f.MERGE = new KeyWord("MERGE", function(e) { e.merge(); });
KeyWord.f.WITH = new KeyWord("WITH", function(e) { e._with(); });
KeyWord.f.RETURN = new KeyWord("RETURN", function(e) { e._return(); });
KeyWord.f.INTO = new KeyWord("INTO", function(e) { e.into(); });
KeyWord.f.LIMIT = new KeyWord("LIMIT", function(e) { /* no-op */ });
KeyWord.f.UNWIND = new KeyWord("UNWIND", function(e) { e.unwind(); });
KeyWord.f.WHERE = new KeyWord("WHERE", function(e) { /* no-op */ });
KeyWord.f.LOAD = new KeyWord("LOAD", function(e) { e.load(); });
KeyWord.f.CSV = new KeyWord("CSV", function(e) { e.csv(); });
KeyWord.f.JSON = new KeyWord("JSON", function(e) { e.json(); });
KeyWord.f.TEXT = new KeyWord("TEXT", function(e) { e.text(); });
KeyWord.f.HEADERS = new KeyWord("HEADERS", function(e) { /* no-op */ });
KeyWord.f.FROM = new KeyWord("FROM", function(e) { /* no-op */ });
KeyWord.f.POST = new KeyWord("POST", function(e) { e.post(); });
KeyWord.f.AS = new KeyWord("AS", function(e) { /* no-op */ });
KeyWord.f.FIELDTERMINATOR = new KeyWord("FIELDTERMINATOR", function(e) { /* no-op */ });
KeyWord.f.SET = new KeyWord("SET", function(e) { /* no-op */ });
KeyWord.f.DISTINCT = new KeyWord("DISTINCT", function(e) { /* no-op */ });
KeyWord.f.TRUE = new KeyWord("TRUE", function(e) { /* no-op */ });
KeyWord.f.FALSE = new KeyWord("FALSE", function(e) { /* no-op */ });
KeyWord.f.NULL = new KeyWord("NULL", function(e) { /* no-op */ });
KeyWord.f.CASE = new KeyWord("CASE", function(e) { /* no-op */ });
KeyWord.f.WHEN = new KeyWord("WHEN", function(e) { /* no-op */ });
KeyWord.f.THEN = new KeyWord("THEN", function(e) { /* no-op */ });
KeyWord.f.ELSE = new KeyWord("ELSE", function(e) { /* no-op */ });
KeyWord.f.END = new KeyWord("END", function(e) { /* no-op */ });
KeyWord.f.SHORTESTPATH = new KeyWord("SHORTESTPATH", function(e) { /* no-op */ });
KeyWord.f.IN = new KeyWord("IN", function(e) { /* no-op */ });
KeyWord.trie = Trie.buildTrie(KeyWord.f);

// ============================================================
// Operator - Operator definitions with precedence
// ============================================================

/**
 * Operator - Represents a Cypher operator
 * @constructor
 * @param {string} displayValue - Operator symbol
 * @param {number} precedence - Operator precedence
 * @param {boolean} leftAssociativity - Left-to-right associativity
 * @param {Function} valueFunction - Function to compute value
 */
function Operator(displayValue, precedence, leftAssociativity, valueFunction) {
    const dv = displayValue;
    const prec = precedence;
    const leftAssoc = leftAssociativity;
    this.value = valueFunction;
    this.isOperator = true;
    this.displayValue = function() { return dv; };
    this.precedence = function() { return prec; };
    this.leftAssociativity = function() { return leftAssoc; };
    this.rightAssociativity = function() { return !leftAssoc; };
}
Operator.f = {};

// Arithmetic operators
Operator.f.POWER = new Operator("^", 11, false, function() { return Math.pow(this.lhs.value(), this.rhs.value()); });
Operator.f.MULTIPLY = new Operator("*", 10, true, function() { return this.lhs.value()*this.rhs.value(); });
Operator.f.DIVIDE = new Operator("/", 10, true, function() { return this.lhs.value()/this.rhs.value(); });
Operator.f.MODULO = new Operator("%", 10, true, function() { return this.lhs.value()%this.rhs.value(); });
Operator.f.SET_UNION = new Operator("|", 10, true, function() {
    try { return Array.from(new Set(this.lhs.value().concat(this.rhs.value()))); }
    catch(error) { console.log(error); return null; }
});
Operator.f.SET_INTERSECT = new Operator("&", 10, true, function() {
    try {
        const A = new Set(this.lhs.value()), B = new Set(this.rhs.value()), intersect = new Set();
        for(const e of B) { if(A.has(e)) intersect.add(e); }
        return Array.from(intersect);
    } catch(error) { console.log(error); return null; }
});
Operator.f.PLUS = new Operator("+", 9, true, function() {
    if(this.lhs.value().constructor == Array) return this.lhs.value().concat(this.rhs.value());
    if(this.rhs.value().constructor == Array) return [this.lhs.value()].concat(this.rhs.value());
    return this.lhs.value()+this.rhs.value();
});
Operator.f.MINUS = new Operator("-", 9, true, function() {
    const lhs = this.lhs.value(), rhs = this.rhs.value();
    if(lhs.constructor == Array && rhs.constructor == Array) {
        const _difference = new Set(lhs), rhs_set = new Set(rhs);
        for(const e of rhs_set) { _difference.delete(e); }
        return Array.from(_difference);
    }
    return lhs - rhs;
});

// Comparison operators
Operator.f.GREATER_THAN = new Operator(">", 8, true, function() { return this.lhs.value()>this.rhs.value(); });
Operator.f.LESS_THAN = new Operator("<", 8, true, function() { return this.lhs.value()<this.rhs.value(); });
Operator.f.GREATER_THAN_OR_EQUALS = new Operator(">=", 8, true, function() { return this.lhs.value()>=this.rhs.value(); });
Operator.f.LESS_THAN_OR_EQUALS = new Operator("<=", 8, true, function() { return this.lhs.value()<=this.rhs.value(); });
Operator.f.EQUALS = new Operator("=", 7, true, function() { return this.lhs.value()==this.rhs.value(); });
Operator.f.NOT_EQUALS = new Operator("<>", 7, true, function() { return this.lhs.value()!=this.rhs.value(); });
Operator.f.IN = new Operator("IN", 7, true, function() {
    (this.rhs.value().constructor != Array && (function() { throw "Not a list expression."; })());
    return this.rhs.value().indexOf(this.lhs.value()) > -1;
});
Operator.f.IS = new Operator("IS", 7, true, function() { return this.lhs.value()==this.rhs.value(); });

// Logical operators
Operator.f.AND = new Operator("AND", 6, true, function() { return this.lhs.value()&&this.rhs.value(); });
Operator.f.OR = new Operator("OR", 5, true, function() { return this.lhs.value()||this.rhs.value(); });
Operator.f.NONE = new Operator("NONE", -1, true, null);
Operator.trie = Trie.buildTrie(Operator.f);

// ============================================================
// _Function - Scalar and utility functions
// ============================================================

/**
 * _Function - Represents a scalar or utility function
 * @constructor
 * @param {string} _displayValue - Function name
 * @param {number} _minParams - Minimum parameter count
 * @param {number} _maxParams - Maximum parameter count
 * @param {Function} _valueFunction - Function implementation
 * @param {string} _returnType - Return type hint
 */
function _Function(_displayValue, _minParams, _maxParams, _valueFunction, _returnType) {
    const displayValue = _displayValue;
    const minimumExpectedParameterCount = _minParams;
    const maximumExpectedParameterCount = _maxParams;
    const returnType = _returnType;
    this.value = _valueFunction;
    this.getObject = _valueFunction;
    this.groupByKey = _valueFunction;
    this.groupByValue = _valueFunction;
    this.isFunction = true;
    this.displayValue = function() { return displayValue; };
    this.parametric = function() { return minimumExpectedParameterCount > 0; };
    this.precedence = function() { return 12; };
    this.leftAssociativity = function() { return true; };
    this.rightAssociativity = function() { return !this.leftAssociativity(); };
    this.verifyParsedParameterCount = function(n) {
        if(n < minimumExpectedParameterCount) throw "Too few parameters for function \"" + displayValue + "\".";
        else if(n > maximumExpectedParameterCount) throw "Too many parameters for function \"" + displayValue + "\".";
    };
    this.returnType = function() { return returnType; };
}
_Function.f = {};

// Math functions
_Function.f.PI = new _Function("PI", 0, 0, function() { return Math.PI; });
_Function.f.E = new _Function("E", 0, 0, function() { return Math.E; });
_Function.f.exp = new _Function("exp", 1, 1, function() { return Math.pow(Math.E, this.p[0].value()); });
_Function.f.sqrt = new _Function("sqrt", 1, 1, function() { return Math.sqrt(this.p[0].value()); });
_Function.f.log = new _Function("log", 2, 2, function() {
    return Math.log(this.p[0].value())/(this.p[1].value() ? Math.log(this.p[1].value()) : 1);
});
_Function.f.ln = new _Function("ln", 1, 1, function() { return Math.log(this.p[0].value()); });
_Function.f.sin = new _Function("sin", 1, 1, function() { return Math.sin(this.p[0].value()); });
_Function.f.cos = new _Function("cos", 1, 1, function() { return Math.cos(this.p[0].value()); });
_Function.f.round = new _Function("round", 1, 1, function() { return Math.round(this.p[0].value()); });
_Function.f.rand = new _Function("rand", 0, 0, function() { return Math.random(); });
_Function.f.rand.non_deterministic = true;
_Function.f.timestamp = new _Function("timestamp", 0, 0, function() { return new Date(); });

// Graph functions
_Function.f.id = new _Function("id", 1, 1, function() { return this.p[0].value().id(); });
_Function.f.labels = new _Function("labels", 1, 1, function() { return this.p[0].value().getLabels(); });
_Function.f.type = new _Function("type", 1, 1, function() { return this.p[0].value().getType(); });
_Function.f.startnode = new _Function("startnode", 1, 1, function() { return this.p[0].value().startNode(); });
_Function.f.endnode = new _Function("endnode", 1, 1, function() { return this.p[0].value().endNode(); });
_Function.f.properties = new _Function("properties", 1, 1, function() { return this.p[0].value().getProperties(); });
_Function.f.exists = new _Function("exists", 1, 1, function() { return (this.p[0].value() != undefined); });
_Function.f.keys = new _Function("keys", 1, 1, function() {
    try { return this.p[0].value().getKeys(); } catch(e) { /* empty */ }
    return Object.keys(this.p[0].value());
});
_Function.f.nodes = new _Function("nodes", 1, 1, function() { return this.p[0].value().getNodes(); });
_Function.f.relationships = new _Function("relationships", 1, 1, function() { return this.p[0].value().getRelationships(); });

// List/array functions
_Function.f.head = new _Function("head", 1, 1, function() { return (this.p[0].value().shift ? this.p[0].value().shift() : null); });
_Function.f.last = new _Function("last", 1, 1, function() {
    const a = this.p[0].value();
    return (a.length > 0 ? a[a.length-1] : null);
});
_Function.f.size = new _Function("size", 1, 1, function() { return this.p[0].value().length; });
_Function.f.split = new _Function("split", 2, 2, function() {
    return addArrayFunctions(this.p[0].value().split(this.p[1].value()));
}, List);
_Function.f.join = new _Function("join", 1, 2, function() {
    const joinBy = ((this.p[1] != undefined) && this.p[1].value()) || ",";
    return this.p[0].value().join(joinBy);
});
_Function.f.range = new _Function("range", 2, 3, function() {
    const start = parseInt(this.p[0].value()), end = parseInt(this.p[1].value());
    const step = ((this.p[2] != undefined) && parseInt(this.p[2].value())) || 1;
    if(step == 0) throw "Zero step-size not allowed";
    else if(step < 0 && end > 0 && end > start) throw "Negative step-size and positive end of range not allowed.";
    else if(step > 0 && end < 0) throw "Positive step-size and negative end of range not allowed.";
    else if(end < start && step > 0) throw "End of range smaller than start of range and positive step-size not allowed.";
    const a = [];
    for(let i=start; i != end; i += step) a.push(i);
    return addArrayFunctions(a);
}, List);

// String functions
_Function.f.trim = new _Function("trim", 1, 1, function() { return this.p[0].value().trim(); });
_Function.f.lower = new _Function("lower", 1, 1, function() { return this.p[0].value().toLowerCase(); });
_Function.f.upper = new _Function("upper", 1, 1, function() { return this.p[0].value().toUpperCase(); });
_Function.f.replace = new _Function("replace", 3, 3, function() {
    const s = this.p[0].value();
    if(s.replace) return s.replace(new RegExp(this.p[1].value(), "g"), this.p[2].value());
    return s;
});
_Function.f.toint = new _Function("toint", 1, 1, function() { return parseInt(this.p[0].value()); });
_Function.f.tofloat = new _Function("tofloat", 1, 1, function() { return parseFloat(this.p[0].value()); });
_Function.f.tostring = new _Function("tostring", 1, 1, function() {
    try { return this.p[0].value().toString(); } catch(e) { /* empty */ }
    return this.p[0].value() + "";
});
_Function.f.stringify = new _Function("stringify", 2, 2, function() {
    try { return JSON.stringify(this.p[0].value(), null, this.p[1].value()); } catch(e) { /* empty */ }
    return null;
});
_Function.f.todate = new _Function("todate", 1, 1, function() { return new Date(this.p[0].value()); });
_Function.f.tojson = new _Function("tojson", 1, 1, function() { return JSON.parse(this.p[0].value()); });

// Utility functions
_Function.f.coalesce = new _Function("coalesce", 2, 2, function() {
    return (this.p[0].value() == null ? this.p[1].value() : this.p[0].value());
});
_Function.f.not = new _Function("not", 1, 1, function() { return !this.p[0].value(); });
_Function.f.object_lookup = new _Function("object_lookup", 2, 2, function() {
    if(this.p[0].value() && this.p[0].value().getProperty) return this.p[0].value().getProperty(this.p[1].value());
    try { return this.p[0].value()[this.p[1].value()]; } catch(e) { /* empty */ }
    return null;
});
_Function.f.array_lookup = new _Function("array_lookup", 2, 2, function() {
    try {
        const lookup = this.p[1].value();
        if(lookup.constructor == Number || lookup.constructor == String) return this.p[0].value()[lookup];
        else if(lookup.constructor == Array) {
            const a = [];
            for(let i=0; i<lookup.length; i++) a.push(this.p[0].value()[lookup[i]]);
            return a;
        }
    } catch(e) { /* empty */ }
    return null;
});
_Function.trie = Trie.buildTrie(_Function.f);

// ============================================================
// AggregateFunction - Aggregation functions (count, sum, etc.)
// ============================================================

/**
 * AggregateFunction - Aggregation function definition
 * @constructor
 */
function AggregateFunction(_displayValue, _minParams, _maxParams, _initFunction, _valueFunction, _aggregateFunction, _returnType) {
    const displayValue = _displayValue;
    let parsedParameterCount = 0;
    const minimumExpectedParameterCount = _minParams;
    const maximumExpectedParameterCount = _maxParams;
    const returnType = _returnType;
    this.initialize = _initFunction;
    this.value = _valueFunction;
    this.getObject = _valueFunction;
    this.aggregate = _aggregateFunction;
    this.isFunction = true;
    this.initializeIfNecessary = function() { this.initialize(); };
    this.displayValue = function() { return displayValue; };
    this.precedence = function() { return 12; };
    this.leftAssociativity = function() { return true; };
    this.rightAssociativity = function() { return !this.leftAssociativity(); };
    this.parametric = function() { return minimumExpectedParameterCount > 0; };
    this.parsedParameterCount = function() { return parsedParameterCount; };
    this.verifyParsedParameterCount = function(n) {
        parsedParameterCount = n;
        if(parsedParameterCount < minimumExpectedParameterCount) throw "Too few parameters for function \"" + displayValue + "\".";
        else if(parsedParameterCount > maximumExpectedParameterCount) throw "Too many parameters for function \"" + displayValue + "\".";
    };
    this.returnType = function() { return returnType; };
}
AggregateFunction.f = {};

// Aggregation functions
AggregateFunction.f.sum = new AggregateFunction("sum", 1, 1,
    function() {
        if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
            this.getGroupBy().getReducer(this.getReducerId()).result = 0;
        }
    },
    function() {
        return this.getGroupBy().getReducer(this.getReducerId()).result || (new Number(0));
    },
    function() {
        this.initializeIfNecessary();
        this.getGroupBy().getReducer(this.getReducerId()).result += this.p[0].value();
    }
);

AggregateFunction.f.count = new AggregateFunction("count", 1, 1,
    function() {
        if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
            if(!this.distinct()) this.getGroupBy().getReducer(this.getReducerId()).result = 0;
            else this.getGroupBy().getReducer(this.getReducerId()).result = {};
        }
    },
    function() {
        if(!this.distinct()) return this.getGroupBy().getReducer(this.getReducerId()).result || (new Number(0));
        else return Object.keys(this.getGroupBy().getReducer(this.getReducerId()).result).length;
    },
    function() {
        this.initializeIfNecessary();
        if(!this.distinct()) {
            this.getGroupBy().getReducer(this.getReducerId()).result += 1;
        } else {
            const key = JSON.stringify((this.p[0].value().groupByKey && this.p[0].value().groupByKey()) || this.p[0].value());
            if(this.getGroupBy().getReducer(this.getReducerId()).result[key] == undefined) {
                this.getGroupBy().getReducer(this.getReducerId()).result[key] = true;
            }
        }
    }
);

AggregateFunction.f.min = new AggregateFunction("min", 1, 1,
    function() { /* no-op */ },
    function() { return this.getGroupBy().getReducer(this.getReducerId()).result; },
    function() {
        if((this.getGroupBy().getReducer(this.getReducerId()).result == undefined) ||
            this.p[0].value() < this.getGroupBy().getReducer(this.getReducerId()).result) {
            this.getGroupBy().getReducer(this.getReducerId()).result = this.p[0].value();
        }
    }
);

AggregateFunction.f.max = new AggregateFunction("max", 1, 1,
    function() { /* no-op */ },
    function() { return this.getGroupBy().getReducer(this.getReducerId()).result; },
    function() {
        if((this.getGroupBy().getReducer(this.getReducerId()).result == undefined) ||
            this.p[0].value() > this.getGroupBy().getReducer(this.getReducerId()).result) {
            this.getGroupBy().getReducer(this.getReducerId()).result = this.p[0].value();
        }
    }
);

AggregateFunction.f.collect = new AggregateFunction("collect", 1, 1,
    function() {
        if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
            if(!this.distinct()) this.getGroupBy().getReducer(this.getReducerId()).result = addArrayFunctions([]);
            else this.getGroupBy().getReducer(this.getReducerId()).result = {};
        }
    },
    function() {
        if(!this.distinct()) return this.getGroupBy().getReducer(this.getReducerId()).result || addArrayFunctions([]);
        else return addArrayFunctions(Object.values(this.getGroupBy().getReducer(this.getReducerId()).result));
    },
    function() {
        this.initializeIfNecessary();
        const val = this.p[0].value();
        if(val == null && val == undefined) return;
        if(!this.distinct()) {
            this.getGroupBy().getReducer(this.getReducerId()).result.push(this.p[0].value());
        } else {
            const key = JSON.stringify((this.p[0].value().groupByKey && this.p[0].value().groupByKey()) || this.p[0].value());
            if(this.getGroupBy().getReducer(this.getReducerId()).result[key] == undefined) {
                this.getGroupBy().getReducer(this.getReducerId()).result[key] = this.p[0].value();
            }
        }
    },
    List
);

AggregateFunction.f.stdev = new AggregateFunction("stdev", 1, 1,
    function() {
        if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
            this.getGroupBy().getReducer(this.getReducerId()).result = [];
        }
    },
    function() {
        let sum = 0;
        const values = this.getGroupBy().getReducer(this.getReducerId()).result;
        for(let i=0; i<values.length; i++) sum += values[i];
        const avg = sum/values.length;
        sum = 0;
        for(let i=0; i<values.length; i++) sum += Math.pow(values[i]-avg, 2);
        return Math.sqrt(sum/(values.length-1));
    },
    function() {
        this.initializeIfNecessary();
        this.getGroupBy().getReducer(this.getReducerId()).result.push(this.p[0].value());
    }
);

AggregateFunction.f.barchart = new AggregateFunction("barchart", 1, 1,
    function() {
        if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
            this.getGroupBy().getReducer(this.getReducerId()).result = {};
        }
    },
    function() {
        return addAssociativeArrayFunctions(this.getGroupBy().getReducer(this.getReducerId()).result);
    },
    function() {
        this.initializeIfNecessary();
        const key = (this.p[0].value().groupByKey && this.p[0].value().groupByKey()) || this.p[0].value();
        if(this.getGroupBy().getReducer(this.getReducerId()).result[key] == undefined) {
            this.getGroupBy().getReducer(this.getReducerId()).result[key] = 0;
        }
        this.getGroupBy().getReducer(this.getReducerId()).result[key]++;
    }
);

AggregateFunction.f.histogram = new AggregateFunction("histogram", 1, 2,
    function() {
        if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
            this.getGroupBy().getReducer(this.getReducerId()).result = { values: [], histogram: null };
        }
    },
    function() {
        const r = this.getGroupBy().getReducer(this.getReducerId()).result;
        if(r.histogram == null) {
            const bins = (this.p[1] && this.p[1].value()) || 10;
            let min = r.values[0], max = r.values[0];
            const histogram = new Array(bins).fill(0);
            for(let i=0; i<r.values.length; i++) {
                if(r.values[i] < min) min = r.values[i];
                if(r.values[i] > max) max = r.values[i];
            }
            const step = (max-min)/bins;
            for(let i=0; i<r.values.length; i++) { histogram[Math.floor(r.values[i]/step)]++; }
            r.histogram = new Array(bins);
            let from = min;
            for(let i=0; i<bins; i++) {
                r.histogram[i] = { label: "[" + from + ", " + (from+step)+">", value: histogram[i], from: from, to: from+step };
                from += step;
            }
        }
        return addArrayFunctions(r.histogram);
    },
    function() {
        this.initializeIfNecessary();
        this.getGroupBy().getReducer(this.getReducerId()).result.values.push(this.p[0].value());
    }
);

AggregateFunction.trie = Trie.buildTrie(AggregateFunction.f);

// ============================================================
// PredicateFunctionLookup - Predicate function lookup
// ============================================================

/**
 * PredicateFunctionLookup - For all(), any(), sum() predicate forms
 * @constructor
 */
function PredicateFunctionLookup(_displayValue) {
    const displayValue = _displayValue;
    this.displayValue = function() { return displayValue; };
}
PredicateFunctionLookup.f = {};
PredicateFunctionLookup.f.sum = new PredicateFunctionLookup("sum");
PredicateFunctionLookup.f.all = new PredicateFunctionLookup("all");
PredicateFunctionLookup.f.any = new PredicateFunctionLookup("any");
PredicateFunctionLookup.trie = Trie.buildTrie(PredicateFunctionLookup.f);

// Export parse layer components
export { 
    Trie, 
    KeyWord, 
    Operator, 
    _Function, 
    AggregateFunction, 
    PredicateFunctionLookup 
};