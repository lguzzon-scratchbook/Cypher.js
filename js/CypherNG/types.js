/**
 * @fileoverview Pattern type definitions for CypherNG.
 * Provides JSDoc type definitions for core CypherNG types.
 */

/**
 * @namespace CypherNG
 * @description CypherNG - A modular refactoring of Cypher.js
 */

/**
 * @namespace CypherNG.core
 * @description Core data layer modules
 */

/**
 * @namespace CypherNG.structures
 * @description Data structures and utilities
 */

/**
 * @namespace CypherNG.network
 * @description Network/HTTP utilities
 */

/**
 * @namespace CypherNG.query
 * @description Query layer modules
 */

/**
 * @namespace CypherNG.parser
 * @description Parser layer modules
 */

/**
 * @typedef {Object} Node
 * @memberof CypherNG.core
 * @description Represents a graph node with properties and labels
 */

/**
 * @typedef {Object} Relationship
 * @memberof CypherNG.core
 * @description Represents a graph relationship with properties, type, and direction
 */

/**
 * @typedef {Object} Pattern
 * @memberof CypherNG.core
 * @description Represents a graph pattern (sequence of nodes and relationships)
 */

/**
 * @typedef {Object} DB
 * @memberof CypherNG.core
 * @description Database class managing nodes, relationships, and indexes
 */

/**
 * @typedef {Object} NodeReference
 * @memberof CypherNG.core
 * @description Reference to a node in the database
 */

/**
 * @typedef {Object} RelationshipReference
 * @memberof CypherNG.core
 * @description Reference to a relationship in the database
 */

/**
 * @typedef {Object} Matcher
 * @memberof CypherNG.core
 * @description Utility for matching patterns against database entities
 */

/**
 * @typedef {Object} Expression
 * @memberof CypherNG.query
 * @description Query expression with aggregation support
 */

/**
 * @typedef {Object} Statement
 * @memberof CypherNG.query
 * @description Query statement container
 */

/**
 * @typedef {Object} Parser
 * @memberof CypherNG.parser
 * @description Cypher query parser
 */

/**
 * @typedef {Object} XMLHttpRequestFactory
 * @memberof CypherNG.network
 * @description Cross-environment XHR factory (browser/Node.js)
 */

/**
 * @typedef {Object} HTTP
 * @memberof CypherNG.network
 * @description HTTP client with GET/POST methods
 */

/**
 * @typedef {Object} xhr
 * @memberof CypherNG.network
 * @description XHR instance with cross-environment support
 * @property {number} UNSENT - Ready state 0
 * @property {number} OPENED - Ready state 1
 * @property {number} HEADERS_RECEIVED - Ready state 2
 * @property {number} LOADING - Ready state 3
 * @property {number} DONE - Ready state 4
 * @property {number} readyState - Current ready state
 * @property {number} status - HTTP status code
 * @property {string} responseText - Response text
 * @property {*} response - Response data
 * @property {string} responseType - Response type
 * @property {string} method - HTTP method
 * @property {string} url - Request URL
 * @property {boolean} async - Async flag
 * @property {Object} headers - Request headers
 * @property {Function} onreadystatechange - Ready state change handler
 * @property {Function} onload - Load handler
 * @property {Function} setRequestMethod - Set request header
 * @property {Function} open - Open request
 * @property {Function} send - Send request
 */
