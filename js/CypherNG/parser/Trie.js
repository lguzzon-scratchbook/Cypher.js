/**
 * @fileoverview Trie utilities for parsing Cypher queries.
 * Provides efficient keyword and operator lookup using trie data structure.
 */

/**
 * Trie - Utility class for building and searching tries.
 *
 * @namespace CypherNG.parser.Trie
 * @class
 * @memberof CypherNG.parser
 */
var Trie = {
    /**
     * Build a trie from a collection of functions/keywords.
     *
     * @memberof CypherNG.parser.Trie
     * @param {Object} f - Object containing functions/keywords with displayValue() method
     * @returns {Object} The constructed trie tree
     */
    buildTrie: function(f) {
        var trie = {};
        var char;
        for (var key in f) {
            var displayValue = f[key].displayValue();

            var trieNode = trie;

            for (var i = 0; i < displayValue.length; i++) {
                char = displayValue.charAt(i).toUpperCase();
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

    /**
     * Search for a function/keyword in the trie at a given position.
     *
     * @memberof CypherNG.parser.Trie
     * @param {Object} what - The namespace object (e.g., KeyWord, Operator)
     * @param {Object} trie - The trie to search in
     * @param {string} expression - The expression string to search in
     * @param {number} position - The starting position in the expression
     * @param {boolean} [noEndOfKeyWordCheck] - Skip end-of-keyword validation
     * @returns {number} Number of characters matched, or 0 if no match
     */
    isF: function(what, trie, expression, position, noEndOfKeyWordCheck) {
        var trieNode = trie;
        var i = position;
        var get = function(ix) {
            return expression.charAt(ix).toUpperCase();
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
                    return (i - position) + 1;
                }
                i++;
            } else {
                return 0;
            }
        }
    }
};

// Export for both browser and Node.js
(function(exports) {
    exports.Trie = Trie;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).parser = (this.CypherNG = this.CypherNG || {}).parser || {});
