/**
 * @fileoverview Cypher keywords for parsing.
 * Defines all Cypher keywords with their associated actions.
 */

/**
 * KeyWord - Represents a Cypher keyword with an associated action.
 *
 * @class
 * @memberof CypherNG.parser
 * @param {string} displayValue - The keyword text
 * @param {Function} actionFunction - The action to execute when keyword is parsed
 */
function KeyWord(displayValue, actionFunction) {
    var _displayValue = displayValue;
    this.action = actionFunction;
    this.displayValue = function() {
        return _displayValue;
    };
}

/**
 * Collection of all Cypher keywords.
 * @namespace
 */
KeyWord.f = {};

// Core Cypher keywords
KeyWord.f.CREATE = new KeyWord("CREATE", function(e) { e.create(); });
KeyWord.f.MATCH = new KeyWord("MATCH", function(e) { e.match(); });
KeyWord.f.MERGE = new KeyWord("MERGE", function(e) { e.merge(); });
KeyWord.f.WITH = new KeyWord("WITH", function(e) { e._with(); });
KeyWord.f.RETURN = new KeyWord("RETURN", function(e) { e._return(); });
KeyWord.f.INTO = new KeyWord("INTO", function(e) { e.into(); });
KeyWord.f.LIMIT = new KeyWord("LIMIT", function(e) { ; });
KeyWord.f.UNWIND = new KeyWord("UNWIND", function(e) { e.unwind(); });
KeyWord.f.WHERE = new KeyWord("WHERE", function(e) { ; });
KeyWord.f.LOAD = new KeyWord("LOAD", function(e) { e.load(); });
KeyWord.f.CSV = new KeyWord("CSV", function(e) { e.csv(); });
KeyWord.f.JSON = new KeyWord("JSON", function(e) { e.json(); });
KeyWord.f.TEXT = new KeyWord("TEXT", function(e) { e.text(); });
KeyWord.f.HEADERS = new KeyWord("HEADERS", function(e) { ; });
KeyWord.f.FROM = new KeyWord("FROM", function(e) { ; });
KeyWord.f.POST = new KeyWord("POST", function(e) { e.post(); });
KeyWord.f.AS = new KeyWord("AS", function(e) { ; });
KeyWord.f.FIELDTERMINATOR = new KeyWord("FIELDTERMINATOR", function(e) { ; });
KeyWord.f.SET = new KeyWord("SET", function(e) { ; });
KeyWord.f.DISTINCT = new KeyWord("DISTINCT", function(e) { ; });
KeyWord.f.TRUE = new KeyWord("TRUE", function(e) { ; });
KeyWord.f.FALSE = new KeyWord("FALSE", function(e) { ; });
KeyWord.f.NULL = new KeyWord("NULL", function(e) { ; });
KeyWord.f.CASE = new KeyWord("CASE", function(e) { ; });
KeyWord.f.WHEN = new KeyWord("WHEN", function(e) { ; });
KeyWord.f.THEN = new KeyWord("THEN", function(e) { ; });
KeyWord.f.ELSE = new KeyWord("ELSE", function(e) { ; });
KeyWord.f.END = new KeyWord("END", function(e) { ; });
KeyWord.f.SHORTESTPATH = new KeyWord("SHORTESTPATH", function(e) { ; });
KeyWord.f.IN = new KeyWord("IN", function(e) { ; });

// Build trie for fast keyword lookup
KeyWord.trie = (function() {
    // Inline Trie.buildTrie to avoid circular dependency
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
    return buildTrie(KeyWord.f);
})();

/**
 * Check if text at position is a keyword.
 *
 * @memberof CypherNG.parser.KeyWord
 * @param {string} statementText - The statement text
 * @param {number} position - The position to check
 * @returns {number} Number of characters matched, or 0 if not a keyword
 */
KeyWord.isKeyWord = function(statementText, position) {
    var isF = function(what, trie, expression, pos, noEndOfKeyWordCheck) {
        var trieNode = trie;
        var i = pos;
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
                    return (i - pos) + 1;
                }
                i++;
            } else {
                return 0;
            }
        }
    };
    return isF(KeyWord, KeyWord.trie, statementText, position);
};

// Export for both browser and Node.js
(function(exports) {
    exports.KeyWord = KeyWord;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).parser = (this.CypherNG = this.CypherNG || {}).parser || {});
