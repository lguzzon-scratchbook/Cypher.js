/**
 * @fileoverview GroupBy class for CypherNG.
 * Represents GROUP BY using trie data structure.
 */

var StringRecoder = (typeof module !== 'undefined' && module.exports ?
    require('../structures/utils.js').StringRecoder :
    CypherNG.structures.StringRecoder);
var NodeReference = (typeof module !== 'undefined' && module.exports ?
    require('../core/References.js').NodeReference :
    CypherNG.core.NodeReference);
var RelationshipReference = (typeof module !== 'undefined' && module.exports ?
    require('../core/References.js').RelationshipReference :
    CypherNG.core.RelationshipReference);

/**
 * GroupBy - Represents GROUP BY operation using a trie.
 * Manages grouping and aggregation for query results.
 *
 * @class
 * @memberof CypherNG.query
 * @param {Object} context - The context (Return statement) for grouping
 */
function GroupBy(context) {
    var context = context;
    var trieRoot = null;
    var currentTrieNode;
    var reducersCount = 0;
    var stringRecoder = new StringRecoder();

    // Persistence Design Note: GroupBy is a transient aggregation mechanism.
    // It does not need persistence but operates on persistent data.

    var newNode = function(value) {
        return {
            value: value,
            map: {}
        };
    };

    var recode = function(val) {
        if (val == undefined || val == null) {
            return val;
        }
        if (val.constructor == NodeReference || val.constructor == RelationshipReference) {
            return val.id();
        } else if (val.constructor == Array || val.constructor == Object) {
            return JSON.stringify(val);
        }
        return stringRecoder.recode(val);
    };

    /**
     * Get the trie root.
     * @returns {Object} The trie root node
     */
    this.getTrieRoot = function() {
        return trieRoot;
    };

    /**
     * Begin a new map operation.
     */
    this.beginMap = function() {
        if (trieRoot == null) {
            trieRoot = newNode();
        }
        currentTrieNode = trieRoot;
    };

    // Initialize the map
    this.beginMap();

    /**
     * Map an element to the trie.
     * @param {Object} element - The element to map
     */
    this.map = function(element) {
        if (element.non_deterministic()) {
            element.precalculate();
        }
        var groupByKey = recode(element.groupByKey());
        var groupByValue = element.groupByValue();
        if (!currentTrieNode.map[groupByKey]) {
            currentTrieNode.map[groupByKey] = newNode(groupByValue);
        }
        currentTrieNode = currentTrieNode.map[groupByKey];
    };

    /**
     * Get a reducer by index.
     * @param {number} reducerIdx - The reducer index
     * @returns {Object} The reducer object
     */
    this.getReducer = function(reducerIdx) {
        if (!currentTrieNode.reducers) {
            currentTrieNode.reducers = new Array(reducersCount);
        }
        if (!currentTrieNode.reducers[reducerIdx]) {
            currentTrieNode.reducers[reducerIdx] = {};
        }
        return currentTrieNode.reducers[reducerIdx];
    };

    /**
     * Add a new reducer.
     * @returns {number} The reducer index
     */
    this.addReducer = function() {
        return reducersCount++;
    };

    /**
     * Print the trie (for debugging).
     */
    this.print = function() {
        printTrie(trieRoot);
    };

    var printTrie = function(trieNode) {
        var key;
        for (key in trieNode.map) {
            context.setNextMapValue(
                trieNode.map[key].value
            );
            printTrie(trieNode.map[key]);
            context.moveToPreviousMapValue();
        }
        if (!key) {
            currentTrieNode = trieNode;
            context.addAggregateOutputRecord();
        }
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.GroupBy = GroupBy;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query = (this.CypherNG = this.CypherNG || {}).query || {});
