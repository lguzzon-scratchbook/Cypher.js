/**
 * @fileoverview Network Layer Module for CypherNG
 * Provides HTTP client functionality for loading external data (CSV, JSON, TEXT)
 * @module network
 * 
 * This module provides cross-environment HTTP support for browser and Node.js
 * used by the Load operation in the Query Layer.
 */

// Lazy-loaded require for Node.js modules (avoids issues in browser)
let http, urlLib;

/**
 * XMLHttpRequestFactory creates appropriate HTTP request objects
 * for browser or Node.js environments
 * @constructor
 * @returns {XMLHttpRequest|Object} HTTP request object
 */
function XMLHttpRequestFactory() {
    try {
        return new XMLHttpRequest();
    } catch(e) {
        // Fall through to Node.js implementation
    }
    
    // Node.js fallback implementation
    return new (function() {
        // Status constants
        this.UNSENT = 0;
        this.OPENED = 1;
        this.HEADERS_RECEIVED = 2;
        this.LOADING = 3;
        this.DONE = 4;
        
        // State
        this.readyState = this.UNSENT;
        this.status = null;
        this.responseText = null;
        this.response = null;
        this.responseType = null;
        this.method = null;
        this.url = null;
        this.async = true;
        this.headers = {};
        
        // Callbacks
        this.onreadystatechange = function() {};
        this.onload = function() {};

        /**
         * Set a request header
         * @param {string} header - Header name
         * @param {string} value - Header value
         */
        this.setRequestHeader = function(header, value) {
            this.headers[header] = value;
        };

        /**
         * Open the request connection
         * @param {string} method - HTTP method (GET, POST, etc.)
         * @param {string} url - Target URL
         * @param {boolean} async - Whether to use async mode
         */
        this.open = function(method, url, async) {
            this.method = method.toUpperCase();
            this.url = url;
            this.async = async;
            this.readyState = this.OPENED;
        };

        /**
         * Send the HTTP request
         * @param {string|null} payload - Request body for POST requests
         */
        this.send = function(payload) {
            // Lazy-load Node.js modules
            if (!http) {
                const ssl_url = (this.url.indexOf("https") == 0);
                try {
                    http = ssl_url ? require('https') : require('http');
                    urlLib = require('url');
                } catch(e) {
                    // Module not available
                }
            }

            const me = this;
            const processResponse = function(resp) {
                let data = '';
                resp.on('data', function(chunk) { 
                    data += chunk; 
                });
                resp.on('end', function() {
                    me.responseText = data;
                    me.response = data;
                    me.readyState = me.DONE;
                    if(resp.statusCode >= 200 && resp.statusCode < 300) {
                        me.status = 200;
                    } else {
                        me.status = resp.statusCode;
                    }
                    me.onreadystatechange();
                    me.onload();
                });
            };

            const handleError = function(err) {
                console.log("Error: " + err);
                me.status = 0;
                me.onreadystatechange();
            };

            if (http && urlLib) {
                const parsedUrl = new urlLib.URL(this.url);
                const options = {
                    hostname: parsedUrl.hostname,
                    port: (parsedUrl.port ? parsedUrl.port : (this.url.indexOf("https") == 0 ? 443 : 80)),
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: this.method
                };
                if(this.headers) options["headers"] = this.headers;
                
                const request = http.request(options, processResponse);
                request.on("error", handleError);
                if(payload) request.write(payload);
                request.end();
            } else {
                // No HTTP library available
                me.status = 0;
                me.onreadystatechange();
            }
        };
    });
}

/**
 * HTTP client wrapper providing get and post methods
 * @constructor
 */
function HTTP() {
    /**
     * Perform HTTP GET request
     * @param {string} url - Target URL
     * @param {Object} headers - Request headers
     * @param {Function} successCallback - Success callback
     * @param {Function} errorCallback - Error callback
     */
    this.get = function(url, headers, successCallback, errorCallback) {
        if(!headers) headers = {};
        const xhr = XMLHttpRequestFactory();
        xhr.onreadystatechange = function() {
            if(xhr.readyState === 4) {
                if(xhr.status >= 200 && xhr.status < 300) {
                    successCallback(xhr.responseText);
                } else {
                    errorCallback(new Error('Request failed with status ' + xhr.status));
                }
            }
        };
        try {
            xhr.open("GET", url, true);
            for(const key in headers) {
                if(headers.hasOwnProperty(key)) xhr.setRequestHeader(key, headers[key]);
            }
            xhr.send();
        } catch(e) { errorCallback(e); }
    };

    /**
     * Perform HTTP POST request
     * @param {string} url - Target URL
     * @param {string|Object} payload - Request body
     * @param {Object} headers - Request headers
     * @param {Function} successCallback - Success callback
     * @param {Function} errorCallback - Error callback
     */
    this.post = function(url, payload, headers, successCallback, errorCallback) {
        if(!headers) headers = {};
        const xhr = XMLHttpRequestFactory();
        xhr.onreadystatechange = function() {
            if(xhr.readyState === 4) {
                if(xhr.status >= 200 && xhr.status < 300) successCallback(xhr.responseText);
                else errorCallback(new Error('Request failed with status ' + xhr.status));
            }
        };
        try {
            xhr.open("POST", url, true);
            for(const key in headers) {
                if(headers.hasOwnProperty(key)) xhr.setRequestHeader(key, headers[key]);
            }
            if(payload && payload.constructor === Object) {
                const encoded = new TextEncoder().encode(JSON.stringify(payload));
                xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                xhr.setRequestHeader("Content-Length", encoded.length);
                xhr.send(encoded);
            } else {
                xhr.send(payload);
            }
        } catch(e) { errorCallback(e); }
    };
}

// Export for ES6 modules
export { XMLHttpRequestFactory, HTTP };