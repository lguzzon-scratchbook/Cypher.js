/**
 * NodeReference - Reference to a node in the database
 * 
 * Provides a lightweight reference to a node that can be used
 * for lazy loading and graph traversal.
 */
class NodeReference {
  /**
   * @param {DB} db - Database instance
   * @param {number} nodeId - Node ID
   */
  constructor(db, nodeId) {
    /** @private */
    this._db = db;
    /** @private */
    this._nodeId = nodeId;
  }

  /**
   * Gets the node ID
   * @returns {number}
   */
  nodeId() {
    return this._nodeId;
  }

  /**
   * Alias for nodeId()
   * @returns {number}
   */
  id() {
    return this._nodeId;
  }

  /**
   * Gets the actual Node instance
   * @returns {Node|null}
   */
  getNode() {
    if (!this._db || !this._db.getNodeById) return null;
    return this._db.getNodeById(this._nodeId);
  }

  /**
   * Gets the underlying object
   * @returns {Node|null}
   */
  getObject() {
    return this.getNode();
  }

  /**
   * Gets the node value as an object
   * @returns {Object|null}
   */
  value() {
    const node = this.getNode();
    return node ? node.toObject() : null;
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
    const node = this.getNode();
    return node ? node.getLocalProperty(propertyKey) : null;
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
   * Gets all labels
   * @returns {string[]|null}
   */
  getLabels() {
    const val = this.value();
    return val ? val.labels : null;
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
   * Gets the group by key (for aggregation)
   * @returns {number}
   */
  groupByKey() {
    return this._nodeId;
  }
}

module.exports = { NodeReference };
