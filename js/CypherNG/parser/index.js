/**
 * @fileoverview Parser module exports for CypherNG.
 * Re-exports all parser layer components.
 */

(function(global) {
    // Initialize global namespace
    if (typeof global.CypherNG === 'undefined') {
        global.CypherNG = {};
    }

    var parser = global.CypherNG.parser = global.CypherNG.parser || {};

    parser.Trie = require('./Trie.js').Trie;
    parser.KeyWord = require('./KeyWords.js').KeyWord;
    parser.Operator = require('./Operators.js').Operator;
    parser._Function = require('./Functions.js')._Function;
    parser.AggregateFunction = require('./AggregateFunctions.js').AggregateFunction;
    parser.PredicateFunctionLookup = require('./PredicateFunctionLookup.js').PredicateFunctionLookup;
    parser.Parser = require('./Parser.js').Parser;

})(typeof global !== 'undefined' ? global : (this || {}));

if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.CypherNG.parser;
}
