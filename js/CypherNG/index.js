/**
 * @fileoverview CypherNG - Root module index.
 * Re-exports all CypherNG modules for convenient access.
 *
 * @module CypherNG
 */

(function(global) {
    'use strict';

    // Initialize namespace
    var CypherNG = global.CypherNG || {};

    /**
     * Core data layer modules.
     * @namespace CypherNG.core
     */
    CypherNG.core = CypherNG.core || {};

    /**
     * Data structures and utilities.
     * @namespace CypherNG.structures
     */
    CypherNG.structures = CypherNG.structures || {};

    /**
     * Network/HTTP utilities.
     * @namespace CypherNG.network
     */
    CypherNG.network = CypherNG.network || {};

    /**
     * Query layer modules.
     * @namespace CypherNG.query
     */
    CypherNG.query = CypherNG.query || {};

    /**
     * Parser layer modules.
     * @namespace CypherNG.parser
     */
    CypherNG.parser = CypherNG.parser || {};

    // Export to global
    global.CypherNG = CypherNG;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// Load all modules
(function() {
    // Check if running in Node.js
    var isNode = typeof module !== 'undefined' && module.exports;

    if (isNode) {
        // Node.js: Load modules via require
        var core = require('./core/index.js');
        var structures = require('./structures/index.js');
        var network = require('./network/index.js');
        var query = require('./query/index.js');
        var parser = require('./parser/index.js');

        // Export main Cypher class
        module.exports = require('./CypherNG.js');

        // Re-export all modules
        module.exports.core = core;
        module.exports.structures = structures;
        module.exports.network = network;
        module.exports.query = query;
        module.exports.parser = parser;
    }
    // Browser: Modules are loaded via script tags and attach to global.CypherNG
})();
