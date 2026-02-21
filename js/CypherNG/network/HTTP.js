/**
 * HTTP - Cross-platform HTTP client
 * 
 * Works in both browser (XMLHttpRequest) and Node.js (http/https modules).
 */
class HTTP {
  constructor() {
    // Detect environment
    this._isNode = typeof window === 'undefined';
  }

  /**
   * Creates an XMLHttpRequest-like object
   * Works in both browser and Node.js
   * @private
   * @returns {XMLHttpRequest|Object}
   */
  _createXHR() {
    if (!this._isNode) {
      // Browser environment
      try {
        return new XMLHttpRequest();
      } catch (e) {
        // Fall through to Node implementation
      }
    }

    // Node.js environment - return XHR-compatible wrapper
    return new NodeXHR();
  }

  /**
   * Performs a GET request
   * @param {string} url - URL to request
   * @param {Object} [headers={}] - Request headers
   * @param {Function} successCallback - Success callback
   * @param {Function} errorCallback - Error callback
   */
  get(url, headers = {}, successCallback, errorCallback) {
    const xhr = this._createXHR();
    
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          successCallback(xhr.responseText);
        } else {
          errorCallback(new Error(`Request failed with status ${xhr.status}`));
        }
      }
    };

    try {
      xhr.open('GET', url, true);
      for (const key in headers) {
        if (headers.hasOwnProperty(key)) {
          xhr.setRequestHeader(key, headers[key]);
        }
      }
      xhr.send();
    } catch (e) {
      errorCallback(e);
    }
  }

  /**
   * Performs a POST request
   * @param {string} url - URL to request
   * @param {*} payload - Request body
   * @param {Object} [headers={}] - Request headers
   * @param {Function} successCallback - Success callback
   * @param {Function} errorCallback - Error callback
   */
  post(url, payload, headers = {}, successCallback, errorCallback) {
    const xhr = this._createXHR();
    
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          successCallback(xhr.responseText);
        } else {
          errorCallback(new Error(`Request failed with status ${xhr.status}`));
        }
      }
    };

    try {
      xhr.open('POST', url, true);
      for (const key in headers) {
        if (headers.hasOwnProperty(key)) {
          xhr.setRequestHeader(key, headers[key]);
        }
      }

      if (payload && payload.constructor === Object) {
        const encoded = new TextEncoder().encode(JSON.stringify(payload));
        xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
        xhr.setRequestHeader('Content-Length', encoded.length);
        xhr.send(encoded);
      } else {
        xhr.send(payload);
      }
    } catch (e) {
      errorCallback(e);
    }
  }
}

/**
 * NodeXHR - XMLHttpRequest-compatible wrapper for Node.js
 * @private
 */
class NodeXHR {
  constructor() {
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

    this._method = null;
    this._url = null;
    this._async = true;
    this._headers = {};

    this.onreadystatechange = function() {};
    this.onload = function() {};
  }

  setRequestHeader(header, value) {
    this._headers[header] = value;
  }

  open(method, url, async) {
    this._method = method.toUpperCase();
    this._url = url;
    this._async = async !== false;
    this.readyState = this.OPENED;
  }

  send(payload) {
    const isHttps = this._url.indexOf('https') === 0;
    
    // Dynamic require for Node.js
    const http = isHttps ? require('https') : require('http');
    const urlLib = require('url');

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
        
        if (resp.statusCode >= 200 && resp.statusCode < 300) {
          me.status = 200;
        } else {
          me.status = resp.statusCode;
        }
        
        me.onreadystatechange();
        me.onload();
      });
    };

    const handleError = function(err) {
      me.status = 0;
      me.readyState = me.DONE;
      me.onreadystatechange();
    };

    const parsedUrl = new urlLib.URL(this._url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: this._method,
      headers: this._headers
    };

    const request = http.request(options, processResponse);
    request.on('error', handleError);
    
    if (payload) {
      request.write(payload);
    }
    
    request.end();
  }
}

module.exports = { HTTP };
