/**
 * @fileoverview Cypher operators for parsing and evaluation.
 * Defines all Cypher operators with precedence and associativity.
 */

/**
 * Operator - Represents a Cypher operator with precedence and associativity.
 *
 * @class
 * @memberof CypherNG.parser
 * @param {string} displayValue - The operator symbol/text
 * @param {number} precedence - Operator precedence (higher = binds tighter)
 * @param {boolean} leftAssociativity - True if left-associative
 * @param {Function} valueFunction - Function to evaluate the operator
 */
function Operator(displayValue, precedence, leftAssociativity, valueFunction) {
    var _displayValue = displayValue;
    var _precedence = precedence;
    var _leftAssociativity = leftAssociativity;

    this.value = valueFunction;
    this.isOperator = true;
    this.displayValue = function() {
        return _displayValue;
    };
    this.precedence = function() {
        return _precedence;
    };
    this.leftAssociativity = function() {
        return _leftAssociativity;
    };
    this.rightAssociativity = function() {
        return !_leftAssociativity;
    };
}

/**
 * Collection of all Cypher operators.
 * @namespace
 */
Operator.f = {};

// Arithmetic operators
Operator.f.POWER = new Operator("^", 11, false, function() { return Math.pow(this.lhs.value(), this.rhs.value()); });
Operator.f.MULTIPLY = new Operator("*", 10, true, function() { return this.lhs.value() * this.rhs.value(); });
Operator.f.DIVIDE = new Operator("/", 10, true, function() { return this.lhs.value() / this.rhs.value(); });
Operator.f.MODULO = new Operator("%", 10, true, function() { return this.lhs.value() % this.rhs.value(); });

// Set operators
Operator.f.SET_UNION = new Operator("|", 10, true, function() {
    try {
        return Array.from(new Set(this.lhs.value().concat(this.rhs.value())));
    } catch (error) {
        console.log(error);
        return null;
    }
});
Operator.f.SET_INTERSECT = new Operator("&", 10, true, function() {
    try {
        var A = new Set(this.lhs.value());
        var B = new Set(this.rhs.value());
        var intersect = new Set();
        for (var e of B) {
            if (A.has(e)) {
                intersect.add(e);
            }
        }
        return Array.from(intersect);
    } catch (error) {
        console.log(error);
        return null;
    }
});

// Addition and subtraction
Operator.f.PLUS = new Operator("+", 9, true, function() {
    if (this.lhs.value().constructor == Array) {
        return this.lhs.value().concat(this.rhs.value());
    }
    if (this.rhs.value().constructor == Array) {
        return [this.lhs.value()].concat(this.rhs.value());
    }
    return this.lhs.value() + this.rhs.value();
});
Operator.f.MINUS = new Operator("-", 9, true, function() {
    var lhs = this.lhs.value(),
        rhs = this.rhs.value();
    if (lhs.constructor == Array && rhs.constructor == Array) {
        var _difference = new Set(lhs);
        var rhs_set = new Set(rhs);
        for (var e of rhs_set) {
            _difference.delete(e);
        }
        return Array.from(_difference);
    }
    return lhs - rhs;
});

// Comparison operators
Operator.f.GREATER_THAN = new Operator(">", 8, true, function() { return this.lhs.value() > this.rhs.value(); });
Operator.f.LESS_THAN = new Operator("<", 8, true, function() { return this.lhs.value() < this.rhs.value(); });
Operator.f.GREATER_THAN_OR_EQUALS = new Operator(">=", 8, true, function() { return this.lhs.value() >= this.rhs.value(); });
Operator.f.LESS_THAN_OR_EQUALS = new Operator("<=", 8, true, function() { return this.lhs.value() <= this.rhs.value(); });

// Equality operators
Operator.f.EQUALS = new Operator("=", 7, true, function() { return this.lhs.value() == this.rhs.value(); });
Operator.f.NOT_EQUALS = new Operator("<>", 7, true, function() { return this.lhs.value() != this.rhs.value(); });

// IN operator
Operator.f.IN = new Operator("IN", 7, true, function() {
    if (this.rhs.value().constructor != Array) {
        throw "Not a list expression.";
    }
    return this.rhs.value().indexOf(this.lhs.value()) > -1;
});

// IS operator
Operator.f.IS = new Operator("IS", 7, true, function() { return this.lhs.value() == this.rhs.value(); });

// Logical operators
Operator.f.AND = new Operator("AND", 6, true, function() { return this.lhs.value() && this.rhs.value(); });
Operator.f.OR = new Operator("OR", 5, true, function() { return this.lhs.value() || this.rhs.value(); });

// None operator (default)
Operator.f.NONE = new Operator("NONE", -1, true, null);

// Build trie for fast operator lookup
Operator.trie = (function() {
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
    return buildTrie(Operator.f);
})();

Operator.latestParsed = null;

/**
 * Check if text at position is an operator.
 *
 * @memberof CypherNG.parser.Operator
 * @param {string} expression - The expression text
 * @param {number} position - The position to check
 * @returns {number} Number of characters matched, or 0 if not an operator
 */
Operator.isOperator = function(expression, position) {
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
    return isF(Operator, Operator.trie, expression, position, true);
};

// Export for both browser and Node.js
(function(exports) {
    exports.Operator = Operator;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).parser = (this.CypherNG = this.CypherNG || {}).parser || {});
