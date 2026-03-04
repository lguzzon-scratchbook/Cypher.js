/**
 * @fileoverview XMLHttpRequestFactory for CypherNG.
 * Provides cross-environment XHR factory (browser/Node.js).
 */

/**
 * XMLHttpRequestFactory - Creates XHR instances for both browser and Node.js environments.
 *
 * @class
 * @memberof CypherNG.network
 * @returns {XMLHttpRequest|Object} XHR instance compatible with both environments
 */
function XMLHttpRequestFactory() {
    try {
        // Web browser
        return new XMLHttpRequest();
    } catch(e) {
        ;
    }
    // Node.js below
    return new (function() {

        // readyStates
        this.UNSENT = 0;
        this.OPENED = 1;
        this.HEADERS_RECEIVED = 2;
        this.LOADING = 3;
        this.DONE = 4;

        this.readyState = this.UNSENT;
        this.status = null;
        this.responseText = null;
        this.response = null;
        this.responseType = null;

        this.method = null;
        this.url = null;
        this.async = true;

        this.headers = {};

        this.onreadystatechange = function() {};
        this.onload = function() {};

        /**
         * Set a request header.
         * @param {string} header - The header name
         * @param {string} value - The header value
         */
        this.setRequestHeader = function(header, value) {
            this.headers[header] = value;
        };

        /**
         * Open a request.
         * @param {string} method - The HTTP method (GET, POST, etc.)
         * @param {string} url - The URL to request
         * @param {boolean} [async=true] - Whether the request should be async
         */
        this.open = function(method, url, async) {

            this.method = method.toUpperCase();
            this.url = url;
            this.async = async;

            this.readyState = this.OPENED;

        };

        /**
         * Send the request.
         * @param {*} [payload] - The request payload (optional)
         */
        this.send = function(payload) {
            var response = null;

            var http = null;
            var urlLib = null;
            var ssl_url = (this.url.indexOf("https") == 0 ? true : false);

            try {
                http = (ssl_url ? require('https') : require('http'));
                urlLib = require('url');
            } catch(e) {
                ;
            }

            var me = this;

            var processResponse = function(resp) {
                var data = '';

                // A chunk of data has been received.
                resp.on('data', function(chunk) {
                    data += chunk;
                });

                // The whole response has been received. Print out the result.
                resp.on('end', function() {
                    me.responseText = data;
                    me.response = data;

                    me.readyState = me.DONE;
                    if(resp.statusCode >= 200 && resp.statusCode < 300) {
                        me.status = 200;
                        me.onreadystatechange();
                        me.onload();
                    } else {
                        me.status = resp.statusCode;
                        me.onreadystatechange();
                        me.onload();
                    }
                });

            };

            var handleError = function(err) {
                console.log("Error: " + err);
                me.status = 0;
                me.onreadystatechange();
            };

            var parsedUrl = new urlLib.URL(this.url);
            var options = {
                hostname: parsedUrl.hostname,
                port: (parsedUrl.port ? parsedUrl.port : (ssl_url ? 443 : 80)),
                path: parsedUrl.pathname + parsedUrl.search,
                method: this.method
            };
            if(this.headers) {
                options["headers"] = this.headers;
            }
            var request = http.request(options, processResponse);
            request.on("error", handleError);
            if(payload) {
                request.write(payload);
            }
            request.end();
        };

    });
}

// Export for both browser and Node.js
(function(exports) {
    exports.XMLHttpRequestFactory = XMLHttpRequestFactory;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).network = (this.CypherNG = this.CypherNG || {}).network || {});
