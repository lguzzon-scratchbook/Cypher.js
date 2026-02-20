/**
 * @fileoverview Modular ES6+ Index for CypherNG
 * @description This module provides ES6 exports while maintaining backward compatibility with the original Cypher.js API.
 * @module cypher-ng
 * @version 1.0.0
 * @license GPL-3.0-or-later
 */

// Re-export utilities
export {
  addArrayFunctions,
  addAssociativeArrayFunctions,
  clean,
  createNodeReference,
  createRelationshipReference,
  NodeReference,
  printStackTrace,
  RelationshipReference,
} from "./01-utilities.js"

// Re-export data layer
export {
  IDFactory,
  Matcher,
  Pattern,
  PatternNode,
  PatternRelationship,
  StoredNode,
  StoredRelationship,
  StringRecoder,
} from "./02-data.js"

// Re-export database
export { DB } from "./02b-database.js"

// The following will be populated as we create more modules
// For now, we provide a compatibility layer to the original CypherNG

/**
 * CypherNG Compatibility Layer
 * Provides backward compatible access to the CypherNG engine
 */
class CypherNGCompat {
  constructor() {
    // Will be initialized lazily
    this._engine = null
    this._CypherNG = null
  }

  _getEngine() {
    if (!this._engine) {
      // Dynamically require to avoid circular dependencies
      const CypherNG = require("../CypherNG.js")
      this._CypherNG = CypherNG
      this._engine = new CypherNG()
    }
    return this._engine
  }

  execute(statementText, successCallback, errorCallback) {
    return this._getEngine().execute(
      statementText,
      successCallback,
      errorCallback,
    )
  }

  addGraph(nodes, edges) {
    return this._getEngine().addGraph(nodes, edges)
  }

  resetDataBase() {
    return this._getEngine().resetDataBase()
  }

  setDataDownloadProxy(proxy) {
    return this._getEngine().setDataDownloadProxy(proxy)
  }

  getDataDownloadProxy() {
    return this._getEngine().getDataDownloadProxy()
  }

  db() {
    return this._getEngine().db()
  }
}

// Export compatibility class
export { CypherNGCompat }

// Factory function for creating new CypherNG engine instances
export function createEngine() {
  return new CypherNGCompat()
}
