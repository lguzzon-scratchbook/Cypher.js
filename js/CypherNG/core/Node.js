/**
 * Node - Graph node entity
 * 
 * Represents a node in the graph with labels, properties, and relationships.
 * Supports pattern matching, property binding, and graph traversal.
 */
class Node {
  /**
   * @param {DB} db - Database instance
   */
  constructor(db) {
    /** @private */
    this._db = db;
    /** @private */
    this._id = null;
    /** @private @type {Object<string, boolean>} */
    this._labels = {};
    /** @private @type {Object<string, Function>} */
    this._propertyExpressions = {};
    /** @private @type {Object<string, *>} */
    this._properties = {};
    /** @private */
    this._variableKey = undefined;
    /** @private */
    this._referredNode = null;
    /** @private */
    this._expandedNode = null;
    /** @private */
    this._previousObject = null;
    /** @private */
    this._nextObject = null;
    /** @private */
    this._pattern = null;
    /** @private */
    this._expandedIsMatched = false;
    /** @private */
    this._matchedNode = null;
    /** @private @type {Object<number, number[]>} */
    this._matchedIncomingRelationshipIds = {};
  }

  // Navigation methods
  
  /**
   * Sets the previous object in the pattern chain
   * @param {Node|Relationship} object - Previous object
   */
  setPreviousObject(object) {
    this._previousObject = object;
  }

  /**
   * Gets the previous object in the pattern chain
   * @returns {Node|Relationship|null}
   */
  getPreviousObject() {
    return this._previousObject;
  }

  /**
   * Sets the next object in the pattern chain
   * @param {Node|Relationship} object - Next object
   */
  setNextObject(object) {
    this._nextObject = object;
  }

  /**
   * Gets the next object in the pattern chain
   * @returns {Node|Relationship|null}
   */
  getNextObject() {
    return this._nextObject;
  }

  /**
   * Sets the pattern this node belongs to
   * @param {Pattern} pattern - Parent pattern
   */
  setPattern(pattern) {
    this._pattern = pattern;
  }

  /**
   * Gets the pattern this node belongs to
   * @returns {Pattern|null}
   */
  getPattern() {
    return this._pattern;
  }

  /**
   * Gets the next node in the pattern (skipping relationships)
   * @returns {Node|null}
   */
  nextNode() {
    if (this._nextObject) {
      if (this._nextObject.isRelationship && this._nextObject.isRelationship()) {
        return this._nextObject.getNextObject ? this._nextObject.getNextObject() : null;
      } else if (this._nextObject.isNode && this._nextObject.isNode()) {
        return this._nextObject;
      }
    }
    return null;
  }

  /**
   * Gets the previous node in the pattern (skipping relationships)
   * @returns {Node|null}
   */
  previousNode() {
    if (this._previousObject) {
      if (this._previousObject.isRelationship && this._previousObject.isRelationship()) {
        return this._previousObject.getPreviousObject ? this._previousObject.getPreviousObject() : null;
      } else if (this._previousObject.isNode && this._previousObject.isNode()) {
        return this._previousObject;
      }
    }
    return null;
  }

  /**
   * Gets the incoming relationship
   * @returns {Relationship|null}
   */
  incomingRelationship() {
    if (this._previousObject && this._previousObject.isRelationship && this._previousObject.isRelationship()) {
      return this._previousObject;
    }
    return null;
  }

  /**
   * Gets the outgoing relationship
   * @returns {Relationship|null}
   */
  outgoingRelationship() {
    if (this._nextObject && this._nextObject.isRelationship && this._nextObject.isRelationship()) {
      return this._nextObject;
    }
    return null;
  }

  // Identity methods

  /**
   * Sets the node ID
   * @param {number} id - Node ID
   */
  setId(id) {
    this._id = id;
  }

  /**
   * Gets the node ID
   * @returns {number|null}
   */
  id() {
    return this._id;
  }

  /**
   * Alias for id()
   * @returns {number|null}
   */
  getId() {
    return this._id;
  }

  // Property methods

  /**
   * Sets a property with an expression that will be evaluated later
   * @param {string} key - Property key
   * @param {Object} expression - Expression object with a value() method
   */
  setProperty(key, expression) {
    this._properties[key] = null;
    this._propertyExpressions[key] = expression.value;
  }

  /**
   * Sets multiple properties directly
   * @param {Object} properties - Properties object
   */
  setProperties(properties) {
    for (const key in properties) {
      this._properties[key] = properties[key];
    }
  }

  /**
   * Binds a single property (evaluates its expression)
   * @param {string} key - Property key to bind
   */
  bindProperty(key) {
    if (this._propertyExpressions[key]) {
      this._properties[key] = this._propertyExpressions[key]();
    }
  }

  /**
   * Binds all properties (evaluates all expressions)
   */
  bindProperties() {
    for (const key in this._properties) {
      this.bindProperty(key);
    }
  }

  /**
   * Gets a local property value
   * @param {string} key - Property key
   * @returns {*}
   */
  getLocalProperty(key) {
    return this._properties[key] || null;
  }

  /**
   * Gets a property value from the matched node
   * @param {string} key - Property key
   * @returns {*}
   */
  getProperty(key) {
    const matchedNode = this.getData();
    if (!matchedNode) return null;
    return matchedNode.getLocalProperty(key);
  }

  /**
   * Gets all properties
   * @returns {Object}
   */
  getProperties() {
    return Object.create(this._properties);
  }

  /**
   * Gets raw properties object (for internal use)
   * @returns {Object}
   */
  getRawProperties() {
    return this._properties;
  }

  /**
   * Checks if node has properties
   * @returns {boolean}
   */
  hasProperties() {
    return Object.keys(this._properties).length > 0;
  }

  // Label methods

  /**
   * Sets a label on the node
   * @param {string} labelName - Label name
   * @param {number} nodeId - Node ID for lookup registration
   */
  setLabel(labelName, nodeId) {
    this._labels[labelName] = true;
    if (this._db && this._db._addLabelNodeIdLookup) {
      this._db._addLabelNodeIdLookup(labelName, nodeId);
    }
  }

  /**
   * Checks if node has a label
   * @param {string} labelName - Label name
   * @returns {boolean}
   */
  hasLabel(labelName) {
    return !!this._labels[labelName];
  }

  /**
   * Sets multiple labels
   * @param {Object<string, boolean>} labels - Labels object
   */
  setLabels(labels) {
    for (const label in labels) {
      this._labels[label] = labels[label];
    }
  }

  /**
   * Gets all labels as an object
   * @returns {Object<string, boolean>}
   */
  labels() {
    return this._labels;
  }

  /**
   * Gets all labels as an array
   * @returns {string[]}
   */
  getLabels() {
    return Object.keys(this._labels);
  }

  /**
   * Checks if node has any labels
   * @returns {boolean}
   */
  hasLabels() {
    return Object.keys(this._labels).length > 0;
  }

  // Variable methods

  /**
   * Sets the variable key for this node
   * @param {string} key - Variable key
   */
  setVariableKey(key) {
    this._variableKey = key;
  }

  /**
   * Gets the variable key
   * @returns {string|undefined}
   */
  getVariableKey() {
    return this._variableKey;
  }

  /**
   * Checks if this node has a variable key
   * @returns {boolean}
   */
  hasVariableKey() {
    return this._variableKey !== undefined;
  }

  // Type checking

  /**
   * Checks if this is a relationship (always false for Node)
   * @returns {boolean}
   */
  isRelationship() {
    return false;
  }

  /**
   * Checks if this is a node (always true for Node)
   * @returns {boolean}
   */
  isNode() {
    return true;
  }

  /**
   * Gets the type name
   * @returns {string}
   */
  type() {
    return this.constructor.name;
  }

  // Reference and expansion methods

  /**
   * Sets the referred node (for pattern matching)
   * @param {*} referredNode - Referred node
   */
  setReferredNode(referredNode) {
    this._referredNode = referredNode;
  }

  /**
   * Checks if this node refers to another
   * @returns {boolean}
   */
  isReferred() {
    return this._referredNode !== null;
  }

  /**
   * Gets the referred node
   * @returns {*}
   */
  getReferredNode() {
    return this._referredNode;
  }

  /**
   * Sets the expanded node (for path expansion)
   * @param {Node} expandedNode - Expanded node
   */
  setExpandedNode(expandedNode) {
    this._expandedNode = expandedNode;
  }

  /**
   * Checks if this node is expanded
   * @returns {boolean}
   */
  isExpanded() {
    return this._expandedNode !== null;
  }

  /**
   * Gets the expanded node
   * @returns {Node|null}
   */
  getExpandedNode() {
    return this._expandedNode;
  }

  /**
   * Marks expanded as matched
   */
  setExpandedIsMatched() {
    this._expandedIsMatched = true;
  }

  /**
   * Checks and resets expanded matched flag
   * @returns {boolean}
   */
  expandedIsMatched() {
    if (this._expandedIsMatched) {
      this._expandedIsMatched = false;
      return true;
    }
    return false;
  }

  // Data and serialization

  /**
   * Gets a reference to this node
   * @param {boolean} asKey - If true, returns ID only
   * @returns {NodeReference|number}
   */
  get(asKey) {
    if (asKey) {
      return this._id;
    }
    // Return NodeReference for external access
    const NodeReference = require('./NodeReference.js').NodeReference;
    return new NodeReference(this._db, this._id);
  }

  /**
   * Converts to a plain object
   * @returns {Object}
   */
  toObject() {
    const self = this;
    return {
      id: this._id,
      labels: this.getLabels(),
      properties: this._addAssociativeArrayFunctions(this._properties),
      getProperty: function(key) { return self._properties[key]; },
      getProperties: function() { return this.properties; },
      getLabels: function() { return this.labels; },
      getKeys: function() {
        return Object.keys(this.properties);
      }
    };
  }

  /**
   * Converts to string representation
   * @returns {string}
   */
  toString() {
    return JSON.stringify(this.get());
  }

  /**
   * Gets the matched node data
   * @returns {Node|null}
   */
  getData() {
    if (!this._db) return null;
    return this._db.getNodeById ? this._db.getNodeById(this._matchedNode) : null;
  }

  /**
   * Gets the matched node (alias for getData)
   * @returns {Node|null}
   */
  getMatchedNode() {
    return this.getData();
  }

  // Pattern execution methods

  /**
   * Default next action (no-op)
   */
  nextAction() {
    // No-op
  }

  /**
   * Sets the next action function
   * @param {Function} f - Action function
   */
  setNextAction(f) {
    this.nextAction = f;
  }

  /**
   * Conveys this node through the pattern matching pipeline
   * @param {boolean} merge - Whether this is a merge operation
   * @param {number} pathExpansionDepth - Current path expansion depth
   * @returns {*}
   */
  convey(merge, pathExpansionDepth) {
    if (this._db && this._db.matchNode) {
      return this._db.matchNode(this, merge, pathExpansionDepth);
    }
    return null;
  }

  /**
   * Creates this node in the database
   * @returns {*}
   */
  create() {
    if (this._db && this._db.createNode) {
      return this._db.createNode(this);
    }
    return null;
  }

  /**
   * Matches this node in the database
   * @returns {*}
   */
  match() {
    if (this._db && this._db.matchNode) {
      return this._db.matchNode(this, false, 0);
    }
    return null;
  }

  // Matched data tracking

  /**
   * Adds a matched node
   * @param {Node} node - Matched node
   */
  addMatchedNode(node) {
    this._matchedNode = node.id();
  }

  /**
   * Adds a matched incoming relationship ID
   * @param {number} nodeId - Node ID
   * @param {number} relationshipId - Relationship ID
   */
  addMatchedIncomingRelationshipId(nodeId, relationshipId) {
    if (!this._matchedIncomingRelationshipIds[nodeId]) {
      this._matchedIncomingRelationshipIds[nodeId] = [];
    }
    this._matchedIncomingRelationshipIds[nodeId].push(relationshipId);
  }

  /**
   * Gets matched incoming relationship IDs
   * @param {number} nodeId - Node ID
   * @returns {number[]|null}
   */
  getMatchedIncomingRelationshipIds(nodeId) {
    if (!this._matchedIncomingRelationshipIds[nodeId]) {
      return null;
    }
    const ids = this._matchedIncomingRelationshipIds[nodeId];
    this._matchedIncomingRelationshipIds[nodeId] = [];
    return ids;
  }

  // Grouping methods

  /**
   * Gets the group by key
   * @returns {number}
   */
  groupByKey() {
    const data = this.getData();
    return data ? data.id() : this._id;
  }

  /**
   * Gets the group by value
   * @returns {*}
   */
  groupByValue() {
    const data = this.getData();
    return data ? data.get() : this;
  }

  // Copy and mapping

  /**
   * Creates a copy of this node
   * @returns {Node}
   */
  copy() {
    const n = new Node(this._db);
    n.setLabels(this._labels);
    n.setProperties(this._properties);
    return n;
  }

  /**
   * Checks if this node is mappable (all expressions are resolved)
   * @returns {boolean}
   */
  mappable() {
    if (this._referredNode) {
      if (this._referredNode.mappable && !this._referredNode.mappable()) {
        return false;
      }
    }
    for (const propertyKey in this._properties) {
      if (this._propertyExpressions[propertyKey] && 
          this._propertyExpressions[propertyKey].mappable && 
          !this._propertyExpressions[propertyKey].mappable()) {
        return false;
      }
    }
    return true;
  }

  /**
   * @private
   * Adds associative array helper functions
   */
  _addAssociativeArrayFunctions(obj) {
    const result = { ...obj };
    result.getKeys = function() { return Object.keys(this); };
    return result;
  }
}

module.exports = { Node };
