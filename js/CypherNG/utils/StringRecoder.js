/**
 * @fileoverview StringRecoder utility for CypherNG
 *
 * A Trie-based string encoding utility for efficient string storage.
 * Recodes strings to integers for memory optimization in large datasets.
 *
 * @module CypherNG/utils/StringRecoder
 */

/**
 * Trie-based string recoder for efficient string storage
 * @class
 */
class StringRecoder {
    /**
     * Creates a new StringRecoder
     */
    constructor() {
        /** @private @type {number} */
        this._codeFactory = 1;
    }

    /**
     * Recode a string to an integer
     * @param {*} val - Value to recode
     * @returns {*} Recoded value
     */
    recode(val) {
        if (!val) return val;
        var strVal = val;
        if (!val.charAt) {
            strVal = '' + val;
        }
        // Simple hash-based recoding for strings
        var hash = 0;
        for (var i = 0; i < strVal.length; i++) {
            var char = strVal.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StringRecoder;
}