/**
 * @fileoverview Utility exports for CypherNG
 *
 * Provides utility classes like StringRecoder for efficient string encoding.
 *
 * @module CypherNG/utils
 *
 * @example
 * const { StringRecoder } = require('./utils');
 *
 * // Use string recoder for memory optimization
 * const recoder = new StringRecoder();
 * const encoded = recoder.recode('user@example.com');
 */

const StringRecoder = require('./StringRecoder');

/**
 * Utils module exports
 * @namespace utils
 */
module.exports = {
    /** @type {StringRecoder} */
    StringRecoder
};