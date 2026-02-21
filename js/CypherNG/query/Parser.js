/**
 * Parser - Cypher query parser
 * 
 * Parses Cypher query statements and builds an expression tree.
 * Uses a recursive descent parser with the Shunting Yard algorithm for expressions.
 * 
 * Supports:
 * - CREATE, MATCH, MERGE, RETURN, WITH, UNWIND, LOAD CSV statements
 * - Graph patterns with nodes, relationships, and path variables
 * - Expressions with operators, functions, and aggregations
 * - WHERE clauses, LIMIT, and aliases
 */

const { StringRecoder } = require('../core/StringRecoder.js');
const { Node } = require('../core/Node.js');
const { Relationship } = require('../core/Relationship.js');
const { Pattern } = require('../core/Pattern.js');
const { List } = require('../types/List.js');
const { AssociativeArray } = require('../types/AssociativeArray.js');
const { Case } = require('../types/Case.js');
const { Predicate } = require('../types/Predicate.js');

/**
 * Trie data structure for efficient keyword/operator lookup
 */
const Trie = {
  buildTrie: function(f) {
    const trie = {};
    for (const key in f) {
      const displayValue = f[key].displayValue();
      let trieNode = trie;
      for (let i = 0; i < displayValue.length; i++) {
        const char = displayValue.charAt(i).toUpperCase();
        if (!trieNode[char]) {
          trieNode[char] = {};
        }
        trieNode = trieNode[char];
      }
      trieNode.isF = true;
      trieNode.f = f[key];
    }
    return trie;
  },
  
  isF: function(what, trie, expression, position, noEndOfKeyWordCheck) {
    let trieNode = trie;
    let i = position;
    const get = function(ix) {
      return expression.charAt(ix).toUpperCase();
    };
    const endOfKeyWord = function(ix) {
      if (noEndOfKeyWordCheck) return true;
      const c = get(ix);
      return c === ' ' || c === '(' || c === ')' || c === ',' || c === '' || 
             c === '}' || c === '\t' || c === '\n' || c === '\r' ||
             (c === '/' && get(ix + 1) === '/');
    };
    
    while (true) {
      if (trieNode[get(i)]) {
        trieNode = trieNode[get(i)];
        if (trieNode.isF && !trieNode[get(i + 1)] && endOfKeyWord(i + 1)) {
          what.latestParsed = trieNode.f;
          return (i - position) + 1;
        }
        i++;
      } else {
        return 0;
      }
    }
  }
};

/**
 * Keyword definitions
 */
function KeyWord(displayValue, actionFunction) {
  this.action = actionFunction;
  this.displayValue = function() { return displayValue; };
}

KeyWord.f = {};
KeyWord.f.CREATE = new KeyWord('CREATE', function(e) { e.create(); });
KeyWord.f.MATCH = new KeyWord('MATCH', function(e) { e.match(); });
KeyWord.f.MERGE = new KeyWord('MERGE', function(e) { e.merge(); });
KeyWord.f.WITH = new KeyWord('WITH', function(e) { e._with(); });
KeyWord.f.RETURN = new KeyWord('RETURN', function(e) { e._return(); });
KeyWord.f.INTO = new KeyWord('INTO', function(e) { e.into(); });
KeyWord.f.LIMIT = new KeyWord('LIMIT', function(e) { /* no-op */ });
KeyWord.f.UNWIND = new KeyWord('UNWIND', function(e) { e.unwind(); });
KeyWord.f.WHERE = new KeyWord('WHERE', function(e) { /* no-op */ });
KeyWord.f.LOAD = new KeyWord('LOAD', function(e) { e.load(); });
KeyWord.f.CSV = new KeyWord('CSV', function(e) { e.csv(); });
KeyWord.f.JSON = new KeyWord('JSON', function(e) { e.json(); });
KeyWord.f.TEXT = new KeyWord('TEXT', function(e) { e.text(); });
KeyWord.f.HEADERS = new KeyWord('HEADERS', function(e) { /* no-op */ });
KeyWord.f.FROM = new KeyWord('FROM', function(e) { /* no-op */ });
KeyWord.f.POST = new KeyWord('POST', function(e) { e.post(); });
KeyWord.f.AS = new KeyWord('AS', function(e) { /* no-op */ });
KeyWord.f.FIELDTERMINATOR = new KeyWord('FIELDTERMINATOR', function(e) { /* no-op */ });
KeyWord.f.SET = new KeyWord('SET', function(e) { /* no-op */ });
KeyWord.f.DISTINCT = new KeyWord('DISTINCT', function(e) { /* no-op */ });
KeyWord.f.TRUE = new KeyWord('TRUE', function(e) { /* no-op */ });
KeyWord.f.FALSE = new KeyWord('FALSE', function(e) { /* no-op */ });
KeyWord.f.NULL = new KeyWord('NULL', function(e) { /* no-op */ });
KeyWord.f.CASE = new KeyWord('CASE', function(e) { /* no-op */ });
KeyWord.f.WHEN = new KeyWord('WHEN', function(e) { /* no-op */ });
KeyWord.f.THEN = new KeyWord('THEN', function(e) { /* no-op */ });
KeyWord.f.ELSE = new KeyWord('ELSE', function(e) { /* no-op */ });
KeyWord.f.END = new KeyWord('END', function(e) { /* no-op */ });
KeyWord.f.SHORTESTPATH = new KeyWord('SHORTESTPATH', function(e) { /* no-op */ });
KeyWord.f.IN = new KeyWord('IN', function(e) { /* no-op */ });

KeyWord.trie = Trie.buildTrie(KeyWord.f);
KeyWord.latestParsed = null;
KeyWord.isKeyWord = function(statementText, position) {
  return Trie.isF(KeyWord, KeyWord.trie, statementText, position);
};

/**
 * Operator definitions with precedence and associativity
 */
function Operator(displayValue, precedence, leftAssociativity, valueFunction) {
  this.value = valueFunction;
  this.isOperator = true;
  this.displayValue = function() { return displayValue; };
  this.precedence = function() { return precedence; };
  this.leftAssociativity = function() { return leftAssociativity; };
  this.rightAssociativity = function() { return !leftAssociativity; };
}

Operator.f = {};
Operator.f.POWER = new Operator('^', 11, false, function() { 
  return Math.pow(this.lhs.value(), this.rhs.value()); 
});
Operator.f.MULTIPLY = new Operator('*', 10, true, function() { 
  return this.lhs.value() * this.rhs.value(); 
});
Operator.f.DIVIDE = new Operator('/', 10, true, function() { 
  return this.lhs.value() / this.rhs.value(); 
});
Operator.f.MODULO = new Operator('%', 10, true, function() { 
  return this.lhs.value() % this.rhs.value(); 
});
Operator.f.PLUS = new Operator('+', 9, true, function() {
  if (this.lhs.value().constructor === Array) {
    return this.lhs.value().concat(this.rhs.value());
  }
  if (this.rhs.value().constructor === Array) {
    return [this.lhs.value()].concat(this.rhs.value());
  }
  return this.lhs.value() + this.rhs.value();
});
Operator.f.MINUS = new Operator('-', 9, true, function() {
  return this.lhs.value() - this.rhs.value();
});
Operator.f.GREATER_THAN = new Operator('>', 8, true, function() { 
  return this.lhs.value() > this.rhs.value(); 
});
Operator.f.LESS_THAN = new Operator('<', 8, true, function() { 
  return this.lhs.value() < this.rhs.value(); 
});
Operator.f.GREATER_THAN_OR_EQUALS = new Operator('>=', 8, true, function() { 
  return this.lhs.value() >= this.rhs.value(); 
});
Operator.f.LESS_THAN_OR_EQUALS = new Operator('<=', 8, true, function() { 
  return this.lhs.value() <= this.rhs.value(); 
});
Operator.f.EQUALS = new Operator('=', 7, true, function() { 
  return this.lhs.value() == this.rhs.value(); 
});
Operator.f.NOT_EQUALS = new Operator('<>', 7, true, function() { 
  return this.lhs.value() != this.rhs.value(); 
});
Operator.f.IN = new Operator('IN', 7, true, function() {
  if (this.rhs.value().constructor !== Array) {
    throw new Error('Not a list expression.');
  }
  return this.rhs.value().indexOf(this.lhs.value()) > -1;
});
Operator.f.IS = new Operator('IS', 7, true, function() { 
  return this.lhs.value() == this.rhs.value(); 
});
Operator.f.AND = new Operator('AND', 6, true, function() { 
  return this.lhs.value() && this.rhs.value(); 
});
Operator.f.OR = new Operator('OR', 5, true, function() { 
  return this.lhs.value() || this.rhs.value(); 
});
Operator.f.NONE = new Operator('NONE', -1, true, null);

Operator.trie = Trie.buildTrie(Operator.f);
Operator.latestParsed = null;
Operator.isOperator = function(expression, position) {
  return Trie.isF(Operator, Operator.trie, expression, position, true);
};

/**
 * Function definitions
 */
function _Function(displayValue, minParams, maxParams, valueFunction, returnType) {
  this.value = valueFunction;
  this.getObject = valueFunction;
  this.groupByKey = valueFunction;
  this.groupByValue = valueFunction;
  this.isFunction = true;
  this.displayValue = function() { return displayValue; };
  this.parametric = function() { return minParams > 0; };
  this.precedence = function() { return 12; };
  this.leftAssociativity = function() { return true; };
  this.rightAssociativity = function() { return !this.leftAssociativity(); };
  this.verifyParsedParameterCount = function(parsedCount) {
    if (parsedCount < minParams) {
      throw new Error(`Too few parameters for function "${displayValue}".`);
    }
    if (parsedCount > maxParams) {
      throw new Error(`Too many parameters for function "${displayValue}".`);
    }
  };
  this.returnType = function() { return returnType; };
}

_Function.f = {};
_Function.f.PI = new _Function('PI', 0, 0, function() { return Math.PI; });
_Function.f.E = new _Function('E', 0, 0, function() { return Math.E; });
_Function.f.exp = new _Function('exp', 1, 1, function() { return Math.pow(Math.E, this.p[0].value()); });
_Function.f.sqrt = new _Function('sqrt', 1, 1, function() { return Math.sqrt(this.p[0].value()); });
_Function.f.log = new _Function('log', 2, 2, function() { 
  return Math.log(this.p[0].value()) / (this.p[1].value() ? Math.log(this.p[1].value()) : 1); 
});
_Function.f.ln = new _Function('ln', 1, 1, function() { return Math.log(this.p[0].value()); });
_Function.f.sin = new _Function('sin', 1, 1, function() { return Math.sin(this.p[0].value()); });
_Function.f.cos = new _Function('cos', 1, 1, function() { return Math.cos(this.p[0].value()); });
_Function.f.id = new _Function('id', 1, 1, function() { return this.p[0].value().id(); });
_Function.f.labels = new _Function('labels', 1, 1, function() { return this.p[0].value().getLabels(); });
_Function.f.type = new _Function('type', 1, 1, function() { return this.p[0].value().getType(); });
_Function.f.properties = new _Function('properties', 1, 1, function() { return this.p[0].value().getProperties(); });
_Function.f.keys = new _Function('keys', 1, 1, function() {
  try {
    return this.p[0].value().getKeys();
  } catch (e) {
    return Object.keys(this.p[0].value());
  }
});
_Function.f.head = new _Function('head', 1, 1, function() { 
  return this.p[0].value().shift ? this.p[0].value().shift() : null; 
});
_Function.f.last = new _Function('last', 1, 1, function() { 
  const arr = this.p[0].value();
  return arr.length > 0 ? arr[arr.length - 1] : null; 
});
_Function.f.size = new _Function('size', 1, 1, function() { return this.p[0].value().length; });
_Function.f.split = new _Function('split', 2, 2, function() { 
  return this.p[0].value().split(this.p[1].value()); 
}, List);
_Function.f.join = new _Function('join', 1, 2, function() {
  const joinBy = (this.p[1] !== undefined && this.p[1].value()) || ',';
  return this.p[0].value().join(joinBy);
});
_Function.f.trim = new _Function('trim', 1, 1, function() { return this.p[0].value().trim(); });
_Function.f.range = new _Function('range', 2, 3, function() {
  const start = parseInt(this.p[0].value());
  const end = parseInt(this.p[1].value());
  const step = (this.p[2] !== undefined && parseInt(this.p[2].value())) || 1;
  if (step === 0) throw new Error('Zero step-size not allowed');
  const result = [];
  for (let i = start; i !== end; i += step) {
    result.push(i);
  }
  return result;
}, List);
_Function.f.lower = new _Function('lower', 1, 1, function() { return this.p[0].value().toLowerCase(); });
_Function.f.upper = new _Function('upper', 1, 1, function() { return this.p[0].value().toUpperCase(); });
_Function.f.replace = new _Function('replace', 3, 3, function() {
  const s = this.p[0].value();
  return s.replace ? s.replace(new RegExp(this.p[1].value(), 'g'), this.p[2].value()) : s;
});
_Function.f.toint = new _Function('toint', 1, 1, function() { return parseInt(this.p[0].value()); });
_Function.f.tofloat = new _Function('tofloat', 1, 1, function() { return parseFloat(this.p[0].value()); });
_Function.f.tostring = new _Function('tostring', 1, 1, function() {
  try {
    return this.p[0].value().toString();
  } catch (e) {
    return this.p[0].value() + '';
  }
});
_Function.f.tojson = new _Function('tojson', 1, 1, function() { return JSON.parse(this.p[0].value()); });
_Function.f.coalesce = new _Function('coalesce', 2, 2, function() { 
  return this.p[0].value() == null ? this.p[1].value() : this.p[0].value(); 
});
_Function.f.round = new _Function('round', 1, 1, function() { return Math.round(this.p[0].value()); });
_Function.f.rand = new _Function('rand', 0, 0, function() { return Math.random(); });
_Function.f.timestamp = new _Function('timestamp', 0, 0, function() { return new Date(); });
_Function.f.not = new _Function('not', 1, 1, function() { return !this.p[0].value(); });

// Object and array lookup functions for property/index access
_Function.f.object_lookup = new _Function('object_lookup', 2, 2, function() {
  const obj = this.p[0].value();
  const key = this.p[1].value();
  if (obj && obj.getProperty) {
    const result = obj.getProperty(key);
    if (result !== null) return result;
    // If getProperty returns null, try id() for 'id' key
    if (key === 'id' && obj.id) {
      return obj.id();
    }
    return null;
  }
  if (obj && obj[key] !== undefined) {
    return obj[key];
  }
  // Special case for 'id' on objects with id() method
  if (key === 'id' && obj && obj.id) {
    return obj.id();
  }
  return null;
});
_Function.f.array_lookup = new _Function('array_lookup', 2, 2, function() {
  const arr = this.p[0].value();
  const index = this.p[1].value();
  if (Array.isArray(arr) && index >= 0 && index < arr.length) {
    return arr[index];
  }
  return null;
});

_Function.trie = Trie.buildTrie(_Function.f);
_Function.latestParsed = null;
_Function.isFunction = function(expression, position) {
  return Trie.isF(_Function, _Function.trie, expression, position);
};

/**
 * Aggregate function definitions
 */
function AggregateFunction(displayValue, minParams, maxParams, initFunction, valueFunction, aggregateFunction, returnType) {
  this.initialize = initFunction;
  this.value = valueFunction;
  this.getObject = valueFunction;
  this.aggregate = aggregateFunction;
  this.isFunction = true;
  this.displayValue = function() { return displayValue; };
  this.precedence = function() { return 12; };
  this.leftAssociativity = function() { return true; };
  this.rightAssociativity = function() { return !this.leftAssociativity(); };
  this.parametric = function() { return minParams > 0; };
  this.verifyParsedParameterCount = function(parsedCount) {
    if (parsedCount < minParams) {
      throw new Error(`Too few parameters for function "${displayValue}".`);
    }
    if (parsedCount > maxParams) {
      throw new Error(`Too many parameters for function "${displayValue}".`);
    }
  };
  this.returnType = function() { return returnType; };
}

AggregateFunction.f = {};
AggregateFunction.f.sum = new AggregateFunction(
  'sum', 1, 1,
  function() {
    if (!this.getGroupBy().getReducer(this.getReducerId()).result) {
      this.getGroupBy().getReducer(this.getReducerId()).result = 0;
    }
  },
  function() {
    return this.getGroupBy().getReducer(this.getReducerId()).result || 0;
  },
  function() {
    this.initializeIfNecessary();
    this.getGroupBy().getReducer(this.getReducerId()).result += this.p[0].value();
  }
);
AggregateFunction.f.min = new AggregateFunction(
  'min', 1, 1,
  function() { /* no-op */ },
  function() {
    return this.getGroupBy().getReducer(this.getReducerId()).result;
  },
  function() {
    const current = this.getGroupBy().getReducer(this.getReducerId()).result;
    const value = this.p[0].value();
    if (current === undefined || value < current) {
      this.getGroupBy().getReducer(this.getReducerId()).result = value;
    }
  }
);
AggregateFunction.f.max = new AggregateFunction(
  'max', 1, 1,
  function() { /* no-op */ },
  function() {
    return this.getGroupBy().getReducer(this.getReducerId()).result;
  },
  function() {
    const current = this.getGroupBy().getReducer(this.getReducerId()).result;
    const value = this.p[0].value();
    if (current === undefined || value > current) {
      this.getGroupBy().getReducer(this.getReducerId()).result = value;
    }
  }
);
AggregateFunction.f.count = new AggregateFunction(
  'count', 1, 1,
  function() {
    if (!this.getGroupBy().getReducer(this.getReducerId()).result) {
      this.getGroupBy().getReducer(this.getReducerId()).result = 0;
    }
  },
  function() {
    return this.getGroupBy().getReducer(this.getReducerId()).result || 0;
  },
  function() {
    this.initializeIfNecessary();
    this.getGroupBy().getReducer(this.getReducerId()).result += 1;
  }
);
AggregateFunction.f.collect = new AggregateFunction(
  'collect', 1, 1,
  function() {
    if (!this.getGroupBy().getReducer(this.getReducerId()).result) {
      this.getGroupBy().getReducer(this.getReducerId()).result = [];
    }
  },
  function() {
    return this.getGroupBy().getReducer(this.getReducerId()).result || [];
  },
  function() {
    this.initializeIfNecessary();
    this.getGroupBy().getReducer(this.getReducerId()).result.push(this.p[0].value());
  },
  List
);

AggregateFunction.trie = Trie.buildTrie(AggregateFunction.f);
AggregateFunction.latestParsed = null;
AggregateFunction.isAggregateFunction = function(expression, position) {
  return Trie.isF(AggregateFunction, AggregateFunction.trie, expression, position);
};

/**
 * Predicate function lookup
 */
function PredicateFunctionLookup(displayValue) {
  this.displayValue = function() { return displayValue; };
}

PredicateFunctionLookup.f = {};
PredicateFunctionLookup.f.sum = new PredicateFunctionLookup('sum');
PredicateFunctionLookup.f.all = new PredicateFunctionLookup('all');
PredicateFunctionLookup.f.any = new PredicateFunctionLookup('any');

PredicateFunctionLookup.trie = Trie.buildTrie(PredicateFunctionLookup.f);
PredicateFunctionLookup.latestParsed = null;
PredicateFunctionLookup.isPredicateFunction = function(expression, position) {
  return Trie.isF(PredicateFunctionLookup, PredicateFunctionLookup.trie, expression, position);
};

/**
 * Constant wrapper
 */
function Constant(value) {
  this.get = function() { return value; };
  this.value = function() { return value; };
  this.type = function() { return this.constructor.name; };
  this.groupByKey = function() { return value; };
  this.groupByValue = function() { return value; };
}

/**
 * FString (formatted string) for string interpolation
 */
function FString() {
  this._parts = [];
  this.string = function(str) { this._parts.push(str); };
  this.expression = function(expr) { this._parts.push(expr); };
  this.value = function() {
    let result = '';
    for (let i = 0; i < this._parts.length; i++) {
      if (this._parts[i].value) {
        result += this._parts[i].value();
      } else {
        result += this._parts[i];
      }
    }
    return result;
  };
  this.type = function() { return this.constructor.name; };
}

/**
 * Main Parser class
 */
class Parser {
  constructor(engine) {
    this._engine = engine;
    this._statementText = '';
    this._position = 0;
    this._token = '';
    this._inQuotes = false;
    this._rollbackPosition = undefined;
    this._optional = false;
    this._aggregationFunctionLevel = 0;
    
    this._forbiddenCharsList = '(): {}"\',.\n\r\t+-/*^[]=<>!';
    this._forbiddenChars = {};
    for (let i = 0; i < this._forbiddenCharsList.length; i++) {
      this._forbiddenChars[this._forbiddenCharsList[i]] = true;
    }
    
    // Expression tree builder state
    this._layers = [];
    this._output = [];
    this._operators = [];
    this._expressionElements = [];
  }

  parse(statementText) {
    this._statementText = statementText;
    this._position = 0;
    this._token = '';
    this._optional = false;
    this._aggregationFunctionLevel = 0;
    this._resetExpressionBuilder();
    this._parseToken();
  }

  statementText() {
    return this._statementText;
  }

  position() {
    return this._position;
  }

  getExpression() {
    return this._finishExpression();
  }

  // Token parsing
  _parseToken() {
    this._ignoreWhiteSpaceAndComments();
    if (this._parseLoad() || this._parseCreate() || this._parseMerge() || 
        this._parseMatch() || this._parseWith() || this._parseReturn() || this._parseUnwind()) {
      this._parseToken();
    }
    if (this._more()) {
      throw this._exception('Expected keyword.');
    }
  }

  _parseUnwind() {
    this._ignoreWhiteSpaceAndComments();
    if (this._unwind()) {
      this._parseExpression();
      this._engine.expression();
      this._parseUnwindAlias();
      this._parseSetter();
      return true;
    }
    return false;
  }

  _parseLoad() {
    this._ignoreWhiteSpaceAndComments();
    if (this._load()) {
      this._ignoreWhiteSpaceAndComments();
      if (this._csv()) {
        this._ignoreWhiteSpaceAndComments();
        if (this._with(true)) {
          this._ignoreWhiteSpaceAndComments();
          if (!this._headers()) {
            throw this._exception('Expected HEADERS-keyword.');
          }
          this._engine.statement().context().headers();
        }
        this._ignoreWhiteSpaceAndComments();
        if (this._from()) {
          this._parseLoadFrom();
          this._parseFieldTerminator();
          this._ignoreWhiteSpaceAndComments();
          if (!this._parseLoadAlias()) {
            throw this._exception('Expected alias.');
          }
        } else {
          throw this._exception('Expected FROM-keyword.');
        }
      } else if (this._json() || this._text()) {
        this._ignoreWhiteSpaceAndComments();
        if (this._from()) {
          this._parseLoadFrom();
        } else {
          throw this._exception('Expected FROM-keyword.');
        }
        this._ignoreWhiteSpaceAndComments();
        if (this._headers()) {
          this._parseHeaders();
        }
        this._ignoreWhiteSpaceAndComments();
        if (this._post()) {
          this._parsePost();
        }
        this._ignoreWhiteSpaceAndComments();
        if (!this._parseLoadAlias()) {
          throw this._exception('Expected alias.');
        }
      } else {
        throw this._exception('Expected CSV-, JSON-, or TEXT-keyword.');
      }
      return true;
    }
    return false;
  }

  _parseLoadFrom() {
    this._parseExpression();
    this._engine.expression();
  }

  _parsePost() {
    this._parseExpression();
    this._engine.expression();
  }

  _parseHeaders() {
    const array = this._parseAssociativeArray();
    if (array) {
      this._engine.statement().context().setHTTPHeaders(array);
    } else {
      throw this._exception('Expected associative array.');
    }
  }

  _parseFieldTerminator() {
    this._ignoreWhiteSpaceAndComments();
    if (this._fieldterminator()) {
      this._ignoreWhiteSpaceAndComments();
      if (this._parseString()) {
        this._engine.statement().context().setFieldTerminator(this._getAndResetToken());
      } else {
        throw this._exception('Expected single- or doublequoted string.');
      }
    }
  }

  _parseWith() {
    this._ignoreWhiteSpaceAndComments();
    if (this._with()) {
      if (this._parseWithOrReturnBody(true)) {
        this._parseSetter();
        return true;
      }
    }
    return false;
  }

  _parseReturn() {
    this._ignoreWhiteSpaceAndComments();
    if (this._return()) {
      return this._parseWithOrReturnBody();
    }
    return false;
  }

  _parseWithOrReturnBody(expressionMustHaveAlias) {
    do {
      this._ignoreWhiteSpaceAndComments();
      if (this._star()) {
        this._addAllVariables();
      } else {
        this._parseExpression();
        this._engine.expression();
        if (!this._parseAlias() && expressionMustHaveAlias && !this._engine.lastObject().hasKey()) {
          throw this._exception('Expression in WITH must be aliased (use AS).');
        }
      }
    } while (this._comma());
    this._parseWhere();
    this._ignoreWhiteSpaceAndComments();
    this._parseLimit();

    this._ignoreWhiteSpaceAndComments();
    if (this._into()) {
      this._ignoreWhiteSpaceAndComments();
      if (!this._parseTableName()) {
        throw this._exception('Expected table name.');
      }
      this._engine.insertInto(this._getAndResetToken());
    }
    return true;
  }

  _parseNodePattern(addPattern) {
    if (this._openingParentheses()) {
      if (addPattern) {
        this._engine.pattern();
      }
      this._engine.node();
      if (this._parseVariable(true)) {
        const variableKey = this._getAndResetToken();
        const parsedLabel = this._parseLabel();
        const parsedProperties = this._parseProperties();
        if (parsedLabel || parsedProperties) {
          if (this._engine.variableExists(variableKey)) {
            throw new Error('It is not allowed to create a new node in this context.');
          }
          this._engine.variable(variableKey);
        } else {
          if (this._engine.variableExists(variableKey)) {
            const referredObject = this._engine.getVariable(variableKey).getObject();
            if (referredObject.constructor.name !== 'Unwind' && !referredObject.isNode()) {
              throw new Error(`Variable \`${variableKey}\` is bound to a ${referredObject.type()}.`);
            }
            this._engine.lastObject().setReferredNode(referredObject);
          } else {
            this._engine.variable(variableKey);
          }
        }
      } else {
        this._parseLabel();
        this._parseProperties();
      }
      if (!this._closingParentheses()) {
        throw this._exception('Expecting closing parentheses.');
      }
      return true;
    }
    return false;
  }

  _parsePathLengthConstraints() {
    if (this._star()) {
      if (this._engine.operation() === 'Merge' || this._engine.operation() === 'Create') {
        throw new Error('Variable path length not supported in this context.');
      }
      this._engine.context().setHasVariablePathLength();
      if (this._parsePositiveInteger()) {
        this._engine.context().setPathLengthFrom(parseInt(this._getAndResetToken()));
      }
      if (this._dot()) {
        if (this._dot()) {
          if (this._parsePositiveInteger()) {
            this._engine.context().setPathLengthTo(parseInt(this._getAndResetToken()));
          }
        } else {
          throw this._exception('Expected "."');
        }
      }
      return true;
    }
    return false;
  }

  _parseRelationshipPattern() {
    const relationshipLeftDirection = this._relationshipLeftDirection();
    if (this._relationshipLine()) {
      this._engine.relationship();
      if (relationshipLeftDirection) {
        this._engine.leftDirection();
      }
      if (this._openingSquareBracket()) {
        if (this._parseVariable(true)) {
          const variableKey = this._getAndResetToken();
          const parsedType = this._parseType();
          const parsedProperties = this._parseProperties();
          const parsedPathLengthConstraints = this._parsePathLengthConstraints();
          if (parsedType || parsedProperties || parsedPathLengthConstraints) {
            if (this._engine.variableExists(variableKey)) {
              throw new Error('It is not allowed to create a new relationship in this context.');
            }
            this._engine.variable(variableKey);
          } else {
            if (this._engine.variableExists(variableKey)) {
              const referredObject = this._engine.getVariable(variableKey).getObject();
              if (!referredObject.isRelationship()) {
                throw new Error(`Variable \`${variableKey}\` is bound to a ${referredObject.type()}.`);
              }
              this._engine.lastObject().setReferredRelationship(referredObject);
            } else {
              this._engine.variable(variableKey);
            }
          }
        } else {
          this._parseType();
          this._parseProperties();
          this._parsePathLengthConstraints();
        }
        if (!this._closingSquareBracket()) {
          throw this._exception('Expected closing square bracket.');
        }
        if (!this._relationshipLine()) {
          throw this._exception('Expected relationship line.');
        }
        if (this._relationshipRightDirection()) {
          this._engine.rightDirection();
        }
        return true;
      } else {
        throw this._exception('Expected opening square bracket.');
      }
    }
    return false;
  }

  _parseGraphPattern(pathVariableNotAllowed) {
    let pathVariableName = undefined;
    if (this._parseVariable(true)) {
      this._ignoreWhiteSpaceAndComments();
      if (pathVariableNotAllowed && this._equals()) {
        throw this._exception('Path variable not allowed in this context.');
      }
      pathVariableName = this._getAndResetToken();
      if (!this._equals()) {
        throw this._exception('Expected variable assignment.');
      }
      this._ignoreWhiteSpaceAndComments();
    }
    const shortestPath = this._shortestpath();
    let nodeCount = 0;
    let relationshipCount = 0;
    if (shortestPath) {
      this._getAndResetToken();
      if (!this._openingParentheses()) {
        throw this._exception('Expected opening parentheses.');
      }
    }
    if (this._parseNodePattern(true)) {
      nodeCount++;
      if (pathVariableName) {
        this._engine.statement().addVariable(
          pathVariableName,
          this._engine.statement().context().getLast().getPattern()
        );
      }
      while (this._parseRelationshipPattern()) {
        if (!this._parseNodePattern()) {
          throw this._exception('Expecting node pattern.');
        }
        nodeCount++;
        relationshipCount++;
      }
    }
    if (shortestPath && (relationshipCount === 0 || relationshipCount > 1)) {
      throw new Error('Expected single relationship pattern.');
    }
    if (shortestPath && !this._closingParentheses()) {
      throw this._exception('Expected closing parentheses.');
    }
    if (shortestPath) {
      this._engine.statement().context().getPattern().shortestpath();
    }
    return nodeCount > 0;
  }

  _parseMerge() {
    this._ignoreWhiteSpaceAndComments();
    if (this._merge()) {
      this._ignoreWhiteSpaceAndComments();
      if (!this._parseGraphPattern()) {
        throw this._exception('Expecting graph pattern.');
      }
      this._parseWhere();
      this._parseSetter();
      return true;
    }
    return false;
  }

  _parseCreate() {
    this._ignoreWhiteSpaceAndComments();
    if (this._create()) {
      do {
        this._ignoreWhiteSpaceAndComments();
        if (!this._parseGraphPattern()) {
          throw this._exception('Expecting graph pattern.');
        }
      } while (this._comma());
      this._parseWhere();
      this._parseSetter();
      return true;
    }
    return false;
  }

  _parseMatch() {
    this._ignoreWhiteSpaceAndComments();
    if (this._match()) {
      do {
        this._ignoreWhiteSpaceAndComments();
        if (!this._parseGraphPattern()) {
          throw this._exception('Expecting graph pattern.');
        }
      } while (this._comma());
      this._parseWhere();
      this._parseSetter();
      return true;
    }
    return false;
  }

  _parseWhere() {
    if (this._where()) {
      this._parseExpression();
      this._engine.where(this.getExpression());
    }
  }

  _parseSetter() {
    this._ignoreWhiteSpaceAndComments();
    if (this._set()) {
      this._engine.setter();
      do {
        if (!this._parseVariable(true)) {
          throw this._exception('Expected variable.');
        }
        const variable = this._engine.getVariable(this._getAndResetToken());
        if (this._dot()) {
          let propertyKey;
          if (this._parsePropertyKey()) {
            propertyKey = this._getAndResetToken();
          } else {
            throw this._exception('Expected property key.');
          }
          this._ignoreWhiteSpaceAndComments();
          if (!this._equals()) {
            throw this._exception('Expected equals character (=).');
          }
          this._ignoreWhiteSpaceAndComments();
          this._parseExpression();
          const expression = this.getExpression();
          this._engine.operationContext().addSetter(variable, propertyKey, expression);
        } else {
          const variableType = variable.getObject().constructor.name;
          if (variableType !== 'Node' && variableType !== 'Relationship') {
            throw new Error(`Can't assign a label/type to a "${variable.getObject().type()}".`);
          }
          if (this._colon()) {
            if (!this._parseExpression()) {
              throw new Error('Expected expression.');
            }
            const expression = this.getExpression();
            if (variableType === 'Node') {
              this._engine.operationContext().addLabelSetter(variable, expression);
            } else if (variableType === 'Relationship') {
              this._engine.operationContext().addTypeSetter(variable, expression);
            }
          } else if (this._plusEquals()) {
            if (!this._parseExpression()) {
              throw new Error('Expected expression.');
            }
            const expression = this.getExpression();
            if (variableType === 'Node' || variableType === 'Relationship') {
              this._engine.operationContext().addMapSetter(variable, expression);
            }
          }
        }
      } while (this._comma());
    }
  }

  _parseLimit() {
    if (this._limit()) {
      this._parseExpression(true);
      this._engine.limit(this.getExpression());
    }
  }

  _parseExpression(variablesNotAllowed) {
    let parsedConstruct;
    let allowLookup = true;
    let element;

    if ((element = this._parseGraphPatternExpression())) {
      allowLookup = false;
    } else if (this._openingParentheses()) {
      this._addOpeningParentheses();
      element = this._parseExpression(variablesNotAllowed);
      if (!this._closingParentheses()) {
        throw this._exception('Expected closing parentheses.');
      }
      this._addClosingParentheses();
    } else if ((parsedConstruct = this._parsePredicateFunction())) {
      element = this._addPredicateFunction(parsedConstruct);
      allowLookup = false;
    } else if (this._function()) {
      element = this._parseFunction();
    } else if (this._aggregateFunction()) {
      element = this._parseAggregateFunction();
    } else if (this._parseConstant()) {
      element = this._addConstant(this._getAndResetToken());
    } else if ((parsedConstruct = this._parseCase())) {
      this._addCase(parsedConstruct);
      allowLookup = false;
    } else if ((parsedConstruct = this._parseFString())) {
      this._addFString(parsedConstruct);
    } else if (this._parseVariable(true)) {
      if (variablesNotAllowed) {
        throw this._exception('Variables not allowed within this context.');
      }
      element = this._addVariable(this._getAndResetToken());
    } else if ((parsedConstruct = this._parseList())) {
      element = this._addList(parsedConstruct);
    } else if ((parsedConstruct = this._parseAssociativeArray())) {
      element = this._addAssociativeArray(parsedConstruct);
    } else {
      if (!this._isOptional()) {
        throw this._exception('Expected expression');
      }
    }
    if (element && allowLookup) {
      this._parseLookup(element);
    }
    this._ignoreWhiteSpaceAndComments();
    if (this._operator()) {
      this._addOperator(Operator.latestParsed);
      this._ignoreWhiteSpaceAndComments();
      this._parseExpression();
    }
    return element;
  }

  _parseExpressionLayer() {
    this._addLayer();
    this._parseExpression();
    const expression = this.getExpression();
    this._finishLayer();
    return expression;
  }

  _parseLookup(element) {
    while (true) {
      if (this._dot()) {
        if (this._parsePropertyKey()) {
          this._addObjectLookup(element, this._getAndResetToken());
        } else {
          throw this._exception('Expected property key.');
        }
      } else if (this._parseListIndex(element)) {
        // List index parsed
      } else {
        this._noLookup();
        break;
      }
    }
  }

  _parseListIndex(element) {
    if (this._openingSquareBracket()) {
      this._addListLookup(element, this._parseExpressionLayer());
      if (!this._closingSquareBracket()) {
        throw this._exception('Expected closing square bracket.');
      }
      return true;
    }
    return false;
  }

  _parseCase() {
    if (this._case()) {
      this._ignoreWhiteSpaceAndComments();
      const caseStatement = new Case();
      while (this._when()) {
        caseStatement.when(this._parseExpressionLayer());
        this._ignoreWhiteSpaceAndComments();
        if (this._then()) {
          caseStatement.then(this._parseExpressionLayer());
        } else {
          throw this._exception('Expected THEN keyword');
        }
        this._ignoreWhiteSpaceAndComments();
      }
      if (caseStatement.whenCount() === 0) {
        throw this._exception('Expected WHEN keyword');
      }
      this._ignoreWhiteSpaceAndComments();
      if (this._else()) {
        caseStatement.else(this._parseExpressionLayer());
      }
      this._ignoreWhiteSpaceAndComments();
      if (!this._end()) {
        throw this._exception('Expected END keyword');
      }
      return caseStatement;
    }
    return false;
  }

  _parseAssociativeArray() {
    if (this._openingCurlyBrackets()) {
      const associativeArray = new AssociativeArray();
      do {
        if (this._parsePropertyKey()) {
          const key = this._getAndResetToken();
          if (!this._colon()) {
            throw this._exception('Expected colon.');
          }
          associativeArray.addEntry(key, this._parseExpressionLayer());
        }
      } while (this._comma());
      if (!this._closingCurlyBrackets()) {
        throw this._exception('Expected closing curly bracket.');
      }
      return associativeArray;
    }
    return false;
  }

  _parseList() {
    if (this._openingSquareBracket()) {
      const list = new List();
      do {
        this._setOptional();
        list.add(this._parseExpressionLayer());
      } while (this._comma());
      if (!this._closingSquareBracket()) {
        throw this._exception('Expected closing bracket.');
      }
      return list;
    }
    return false;
  }

  _parseAggregateFunction() {
    if (this._nestedAggregationFunction()) {
      throw this._exception('Not allowed to nest aggregation functions.');
    }
    if (this._openingParentheses()) {
      const aggregateExpressionElement = this._addAggregateFunction(AggregateFunction.latestParsed);
      this._addOpeningParentheses();
      this._increaseAggregationFunctionLevel();
      this._ignoreWhiteSpaceAndComments();
      if (this._distinct()) {
        aggregateExpressionElement.setDistinct();
      }
      this._ignoreWhiteSpaceAndComments();
      if (AggregateFunction.latestParsed.parametric()) {
        let parameterCount = 0;
        do {
          this._parseFunctionParameter();
          parameterCount++;
        } while (this._comma());
        try {
          aggregateExpressionElement.verifyParsedParameterCount(parameterCount);
        } catch (e) {
          throw this._exception(e.message);
        }
      }
      if (this._closingParentheses()) {
        this._addClosingParentheses();
        this._decreaseAggregationFunctionLevel();
      } else {
        throw this._exception('Expected closing parentheses.');
      }
      return aggregateExpressionElement;
    } else {
      throw this._exception('Expected opening parentheses.');
    }
  }

  _parseFunction() {
    if (this._openingParentheses()) {
      const functionElement = this._addFunction(_Function.latestParsed);
      this._addOpeningParentheses();
      if (_Function.latestParsed.parametric()) {
        let parameterCount = 0;
        do {
          this._parseFunctionParameter();
          parameterCount++;
        } while (this._comma());
        try {
          functionElement.verifyParsedParameterCount(parameterCount);
        } catch (e) {
          throw this._exception(e.message);
        }
      }
      if (this._closingParentheses()) {
        this._addClosingParentheses();
      } else {
        throw this._exception('Expected closing parentheses.');
      }
      return functionElement;
    } else {
      throw this._exception('Expected opening parentheses.');
    }
  }

  _parseFunctionParameter() {
    this._addExpression(this._parseExpressionLayer());
  }

  _parsePredicateFunction() {
    const initialPosition = this._position;
    let charsToAccumulate = 0;
    if ((charsToAccumulate = PredicateFunctionLookup.isPredicateFunction(this._statementText, this._position)) > 0) {
      this._position += charsToAccumulate;
      if (this._openingParentheses(false, true)) {
        const predicate = new Predicate();
        predicate.setPredicateFunctionName(PredicateFunctionLookup.latestParsed.displayValue());
        this._ignoreWhiteSpaceAndComments();
        if (this._parseVariable(true)) {
          const variableKey = this._getAndResetToken();
          predicate.variable(variableKey);
          this._ignoreWhiteSpaceAndComments();
          if (this._in()) {
            this._ignoreWhiteSpaceAndComments();
            const listExpression = this._parseExpressionLayer();
            if (!listExpression) {
              throw this._exception('Expected list.');
            }
            predicate.list(listExpression);
            this._ignoreWhiteSpaceAndComments();
            if (!this._where()) {
              throw this._exception('Expected WHERE-keyword.');
            }
            this._ignoreWhiteSpaceAndComments();
            const expression = this._parseExpressionLayer();
            predicate.where(expression);
            this._ignoreWhiteSpaceAndComments();
            if (!this._closingParentheses()) {
              throw this._exception('Expected closing parentheses.');
            }
            return predicate;
          }
        }
      }
    }
    this._position = initialPosition;
    return false;
  }

  _parseVariable(dontAddToEngine) {
    const addToEngine = !dontAddToEngine;
    this._ignoreWhiteSpaceAndComments();
    if (this._isNumeric(this._currentChar())) return false;
    if (this._backTickQuote()) {
      while (this._more() && !this._backTickQuote()) {
        this._token += this._currentChar();
        this._position++;
      }
    } else if (!this._backTickQuote()) {
      while (this._more() && !this._forbiddenChars[this._currentChar()]) {
        this._token += this._currentChar();
        this._position++;
      }
    }
    if (this._token.length > 0 && this._validVariableName()) {
      if (addToEngine) {
        this._engine.variable(this._getAndResetToken());
      }
      return true;
    }
    return false;
  }

  _parseAliasLabel() {
    return this._parseVariable(true);
  }

  _parseLoadAliasLabel() {
    return this._parseVariable(false);
  }

  _parseUnwindAliasLabel() {
    return this._parseVariable(false);
  }

  _parseTableName() {
    return this._parseVariable(true);
  }

  _parseLabel() {
    this._ignoreWhiteSpaceAndComments();
    if (!this._colon()) return false;
    let labelName = '';
    if (this._backTickQuote()) {
      while (this._more() && !this._backTickQuote()) {
        labelName += this._currentChar();
        this._position++;
      }
    } else if (!this._backTickQuote()) {
      while (this._more() && !this._forbiddenChars[this._currentChar()]) {
        labelName += this._currentChar();
        this._position++;
      }
    }
    if (labelName === '') {
      throw this._exception('Expecting label name.');
    }
    this._engine.label(labelName);
    this._parseLabel();
    return true;
  }

  _parseType() {
    this._ignoreWhiteSpaceAndComments();
    if (!this._colon()) return false;
    let typeName = '';
    if (this._backTickQuote()) {
      while (this._more() && !this._backTickQuote()) {
        typeName += this._currentChar();
        this._position++;
      }
    } else if (!this._backTickQuote()) {
      while (this._more() && !this._forbiddenChars[this._currentChar()]) {
        typeName += this._currentChar();
        this._position++;
      }
    }
    if (typeName === '') {
      throw this._exception('Expecting type name.');
    }
    this._engine.type(typeName);
    return true;
  }

  _parseProperties() {
    this._ignoreWhiteSpaceAndComments();
    if (this._openingCurlyBrackets()) {
      if (!this._parseProperty()) {
        throw this._exception('Expecting at least one property.');
      }
      if (!this._closingCurlyBrackets()) {
        throw this._exception('Expecting closing curly brackets.');
      }
      return true;
    }
    return false;
  }

  _parseProperty() {
    if (this._parsePropertyKey()) {
      this._engine.propertyKey(this._getAndResetToken());
    } else {
      return false;
    }
    if (!this._colon()) {
      throw this._exception('Expected colon.');
    }
    this._engine.propertyValue(this._parseExpressionLayer());
    if (this._comma()) {
      return this._parseProperty();
    }
    return true;
  }

  _parsePropertyKey() {
    this._ignoreWhiteSpaceAndComments();
    if (this._isNumeric(this._currentChar())) return false;
    if (this._backTickQuote()) {
      while (this._more() && !this._backTickQuote()) {
        this._token += this._currentChar();
        this._position++;
      }
    } else if (!this._backTickQuote()) {
      while (this._more() && !this._forbiddenChars[this._currentChar()]) {
        this._token += this._currentChar();
        this._position++;
      }
    }
    return this._token.length > 0;
  }

  _parseString() {
    let quoteFunction = null;
    if (this._singleQuote()) {
      quoteFunction = this._singleQuote;
    } else if (this._doubleQuote()) {
      quoteFunction = this._doubleQuote;
    } else if (this._backTickQuote()) {
      quoteFunction = this._backTickQuote;
    } else {
      return false;
    }
    this._inQuotes = true;
    while (!quoteFunction.call(this)) {
      if (!this._more()) {
        throw this._exception('Expected closing quote.');
      }
      this._escape();
      this._token += this._currentChar();
      this._position++;
    }
    this._inQuotes = false;
    return true;
  }

  _parseFString() {
    if (this._currentChar() !== 'f') {
      return false;
    }
    this._position++;
    let quoteFunction = null;
    if (this._singleQuote()) {
      quoteFunction = this._singleQuote;
    } else if (this._doubleQuote()) {
      quoteFunction = this._doubleQuote;
    } else if (this._backTickQuote()) {
      quoteFunction = this._backTickQuote;
    } else {
      this._position--;
      return false;
    }
    const fstring = new FString();
    this._inQuotes = true;
    while (!quoteFunction.call(this)) {
      if (!this._more()) {
        throw this._exception('Expected closing quote.');
      }
      this._escape();
      if (this._openingDoubleCurlyBrackets()) {
        this._token += '{';
        while (this._more() && !this._closingDoubleCurlyBrackets()) {
          this._escape();
          this._token += this._currentChar();
          this._position++;
        }
        if (!this._more()) {
          throw this._exception('Expected closing double curly bracket.');
        }
        this._token += '}';
      }
      if (this._openingCurlyBrackets(true)) {
        const substring = this._getAndResetToken();
        const expression = this._parseExpressionLayer();
        if (!expression) {
          throw this._exception('Expected expression.');
        }
        if (!this._closingCurlyBrackets(true)) {
          throw this._exception('Expected closing curly bracket.');
        }
        if (substring.length > 0) {
          fstring.string(substring);
        }
        fstring.expression(expression);
      }
      if (quoteFunction.call(this)) {
        break;
      }
      this._token += this._currentChar();
      this._position++;
    }
    this._inQuotes = false;
    if (this._token.length > 0) {
      fstring.string(this._getAndResetToken());
    }
    return fstring;
  }

  _parseConstant() {
    if (this._parseString()) {
      // String parsed
    } else if (this._parseNumber()) {
      this._token = parseFloat(this._token);
    } else if (this._true()) {
      this._token = true;
    } else if (this._false()) {
      this._token = false;
    } else if (this._null()) {
      this._token = null;
    } else {
      return false;
    }
    return true;
  }

  _parseAlias() {
    this._ignoreWhiteSpaceAndComments();
    if (this._as()) {
      if (!this._parseAliasLabel()) {
        throw this._exception('Expected alias variable key.');
      }
      this._engine.as(this._getAndResetToken());
      return true;
    }
    return false;
  }

  _parseLoadAlias() {
    this._ignoreWhiteSpaceAndComments();
    if (this._as()) {
      if (!this._parseLoadAliasLabel()) {
        throw this._exception('Expected alias variable key.');
      }
      this._engine.as(this._getAndResetToken());
      return true;
    }
    return false;
  }

  _parseUnwindAlias() {
    this._ignoreWhiteSpaceAndComments();
    if (this._as()) {
      if (!this._parseUnwindAliasLabel()) {
        throw this._exception('Unwinded collection must be aliased.');
      }
      return true;
    }
    return false;
  }

  _parseNumber() {
    this._ignoreWhiteSpaceAndComments();
    let negated = false;
    if (this._negation()) {
      this._accumulatePreviousChar();
      negated = true;
    }
    if (this._numeric()) {
      this._accumulatePreviousChar();
      while (this._numeric()) {
        this._accumulatePreviousChar();
      }
      if (this._dot()) {
        this._accumulatePreviousChar();
        if (this._numeric()) {
          this._accumulatePreviousChar();
          while (this._numeric()) {
            this._accumulatePreviousChar();
          }
        } else {
          throw this._exception('Expected one or more integers after decimal point.');
        }
      }
      this._ignoreWhiteSpaceAndComments();
    } else {
      if (negated) {
        throw this._exception('Expected number.');
      }
      return false;
    }
    return true;
  }

  _parsePositiveInteger() {
    this._ignoreWhiteSpaceAndComments();
    if (this._numeric()) {
      this._accumulatePreviousChar();
      while (this._numeric()) {
        this._accumulatePreviousChar();
      }
      this._ignoreWhiteSpaceAndComments();
    } else {
      return false;
    }
    return true;
  }

  // Expression tree builder methods
  _addLayer() {
    this._layers.push({
      output: this._output,
      operators: this._operators,
      expressionElements: this._expressionElements,
      rollbackPosition: this._rollbackPosition
    });
    this._resetExpressionBuilder();
  }

  _finishLayer() {
    const layer = this._layers.pop();
    this._output = layer.output;
    this._operators = layer.operators;
    this._expressionElements = layer.expressionElements;
    this._rollbackPosition = layer.rollbackPosition;
  }

  _resetExpressionBuilder() {
    this._output = [];
    this._operators = [];
    this._expressionElements = [];
  }

  _recordExpressionElement(element) {
    this._expressionElements.push(element);
    return element;
  }

  _lastOutput() {
    if (this._output.length === 0) return null;
    return this._output[this._output.length - 1];
  }

  _lastOperator() {
    if (this._operators.length === 0) return null;
    return this._operators[this._operators.length - 1];
  }

  _precedenceConditionIsMet(op1, op2) {
    if (op1.leftAssociativity() && op1.precedence() <= op2.precedence()) {
      return true;
    } else if (op1.rightAssociativity() && op1.precedence() < op2.precedence()) {
      return true;
    }
    return false;
  }

  _addObjectLookup(element, key) {
    if (!element.lookups) {
      element.lookups = [];
    }
    element.lookups.push({
      function: _Function.f.object_lookup,
      index: this._recordExpressionElement(new ExpressionElement(new Constant(key)))
    });
  }

  _addListLookup(element, expression) {
    if (!element.lookups) {
      element.lookups = [];
    }
    element.lookups.push({
      function: _Function.f.array_lookup,
      index: this._recordExpressionElement(new ExpressionElement(expression))
    });
  }

  _noLookup() {
    // No-op
  }

  _addConstant(value) {
    return this._addToOutput({
      isAtom: true,
      v: this._recordExpressionElement(new ExpressionElement(new Constant(value)))
    }).v;
  }

  _addAllVariables() {
    const vars = this._engine.statement().context().variables();
    for (let i = 0; i < vars.length; i++) {
      this._addVariable(vars[i].getObjectKey());
      this._engine.expression();
    }
  }

  _addVariable(key) {
    return this._addToOutput({
      isAtom: true,
      isVariable: true,
      v: this._recordExpressionElement(new ExpressionElement(new VariableReference(this._engine, key)))
    }).v;
  }

  _addPattern(pattern) {
    return this._addToOutput({
      isAtom: true,
      v: this._recordExpressionElement(new ExpressionElement(pattern))
    }).v;
  }

  _removeLastPattern() {
    const last = this._lastOutput();
    if (last && last.v.element().constructor === Pattern) {
      this._output.pop();
    }
  }

  _addExpression(expression) {
    return this._addToOutput({
      isAtom: true,
      v: this._recordExpressionElement(new ExpressionElement(expression))
    }).v;
  }

  _addList(list) {
    return this._addToOutput({
      isAtom: true,
      v: this._recordExpressionElement(new ExpressionElement(list))
    }).v;
  }

  _addAssociativeArray(associativeArray) {
    return this._addToOutput({
      isAtom: true,
      v: this._recordExpressionElement(new ExpressionElement(associativeArray))
    }).v;
  }

  _addCase(_case) {
    return this._addToOutput({
      isAtom: true,
      v: this._recordExpressionElement(new ExpressionElement(_case))
    }).v;
  }

  _addPredicateFunction(predicateFunction) {
    return this._addToOutput({
      isAtom: true,
      v: this._recordExpressionElement(new ExpressionElement(predicateFunction))
    }).v;
  }

  _addFString(fstring) {
    return this._addToOutput({
      isAtom: true,
      v: this._recordExpressionElement(new ExpressionElement(fstring))
    }).v;
  }

  _addFunction(__function) {
    return this._addToOperators({
      isFunction: true,
      v: this._recordExpressionElement(new ExpressionElement(__function))
    }).v;
  }

  _addAggregateFunction(aggregateFunction) {
    return this._addToOperators({
      isAggregateFunction: true,
      isFunction: true,
      v: this._recordExpressionElement(new AggregateExpressionElement(aggregateFunction))
    }).v;
  }

  _addOperator(operator) {
    while (this._operators.length > 0 && 
           ((this._operators[this._operators.length - 1].isOperator || 
             this._operators[this._operators.length - 1].isFunction) &&
            this._precedenceConditionIsMet(operator, this._operators[this._operators.length - 1].v.element()))) {
      this._output.push(this._operators.pop());
    }
    return this._addToOperators({
      isOperator: true,
      v: this._recordExpressionElement(new ExpressionElement(operator))
    }).v;
  }

  _addOpeningParentheses() {
    this._addToOperators({ leftParentheses: true });
  }

  _addClosingParentheses() {
    while (this._operators.length > 0 && !this._operators[this._operators.length - 1].leftParentheses) {
      this._output.push(this._operators.pop());
    }
    this._operators.pop();
  }

  _addToOutput(o) {
    this._output.push(o);
    return this._lastOutput();
  }

  _addToOperators(o) {
    this._operators.push(o);
    return this._lastOperator();
  }

  _finishExpression() {
    while (this._operators.length > 0) {
      this._output.push(this._operators.pop());
    }
    
    const expressionTreeNodes = [];
    let aggregationFunctions;
    const variableReferences = [];
    let nonDeterministic = false;
    
    while (this._output.length > 0) {
      const currentOutput = this._output.shift();
      
      if (!currentOutput || !currentOutput.v) {
        continue;
      }
      
      if (currentOutput.isOperator) {
        const rhs = expressionTreeNodes.pop();
        const lhs = expressionTreeNodes.pop();
        if (rhs && rhs.v) currentOutput.v.rhs = rhs.v;
        if (lhs && lhs.v) currentOutput.v.lhs = lhs.v;
      } else if (currentOutput.isFunction) {
        currentOutput.v.p = [];
        for (let j = 0; j < currentOutput.v.parsedParameterCount(); j++) {
          const param = expressionTreeNodes.pop();
          if (param && param.v) {
            currentOutput.v.p.unshift(param.v);
          }
        }
        if (currentOutput.isAggregateFunction) {
          if (!aggregationFunctions) {
            aggregationFunctions = [];
          }
          aggregationFunctions.push(currentOutput.v);
        }
        if (currentOutput.v.element() && currentOutput.v.element().nonDeterministic) {
          nonDeterministic = true;
        }
      }
      
      if (currentOutput.isVariable) {
        if (currentOutput.v.element() && currentOutput.v.element().getKey) {
          variableReferences.push(currentOutput.v.element().getKey());
        }
      }
      
      if (currentOutput.v.lookups) {
        const lookups = currentOutput.v.lookups;
        let tmpElement;
        while (lookups && lookups.length > 0) {
          tmpElement = currentOutput.v;
          const lookup = lookups.shift();
          if (lookup.function) {
            currentOutput.v = new ExpressionElement(lookup.function);
            currentOutput.v.p = [tmpElement, lookup.index];
          }
        }
      }
      
      expressionTreeNodes.push(currentOutput);
    }
    
    if (expressionTreeNodes.length === 0) {
      return null;
    }
    
    const Expression = require('./Expression.js').Expression;
    const expression = new Expression(
      expressionTreeNodes.pop().v,
      'expr',
      aggregationFunctions,
      this._engine.statement().context(),
      variableReferences,
      nonDeterministic
    );
    
    for (let i = 0; i < this._expressionElements.length; i++) {
      this._expressionElements[i].setExpression(expression);
    }
    
    this._resetExpressionBuilder();
    return expression;
  }

  // Helper methods
  _accumulatePreviousChar() {
    this._token += this._previousChar();
  }

  _setRollbackPosition() {
    this._rollbackPosition = this._position;
  }

  _rollback() {
    if (this._rollbackPosition === undefined || this._rollbackPosition > this._position) {
      return;
    }
    this._position -= (this._position - this._rollbackPosition);
    this._token = '';
    this._rollbackPosition = undefined;
  }

  _validVariableName() {
    if ((_Function.isFunction(this._token, 0) && this._openingParentheses(true)) ||
        (AggregateFunction.isAggregateFunction(this._token, 0) && this._openingParentheses(true)) ||
        KeyWord.isKeyWord(this._token, 0)) {
      this._position -= this._token.length;
      return false;
    }
    return true;
  }

  _getAndResetToken() {
    const r = this._token;
    this._token = '';
    return r;
  }

  _more() {
    return this._position < this._statementText.length;
  }

  _check(c, dontIgnoreWhiteSpace, dontIncrementPosition) {
    const incrementPosition = !dontIncrementPosition;
    if (!dontIgnoreWhiteSpace) {
      this._ignoreWhiteSpaceAndComments();
    }
    if (this._currentChar() === c) {
      if (incrementPosition) this._position++;
      return true;
    }
    return false;
  }

  // Character checking methods
  _relationshipLeftDirection() { return this._check('<'); }
  _relationshipRightDirection() { return this._check('>'); }
  _relationshipLine() { return this._check('-'); }
  _negation() { return this._check('-'); }
  _isNumeric(c) { return !isNaN(parseInt(c)); }
  _numeric() {
    const r = this._isNumeric(this._currentChar());
    if (r) this._position++;
    return r;
  }
  _star() { return this._check('*'); }
  _dot() { return this._check('.'); }
  _singleQuote() {
    if (this._previousChar() === '\\' && this._currentChar() === "'" && this._inQuotes) return false;
    return this._check("'", true);
  }
  _doubleQuote() {
    if (this._previousChar() === '\\' && this._currentChar() === '"' && this._inQuotes) return false;
    return this._check('"', true);
  }
  _backTickQuote() {
    if (this._previousChar() === '\\' && this._currentChar() === '`' && this._inQuotes) return false;
    return this._check('`', true);
  }
  _colon() { return this._check(':'); }
  _equals() { return this._check('='); }
  _plusEquals() { return this._check('+') && this._check('='); }
  _comma() { return this._check(','); }
  _escape() { return this._check('\\', true); }
  _openingParentheses(dontIncrementPosition, dontIgnoreWhiteSpace) { 
    return this._check('(', dontIgnoreWhiteSpace, dontIncrementPosition); 
  }
  _closingParentheses() { return this._check(')'); }
  _openingCurlyBrackets(dontIgnoreWhiteSpace, dontIncrementPosition) { 
    return this._check('{', dontIgnoreWhiteSpace, dontIncrementPosition); 
  }
  _closingCurlyBrackets(dontIgnoreWhiteSpace, dontIncrementPosition) { 
    return this._check('}', dontIgnoreWhiteSpace, dontIncrementPosition); 
  }
  _openingDoubleCurlyBrackets() {
    const present = this._currentChar() === '{' && this._nextChar() === '{';
    if (present) this._position += 2;
    return present;
  }
  _closingDoubleCurlyBrackets() {
    const present = this._currentChar() === '}' && this._nextChar() === '}';
    if (present) this._position += 2;
    return present;
  }
  _openingSquareBracket() { return this._check('['); }
  _closingSquareBracket() { return this._check(']'); }

  _ignoreWhiteSpaceAndComments() {
    if (!this._more()) return;
    while (this._currentChar() === ' ' || this._currentChar() === '\n' || 
           this._currentChar() === '\t' || this._currentChar() === '\r') {
      this._position++;
    }
    if (this._currentChar() === '/' && this._nextChar() === '/') {
      while (this._currentChar() !== '\n' && this._more()) {
        this._position++;
      }
      this._ignoreWhiteSpaceAndComments();
    }
  }

  _previousChar() { return this._statementText.charAt(this._position - 1); }
  _currentChar() { return this._statementText.charAt(this._position); }
  _nextChar() { return this._statementText.charAt(this._position + 1); }

  _got() {
    return ' Parsed "' + this._statementText.substring(0, this._position) + '". Got "' + this._currentChar() + '"';
  }

  _exception(message) {
    this._resetExpressionBuilder();
    return new Error(message + this._got());
  }

  // Keyword checking methods
  _create() { return this._keyword(KeyWord.f.CREATE); }
  _match() { return this._keyword(KeyWord.f.MATCH); }
  _merge() { return this._keyword(KeyWord.f.MERGE); }
  _shortestpath() { return this._keyword(KeyWord.f.SHORTESTPATH); }
  _function() {
    let charsToAccumulate = 0;
    if ((charsToAccumulate = _Function.isFunction(this._statementText, this._position)) > 0) {
      this._position += charsToAccumulate;
      if (this._openingParentheses(true, true)) {
        return true;
      }
      this._position -= charsToAccumulate;
      return false;
    }
    return false;
  }
  _aggregateFunction() {
    let charsToAccumulate = 0;
    if ((charsToAccumulate = AggregateFunction.isAggregateFunction(this._statementText, this._position)) > 0) {
      this._position += charsToAccumulate;
      return true;
    }
    return false;
  }
  _with(noAction) { return this._keyword(KeyWord.f.WITH, noAction); }
  _return() { return this._keyword(KeyWord.f.RETURN); }
  _into() { return this._keyword(KeyWord.f.INTO); }
  _limit() { return this._keyword(KeyWord.f.LIMIT); }
  _where() { return this._keyword(KeyWord.f.WHERE); }
  _load() { return this._keyword(KeyWord.f.LOAD); }
  _unwind() { return this._keyword(KeyWord.f.UNWIND); }
  _csv() { return this._keyword(KeyWord.f.CSV); }
  _json() { return this._keyword(KeyWord.f.JSON); }
  _text() { return this._keyword(KeyWord.f.TEXT); }
  _headers() { return this._keyword(KeyWord.f.HEADERS); }
  _from() { return this._keyword(KeyWord.f.FROM); }
  _post() { return this._keyword(KeyWord.f.POST); }
  _as() { return this._keyword(KeyWord.f.AS); }
  _fieldterminator() { return this._keyword(KeyWord.f.FIELDTERMINATOR); }
  _set() { return this._keyword(KeyWord.f.SET); }
  _distinct() { return this._keyword(KeyWord.f.DISTINCT); }
  _true() { return this._keyword(KeyWord.f.TRUE); }
  _false() { return this._keyword(KeyWord.f.FALSE); }
  _null() { return this._keyword(KeyWord.f.NULL); }
  _case() { return this._keyword(KeyWord.f.CASE); }
  _when() { return this._keyword(KeyWord.f.WHEN); }
  _then() { return this._keyword(KeyWord.f.THEN); }
  _else() { return this._keyword(KeyWord.f.ELSE); }
  _end() { return this._keyword(KeyWord.f.END); }
  _in() { return this._keyword(KeyWord.f.IN); }
  _operator() {
    let charsToAccumulate = 0;
    if ((charsToAccumulate = Operator.isOperator(this._statementText, this._position)) > 0) {
      this._position += charsToAccumulate;
      return true;
    }
    return false;
  }
  _keyword(which, noAction) {
    let charsToAccumulate = 0;
    if ((charsToAccumulate = KeyWord.isKeyWord(this._statementText, this._position)) > 0) {
      if (KeyWord.latestParsed === which) {
        if (!noAction) {
          KeyWord.latestParsed.action(this._engine);
        }
        this._position += charsToAccumulate;
        return true;
      }
    }
    return false;
  }
  _star() {
    if (this._currentChar() === '*') {
      this._position++;
      return true;
    }
    return false;
  }

  // Optional flag methods
  _setOptional() { this._optional = true; }
  _isOptional() {
    const _optional = this._optional;
    this._optional = false;
    return _optional;
  }

  // Aggregation function level methods
  _nestedAggregationFunction() { return this._aggregationFunctionLevel > 0; }
  _increaseAggregationFunctionLevel() { this._aggregationFunctionLevel++; }
  _decreaseAggregationFunctionLevel() { this._aggregationFunctionLevel--; }

  // Graph pattern expression parsing
  _parseGraphPatternExpression() {
    // Stub - would need full implementation
    return false;
  }
}

/**
 * VariableReference for expression tree
 */
function VariableReference(engine, variableKey) {
  this.getObject = function() {
    return engine.statement().getVariable(variableKey).getObject();
  };
  this.value = function(asKey) {
    return engine.statement().getVariable(variableKey).value(asKey);
  };
  this.getKey = function() { return variableKey; };
  this.type = function() {
    return engine.statement().getVariable(variableKey).getObject().type();
  };
  this.groupByKey = function() {
    const o = engine.statement().getVariable(variableKey).getObject();
    return (o.groupByKey && o.groupByKey()) || o;
  };
  this.groupByValue = function() {
    const o = engine.statement().getVariable(variableKey).getObject();
    return (o.groupByValue && o.groupByValue()) || o;
  };
}

/**
 * ExpressionElement for expression tree
 */
function ExpressionElement(element) {
  this.element = function() { return element; };
  this.precalculatedReadCount = 0;
  this.precalculatedValue = undefined;
  this.originalValueFunction = undefined;
  this._parsedParameterCount = 0;
  this.expression = undefined;
  
  element.parent = this;

  this.precalculate = function() {
    this.precalculatedReadCount = 0;
    this.precalculatedValue = this.value();
    this.originalValueFunction = this.value;
    this._setValueFunction(this._consumePrecalculatedValue);
  };

  this._consumePrecalculatedValue = function() {
    if (this.precalculatedValue && this.precalculatedReadCount === 0) {
      this.precalculatedReadCount++;
      return this.precalculatedValue;
    } else if (this.precalculatedValue && this.precalculatedReadCount === 1) {
      const tmp = this.precalculatedValue;
      this.precalculatedValue = undefined;
      this.precalculatedReadCount = 0;
      this._setValueFunction(this.originalValueFunction);
      return tmp;
    }
    return undefined;
  };

  this._setValueFunction = function(valueFunction) {
    this.value = valueFunction;
    this.groupByKey = this.value;
    this.groupByValue = this.value;
  };

  this.elementValueContext = function() { return this; };
  this.elementValue = function() { return element.value.call(this); };
  this.type = element.type;
  this.value = this.elementValue;
  this.groupByKey = element.groupByKey || this.elementValue;
  this.groupByValue = element.groupByValue || this.elementValue;
  this.hasKey = function() { return element.getKey && element.getKey(); };
  this.parsedParameterCount = function() { return this._parsedParameterCount; };
  this.verifyParsedParameterCount = function(count) {
    this._parsedParameterCount = count;
    if (element.constructor === _Function || element.constructor === AggregateFunction) {
      element.verifyParsedParameterCount(this._parsedParameterCount);
    }
  };
  this.nonDeterministic = function() { return element.nonDeterministic; };
  this.mappable = function() {
    if (element.mappable && !element.mappable()) return false;
    if (this.p) {
      for (let i = 0; i < this.p.length; i++) {
        if (this.p[i].mappable && !this.p[i].mappable()) return false;
      }
    }
    return true;
  };
  this.setExpression = function(expr) { this.expression = expr; };
  this.getLocalVariable = function(key) {
    if (this.expression) {
      return this.expression.getLocalVariable(key);
    }
    return undefined;
  };
}

/**
 * AggregateExpressionElement for aggregate functions
 */
function AggregateExpressionElement(element) {
  ExpressionElement.call(this, element);
  this.distinct = false;
  this.groupBy = undefined;
  this.reducerId = undefined;

  this.setReducer = function(id) { this.reducerId = id; };
  this.setGroupBy = function(gb) { this.groupBy = gb; };
  this.getGroupBy = function() { return this.groupBy; };
  this.getReducerId = function() { return this.reducerId; };
  this.initializeIfNecessary = function() { this.initialize(); };
  this.initialize = function() { return element.initialize.call(this); };
  this.aggregate = function() { return element.aggregate.call(this); };
  this.value = function() { return element.value.call(this); };
  this.groupByKey = function() { return element.groupByKey.call(this); };
  this.groupByValue = function() { return element.groupByValue.call(this); };
  this.hasKey = function() { return element.getKey && element.getKey(); };
  this.setDistinct = function() { this.distinct = true; };
  this.isDistinct = function() { return this.distinct; };
  this.mappable = function() { return false; };
}

// Inheritance
AggregateExpressionElement.prototype = Object.create(ExpressionElement.prototype);
AggregateExpressionElement.prototype.constructor = AggregateExpressionElement;

module.exports = { 
  Parser, 
  KeyWord, 
  Operator, 
  _Function, 
  AggregateFunction, 
  PredicateFunctionLookup,
  Constant,
  FString,
  Trie,
  VariableReference,
  ExpressionElement,
  AggregateExpressionElement
};
