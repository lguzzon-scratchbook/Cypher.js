/**
 * @fileoverview Network module exports for CypherNG.
 * Re-exports all network layer components.
 */

(function(global) {
    // Initialize global namespace
    if (typeof global.CypherNG === 'undefined') {
        global.CypherNG = {};
    }

    var network = global.CypherNG.network = global.CypherNG.network || {};

    network.XMLHttpRequestFactory = require('./XMLHttpRequestFactory.js').XMLHttpRequestFactory;
    network.HTTP = require('./HTTP.js').HTTP;
    network.http = new network.HTTP();

})(typeof global !== 'undefined' ? global : (this || {}));

if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.CypherNG.network;
}
