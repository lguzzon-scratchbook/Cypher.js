/**
 * @fileoverview Matcher utility class for CypherNG.
 * Used for matching patterns against database entities.
 */

/**
 * Matcher - Utility class for pattern matching.
 * Tracks which entity IDs match the current pattern criteria.
 *
 * @class
 * @memberof CypherNG.core
 */
function Matcher() {
    var toMatchCount = 0;
    var idsMatchCount = [];
    var matchingSet = [];

    /**
     * Set the initial matching set and match counts.
     * @param {number[]} matchingSetArg - Array of entity IDs to match
     * @param {number} initialMatchCount - Initial match count for each ID
     */
    this.setMatchingSet = function(matchingSetArg, initialMatchCount) {
        matchingSet = matchingSetArg;
        idsMatchCount = new Array(matchingSet.length).fill(
            initialMatchCount != undefined ? initialMatchCount : 1
        );
    };

    /**
     * Add an ID to the matching set.
     * @param {number} id - The ID to add
     */
    this.addToMatchingSet = function(id) {
        matchingSet.push(parseInt(id));
        idsMatchCount.push(0);
    };

    /**
     * Update the matching set based on match counts.
     * Filters out IDs that haven't matched all criteria.
     */
    this.updateMatchingSet = function() {
        var carryOverCount = 0;
        for (var i = 0; i < matchingSet.length; i++) {
            if (idsMatchCount[i] == toMatchCount) {
                carryOverCount++;
            }
        }
        var newMatchingSet = new Array(carryOverCount);
        var new_i = 0;
        for (var i = 0; i < matchingSet.length; i++) {
            if (idsMatchCount[i] == toMatchCount) {
                newMatchingSet[new_i++] = matchingSet[i];
            }
        }
        matchingSet = newMatchingSet;
        idsMatchCount = new Array(matchingSet.length).fill(toMatchCount);
    };

    /**
     * Increment the number of criteria to match.
     */
    this.incrementToMatchCount = function() {
        toMatchCount++;
    };

    /**
     * Record a match for a specific ID.
     * @param {number} id - The ID that matched
     */
    this.keepMatchTally = function(id) {
        for (var i = 0; i < matchingSet.length; i++) {
            if (matchingSet[i] == id) {
                idsMatchCount[i] = (idsMatchCount[i] + 1 || 1);
            }
        }
    };

    /**
     * Get the number of criteria to match.
     * @returns {number} The match count
     */
    this.toMatchCount = function() {
        return toMatchCount;
    };

    /**
     * Get the current matching set.
     * @returns {number[]} Array of matching entity IDs
     */
    this.matchingSet = function() {
        return matchingSet;
    };

    /**
     * Get the size of the matching set.
     * @returns {number} The number of matching entities
     */
    this.matchingSetSize = function() {
        return matchingSet.length;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Matcher = Matcher;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).core = (this.CypherNG = this.CypherNG || {}).core || {});
