/**
 * @fileoverview GroupBy class for CypherNG
 * 
 * Implements GROUP BY functionality for aggregation queries.
 * 
 * @module CypherNG/query/GroupBy
 */

const StringRecoder = require('../utils/StringRecoder');

/**
 * GroupBy class for aggregation
 * @class
 */
class GroupBy {
    /**
     * Creates a new GroupBy
     * @param {Object} context - Query context
     */
    constructor(context) {
        /** @private @type {Object} */
        this._context = context;
        /** @private @type {Object|null} */
        this._trieRoot = null;
        /** @private @type {Object|null} */
        this._currentTrieNode = null;
        /** @private @type {number} */
        this._reducersCount = 0;
        /** @private @type {StringRecoder} */
        this._stringRecoder = new StringRecoder();
    }

    /**
     * @private
     */
    _newNode(value) {
        return {
            value: value,
            map: {}
        };
    }

    /**
     * @private
     */
    _recode(val) {
        if (val === undefined || val === null) {
            return val;
        }
        if (val.constructor) {
            if (val.constructor.name === 'NodeReference' || val.constructor.name === 'RelationshipReference') {
                return val.id();
            } else if (val.constructor.name === 'Array' || val.constructor.name === 'Object') {
                return JSON.stringify(val);
            }
        }
        return this._stringRecoder.recode(val);
    }

    /**
     * Gets the trie root
     * @returns {Object|null} Trie root
     */
    getTrieRoot() {
        return this._trieRoot;
    }

    /**
     * Begins a new map operation
     */
    beginMap() {
        if (this._trieRoot === null) {
            this._trieRoot = this._newNode();
        }
        this._currentTrieNode = this._trieRoot;
    }

    /**
     * Maps an element
     * @param {Object} element - Element to map
     */
    map(element) {
        if (element.non_deterministic && element.non_deterministic()) {
            element.precalculate();
        }
        const groupByKey = this._recode(element.groupByKey ? element.groupByKey() : element);
        const groupByValue = element.groupByValue ? element.groupByValue() : element;
        
        if (!this._currentTrieNode.map[groupByKey]) {
            this._currentTrieNode.map[groupByKey] = this._newNode(groupByValue);
        }
        this._currentTrieNode = this._currentTrieNode.map[groupByKey];
    }

    /**
     * Gets a reducer
     * @param {number} reducerIdx - Reducer index
     * @returns {Object} Reducer object
     */
    getReducer(reducerIdx) {
        if (!this._currentTrieNode.reducers) {
            this._currentTrieNode.reducers = new Array(this._reducersCount);
        }
        if (!this._currentTrieNode.reducers[reducerIdx]) {
            this._currentTrieNode.reducers[reducerIdx] = {};
        }
        return this._currentTrieNode.reducers[reducerIdx];
    }

    /**
     * Adds a reducer
     * @returns {number} Reducer ID
     */
    addReducer() {
        return this._reducersCount++;
    }

    /**
     * Prints the trie (processes aggregated results)
     */
    print() {
        this._printTrie(this._trieRoot);
    }

    /**
     * @private
     */
    _printTrie(trieNode) {
        let key;
        for (key in trieNode.map) {
            this._context.setNextMapValue(trieNode.map[key].value);
            this._printTrie(trieNode.map[key]);
            this._context.moveToPreviousMapValue();
        }
        if (!key) {
            this._currentTrieNode = trieNode;
            this._context.addAggregateOutputRecord();
        }
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GroupBy;
}
