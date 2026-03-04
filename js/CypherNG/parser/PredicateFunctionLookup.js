/**
 * @fileoverview Predicate function lookup for Cypher queries.
 * Defines predicate functions like ALL, ANY, SUM for list comprehensions.
 */

/**
 * PredicateFunctionLookup - Represents a predicate function name for lookup.
 *
 * @class
 * @memberof CypherNG.parser
 * @param {string} _displayValue - The predicate function name
 */
function PredicateFunctionLookup(_displayValue) {
    var displayValue = _displayValue;
    this.displayValue = function() {
        return displayValue;
    };
}

/**
 * Collection of all Cypher predicate functions.
 * @namespace
 */
PredicateFunctionLookup.f = {};

PredicateFunctionLookup.f.sum = new PredicateFunctionLookup("sum");
PredicateFunctionLookup.f.all = new PredicateFunctionLookup("all");
PredicateFunctionLookup.f.any = new PredicateFunctionLookup("any");

// Build trie for fast predicate function lookup
PredicateFunctionLookup.trie = (function() {
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
    return buildTrie(PredicateFunctionLookup.f);
})();

PredicateFunctionLookup.latestParsed = null;

/**
 * Check if text at position is a predicate function.
 *
 * @memberof CypherNG.parser.PredicateFunctionLookup
 * @param {string} expression - The expression text
 * @param {number} position - The position to check
 * @returns {number} Number of characters matched, or 0 if not a predicate function
 */
PredicateFunctionLookup.isPredicateFunction = function(expression, position) {
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
    return isF(PredicateFunctionLookup, PredicateFunctionLookup.trie, expression, position);
};

// Export for both browser and Node.js
(function(exports) {
    exports.PredicateFunctionLookup = PredicateFunctionLookup;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).parser = (this.CypherNG = this.CypherNG || {}).parser || {});
