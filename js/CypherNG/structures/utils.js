/**
 * @fileoverview utils - Utility functions for CypherNG.
 * Part of CypherNG data structures.
 */

/**
 * StringRecoder - String interning/compression using a trie.
 *
 * @class
 * @memberof CypherNG.structures
 * @description
 * Implements string interning using a trie data structure.
 * Frequently used strings are assigned numeric codes for efficient
 * storage and comparison. This is particularly useful for property
 * keys and labels that repeat across many nodes/relationships.
 *
 * Persistence Design Note: The trie structure and code_factory counter
 * must be persisted together. To reconstruct, save all unique strings
 * with their assigned codes, then rebuild the trie on load.
 */
function StringRecoder() {
    var TrieNode = function() {
        return [{}, null];
    };
    var root = TrieNode();
    var code_factory = 1;
    var CHARS = 0;
    var CODE = 1;

    /**
     * Recode a string value to a numeric code (or return original if not a string).
     *
     * @param {*} _val - The value to recode
     * @returns {*} The recoded value (number for strings, original otherwise)
     */
    this.recode = function(_val) {
        if (!_val) return _val;
        var val = _val;
        if (!val.charAt) {
            val = '' + _val;
        }
        var n = root, char;
        for (var i = 0; i < val.length; i++) {
            char = val.charAt(i);
            if (!n[CHARS][char]) {
                n[CHARS][char] = TrieNode();
            }
            n = n[CHARS][char];
        }
        return n[CODE] || (n[CODE] = code_factory++);
    };
}

/**
 * IDFactory - Sequential ID generator.
 *
 * @class
 * @memberof CypherNG.structures
 * @description
 * Simple monotonic ID generator starting from -1 and incrementing.
 * Used for generating unique IDs for nodes and relationships.
 *
 * Persistence Design Note: The current ID counter must be persisted
 * to ensure ID uniqueness is maintained across restarts. Store the
 * current ID value and resume from that point on reload.
 */
function IDFactory() {
    var ID = -1;

    /**
     * Get the next sequential ID.
     *
     * @returns {number} The next ID (increments from -1)
     */
    this.getId = function() {
        return ID++;
    };
}

/**
 * Add array helper functions to an array.
 *
 * @function
 * @memberof CypherNG.structures
 * @param {*[]} array - The array to enhance
 * @returns {*[]} The same array with added helper methods
 * @description
 * Extends an array with utility methods for common operations.
 */
function addArrayFunctions(array) {
    /**
     * Check if array contains a value.
     * @param {*} value - The value to check for
     * @returns {boolean} True if found
     */
    array.contains = function(value) {
        for (var i = 0; i < array.length; i++) {
            if (value == array[i]) return true;
        }
        return false;
    };

    /**
     * Convert all elements to lowercase (if they have toLowerCase method).
     * @returns {*[]} New array with lowercased elements
     */
    array.toLowerCase = function() {
        var a = [];
        for (var i = 0; i < array.length; i++) {
            a.push(array[i].toLowerCase && array[i].toLowerCase() || array[i]);
        }
        return a;
    };

    /**
     * Convert all elements to uppercase (if they have toUpperCase method).
     * @returns {*[]} New array with uppercased elements
     */
    array.toUpperCase = function() {
        var a = [];
        for (var i = 0; i < array.length; i++) {
            a.push(array[i].toUpperCase && array[i].toUpperCase() || array[i]);
        }
        return a;
    };

    /**
     * Get the array (identity function).
     * @returns {*[]} The array itself
     */
    array.get = function() {
        return array;
    };

    /**
     * Get the last element.
     * @returns {*} The last element
     */
    array.last = function() {
        return array[array.length - 1];
    };

    /**
     * Get the second-to-last element.
     * @returns {*} The element before the last
     */
    array.beforeLast = function() {
        return array[array.length - 2];
    };

    /**
     * Get the array (alias for get).
     * @returns {*[]} The array itself
     */
    array.value = function() {
        return array;
    };

    /**
     * Join array elements with a separator.
     * @param {string} joinBy - The separator string
     * @returns {string} The joined string
     */
    array.join = function(joinBy) {
        var joined = '';
        for (var i = 0; i < array.length; i++) {
            joined += (i > 0 ? joinBy : '') + array[i];
        }
        return joined;
    };

    /**
     * Trim all elements (if they have trim method).
     * @returns {*[]} New array with trimmed elements
     */
    array.trim = function() {
        var trimmedElements = new Array(array.length);
        for (var i = 0; i < array.length; i++) {
            trimmedElements[i] = array[i].trim();
        }
        return trimmedElements;
    };

    return array;
}

/**
 * Add associative array helper functions to an object.
 *
 * @function
 * @memberof CypherNG.structures
 * @param {Object} associativeArray - The object to enhance
 * @returns {Object} The same object with added helper methods
 * @description
 * Extends an object with utility methods for common operations
 * on key-value stores.
 */
function addAssociativeArrayFunctions(associativeArray) {
    if (!associativeArray.getProperty) {
        /**
         * Get a property by key.
         * @param {string} key - The property key
         * @returns {*} The property value
         */
        associativeArray.getProperty = function(key) {
            return associativeArray[key];
        };
    }
    if (!associativeArray.getProperties) {
        /**
         * Get all properties (alias for getting the object itself).
         * @returns {Object} The object itself
         */
        associativeArray.getProperties = function() {
            return associativeArray;
        };
    }
    if (!associativeArray.getKeys) {
        /**
         * Get all keys (excluding functions).
         * @returns {string[]} Array of property keys
         */
        associativeArray.getKeys = function() {
            var props = [];
            for (var key in associativeArray) {
                if (associativeArray[key].constructor !== Function) {
                    props.push(key);
                }
            }
            return props;
        };
    }
    return associativeArray;
}

/**
 * Deep clean an object by removing functions and handling special cases.
 *
 * @function
 * @memberof CypherNG.structures
 * @param {*} o - The object to clean
 * @returns {*} The cleaned object
 * @description
 * Recursively processes an object to:
 * - Remove null characters from strings
 * - Unwrap NodeReference and RelationshipReference objects
 * - Remove all function properties
 * - Recursively clean nested objects
 */
function clean(o) {
    if (o && o.constructor == String) {
        // Remove null characters from Unicode strings
        return o.replace(/\0/g, '');
    }
    if (o) {
        var NodeReference = (typeof module !== 'undefined' && module.exports ?
            require('../core/References.js').NodeReference :
            CypherNG.core.NodeReference);
        var RelationshipReference = (typeof module !== 'undefined' && module.exports ?
            require('../core/References.js').RelationshipReference :
            CypherNG.core.RelationshipReference);

        if (o.constructor == NodeReference || o.constructor == RelationshipReference) {
            return clean(o.value());
        }
    }
    if (o) {
        for (var p in o) {
            if (typeof o[p] === "function") {
                delete o[p];
                continue;
            }
            if (o[p]) {
                o[p] = clean(o[p]);
            }
        }
        o.fromNode && (o.fromNode = clean(o.fromNode));
        o.toNode && (o.toNode = clean(o.toNode));
    }
    return o;
}

// Export for both browser and Node.js
(function(exports) {
    exports.StringRecoder = StringRecoder;
    exports.IDFactory = IDFactory;
    exports.addArrayFunctions = addArrayFunctions;
    exports.addAssociativeArrayFunctions = addAssociativeArrayFunctions;
    exports.clean = clean;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).structures = (this.CypherNG = this.CypherNG || {}).structures || {});
