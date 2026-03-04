/**
 * @fileoverview HTTP client for CypherNG.
 * Provides HTTP GET/POST methods using XMLHttpRequestFactory.
 */

/**
 * HTTP - HTTP client with GET/POST methods.
 *
 * @class
 * @memberof CypherNG.network
 */
function HTTP() {
    var XMLHttpRequestFactory = (typeof module !== 'undefined' && module.exports ?
        require('./XMLHttpRequestFactory.js').XMLHttpRequestFactory :
        CypherNG.network.XMLHttpRequestFactory);

    /**
     * Perform an HTTP GET request.
     *
     * @param {string} url - The URL to request
     * @param {Object} [headers={}] - Request headers
     * @param {Function} successCallback - Callback on success (receives response text)
     * @param {Function} errorCallback - Callback on error (receives Error object)
     * @returns {void}
     */
    this.get = function(url, headers, successCallback, errorCallback) {
        if (headers === undefined || headers === null) {
            headers = {};
        }
        const xhr = XMLHttpRequestFactory();
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    successCallback(xhr.responseText); // resolve with the response data
                } else {
                    errorCallback(new Error('Request failed with status ' + xhr.status));
                }
            }
        };
        try {
            xhr.open("GET", url, true);
            for (const key in headers) {
                if (headers.hasOwnProperty(key)) {
                    xhr.setRequestHeader(key, headers[key]);
                }
            }
            xhr.send();
        } catch (e) {
            errorCallback(e);
        }
    };

    /**
     * Perform an HTTP POST request.
     *
     * @param {string} url - The URL to request
     * @param {*} payload - The request payload (object or string)
     * @param {Object} [headers={}] - Request headers
     * @param {Function} successCallback - Callback on success (receives response text)
     * @param {Function} errorCallback - Callback on error (receives Error object)
     * @returns {void}
     */
    this.post = function(url, payload, headers, successCallback, errorCallback) {
        if (headers === undefined || headers === null) {
            headers = {};
        }
        const xhr = XMLHttpRequestFactory();
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    successCallback(xhr.responseText);
                } else {
                    errorCallback(new Error('Request failed with status ' + xhr.status));
                }
            }
        };
        try {
            xhr.open("POST", url, true);
            for (const key in headers) {
                if (headers.hasOwnProperty(key)) {
                    xhr.setRequestHeader(key, headers[key]);
                }
            }

            if (payload && payload.constructor === Object) {
                const encoded = new TextEncoder().encode(JSON.stringify(payload));
                xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                xhr.setRequestHeader("Content-Length", encoded.length);
                xhr.send(encoded);
            } else {
                xhr.send(payload);
            }
        } catch (e) {
            errorCallback(e);
        }
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.HTTP = HTTP;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).network = (this.CypherNG = this.CypherNG || {}).network || {});
