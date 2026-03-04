/**
 * @fileoverview Core module exports for CypherNG.
 * Re-exports all core data layer components.
 */

(function(global) {
    // Initialize global namespace
    global.CypherNG = global.CypherNG || {};

    // Re-export all core modules
    var core = global.CypherNG.core = global.CypherNG.core || {};

    // DB.js
    core.DB = core.DB || require('./DB.js').DB;

    // Node.js
    core.Node = core.Node || require('./Node.js').Node;

    // Relationship.js
    core.Relationship = core.Relationship || require('./Relationship.js').Relationship;

    // Pattern.js
    core.Pattern = core.Pattern || require('./Pattern.js').Pattern;

    // Matchers.js
    core.Matcher = core.Matcher || require('./Matchers.js').Matcher;

    // References.js
    core.NodeReference = core.NodeReference || require('./References.js').NodeReference;
    core.RelationshipReference = core.RelationshipReference || require('./References.js').RelationshipReference;

})(typeof global !== 'undefined' ? global : (this || {}));

// Also export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.CypherNG.core;
}
