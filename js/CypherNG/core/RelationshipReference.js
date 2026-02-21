/**
 * RelationshipReference - Reference to a relationship in the database
 * 
 * Provides a lightweight reference to a relationship that can be used
 * for lazy loading and graph traversal.
 */
class RelationshipReference {
  /**
   * @param {DB} db - Database instance
   * @param {number} relationshipId - Relationship ID
   */
  constructor(db, relationshipId) {
    /** @private */
    this._db = db;
    /** @private */
    this._relationshipId = relationshipId;
  }

  /**
   * Gets the relationship ID
   * @returns {number}
   */
  relationshipId() {
    return this._relationshipId;
  }

  /**
   * Alias for relationshipId()
   * @returns {number}
   */
  id() {
    return this._relationshipId;
  }

  /**
   * Gets the actual Relationship instance
   * @returns {Relationship|null}
   */
  getRelationship() {
    if (!this._db || !this._db.getRelationshipById) return null;
    return this._db.getRelationshipById(this._relationshipId);
  }

  /**
   * Gets the underlying object
   * @returns {Relationship|null}
   */
  getObject() {
    return this.getRelationship();
  }

  /**
   * Gets the relationship value as an object
   * @returns {Object|null}
   */
  value() {
    const rel = this.getRelationship();
    return rel ? rel.toObject() : null;
  }

  /**
   * Gets the start node of this relationship
   * @returns {NodeReference|null}
   */
  startNode() {
    const rel = this.getRelationship();
    if (!rel || !rel.getFromNode) return null;
    const fromNode = rel.getFromNode();
    return fromNode ? fromNode.get() : null;
  }

  /**
   * Gets the end node of this relationship
   * @returns {NodeReference|null}
   */
  endNode() {
    const rel = this.getRelationship();
    if (!rel || !rel.getToNode) return null;
    const toNode = rel.getToNode();
    return toNode ? toNode.get() : null;
  }

  /**
   * Alias for value()
   * @returns {Object|null}
   */
  getData() {
    return this.value();
  }

  /**
   * Gets a property value
   * @param {string} propertyKey - Property key
   * @returns {*}
   */
  getProperty(propertyKey) {
    const rel = this.getRelationship();
    return rel ? rel.getLocalProperty(propertyKey) : null;
  }

  /**
   * Gets all properties
   * @returns {Object|null}
   */
  getProperties() {
    const val = this.value();
    return val ? val.properties : null;
  }

  /**
   * Gets all property keys
   * @returns {string[]|null}
   */
  getKeys() {
    const val = this.value();
    return val ? val.getKeys() : null;
  }

  /**
   * Gets the relationship type
   * @returns {string|null}
   */
  getType() {
    const val = this.value();
    return val ? val.type : null;
  }

  /**
   * Gets the group by key (for aggregation)
   * @returns {number}
   */
  groupByKey() {
    return this._relationshipId;
  }
}

module.exports = { RelationshipReference };
