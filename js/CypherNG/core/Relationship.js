/**
 * Relationship - Graph relationship entity
 * 
 * Represents a relationship (edge) between two nodes in the graph.
 * Supports directed relationships, properties, and variable-length paths.
 */
class Relationship {
  /**
   * @param {DB} db - Database instance
   */
  constructor(db) {
    /** @private */
    this._db = db;
    /** @private */
    this._id = null;
    /** @private */
    this._relationshipType = null;
    /** @private @type {Object<string, *>} */
    this._properties = {};
    /** @private @type {Object<string, Function>} */
    this._propertyExpressions = {};
    /** @private */
    this._fromNode = null;
    /** @private */
    this._toNode = null;
    /** @private */
    this._leftDirection = false;
    /** @private */
    this._rightDirection = false;
    /** @private */
    this._variableKey = undefined;
    /** @private */
    this._previousObject = null;
    /** @private */
    this._nextObject = null;
    /** @private */
    this._isAdded = false;
    /** @private */
    this._hasVariablePathLength = false;
    /** @private */
    this._pathLengthFrom = 1;
    /** @private */
    this._pathLengthTo = 1;
    /** @private */
    this._pattern = null;
    /** @private */
    this._referredRelationship = null;
    /** @private */
    this._matchedRelationship = null;
    /** @private */
    this._expandedPath = [];
    /** @private */
    this._pathList = [];
    /** @private */
    this._visitedNodes = {};
    /** @private */
    this._matchingRelationshipsIds = null;
    /** @private */
    this._expandedEndNode = null;
  }

  // Navigation methods

  setPreviousObject(object) {
    this._previousObject = object;
  }

  getPreviousObject() {
    return this._previousObject;
  }

  setNextObject(object) {
    this._nextObject = object;
  }

  getNextObject() {
    return this._nextObject;
  }

  setPattern(pattern) {
    this._pattern = pattern;
  }

  getPattern() {
    return this._pattern;
  }

  // Identity methods

  setId(id) {
    this._id = id;
  }

  id() {
    return this._id;
  }

  // Type methods

  setStoredType(type) {
    this._relationshipType = type;
  }

  setType(type, relationshipId) {
    this._relationshipType = type;
  }

  getType() {
    return this._relationshipType;
  }

  // Property methods

  setProperty(key, expression) {
    this._properties[key] = null;
    this._propertyExpressions[key] = expression.value.bind(expression);
  }

  bindProperty(key) {
    if (this._propertyExpressions[key]) {
      this._properties[key] = this._propertyExpressions[key]();
    }
  }

  bindProperties() {
    for (const key in this._properties) {
      this.bindProperty(key);
    }
  }

  setProperties(properties) {
    for (const key in properties) {
      this._properties[key] = properties[key];
    }
  }

  getProperty(key) {
    return this._properties[key];
  }

  getProperties() {
    return this._properties;
  }

  getRelationshipProperties() {
    return this._properties;
  }

  getLocalProperty(key) {
    return this._properties[key] || null;
  }

  // Node connection methods

  setFromNode(node) {
    this._fromNode = node;
  }

  setToNode(node) {
    this._toNode = node;
  }

  getFromNode(fromNodeId) {
    if (fromNodeId !== undefined && fromNodeId !== this._fromNode.id()) {
      return this._toNode;
    }
    return this._fromNode;
  }

  getToNode(fromNodeId) {
    if (fromNodeId !== undefined && fromNodeId !== this._fromNode.id()) {
      return this._fromNode;
    }
    return this._toNode;
  }

  // Direction methods

  setLeftDirection(leftDirection) {
    this._leftDirection = leftDirection;
  }

  setRightDirection(rightDirection) {
    this._rightDirection = rightDirection;
  }

  leftDirection(fromNodeId) {
    if (fromNodeId !== undefined && this._fromNode && fromNodeId !== this._fromNode.id()) {
      return !this._leftDirection && this._rightDirection;
    }
    return this._leftDirection && !this._rightDirection;
  }

  rightDirection(fromNodeId) {
    if (fromNodeId !== undefined && this._fromNode && fromNodeId !== this._fromNode.id()) {
      return !this._rightDirection && this._leftDirection;
    }
    return this._rightDirection && !this._leftDirection;
  }

  uniDirectional() {
    return (this._rightDirection && this._leftDirection) || 
           (!this._leftDirection && !this._rightDirection);
  }

  noDirection() {
    return !this._leftDirection && !this._rightDirection;
  }

  direction() {
    const l = this.leftDirection();
    const r = this.rightDirection();
    if (l && !r) return 'left';
    if (!l && r) return 'right';
    if (l && r) return 'both';
    return 'none';
  }

  // Type checking

  isRelationship() {
    return true;
  }

  isNode() {
    return false;
  }

  type() {
    return this.constructor.name;
  }

  // Reference methods

  setReferredRelationship(referredRelationship) {
    this._referredRelationship = referredRelationship;
  }

  isReferred() {
    return this._referredRelationship !== null;
  }

  getReferredRelationship() {
    return this._referredRelationship;
  }

  // State methods

  isAdded() {
    return this._isAdded;
  }

  setIsAdded() {
    this._isAdded = true;
  }

  // Variable path length methods

  setHasVariablePathLength() {
    this._hasVariablePathLength = true;
    this._pathLengthFrom = null;
    this._pathLengthTo = null;
  }

  hasVariablePathLength() {
    return this._hasVariablePathLength;
  }

  setPathLengthFrom(pathLengthFrom) {
    this._pathLengthFrom = pathLengthFrom;
  }

  pathLengthFrom() {
    return this._pathLengthFrom;
  }

  setPathLengthTo(pathLengthTo) {
    this._pathLengthTo = pathLengthTo;
  }

  pathLengthTo() {
    return this._pathLengthTo;
  }

  expandPath() {
    return this._hasVariablePathLength;
  }

  // Path expansion tracking

  visitedBefore(nodeId) {
    if (this._expandedPath.length > 1) {
      if (this._expandedPath[this._expandedPath.length - 1] === this._expandedPath[this._expandedPath.length - 2]) {
        return true;
      }
    }
    return (this._visitedNodes[nodeId] || 0) >= 2;
  }

  setMatchedRelationship(relationship) {
    this._matchedRelationship = relationship.id();
  }

  addMatchedRelationship(relationship, path) {
    if (this._hasVariablePathLength) {
      this._expandedPath.push(relationship.id());
      this._pathList.push(path);
      this._updateVisitedRelationships(path);
    } else {
      this.setMatchedRelationship(relationship);
    }
  }

  _updateVisitedRelationships(path) {
    if (this._expandedPath.length === 0) {
      this._visitedNodes[path.fromNodeId] = (this._visitedNodes[path.fromNodeId] || 0) + 1;
    }
    this._visitedNodes[path.toNodeId] = (this._visitedNodes[path.toNodeId] || 0) + 1;
  }

  getMatchedRelationship() {
    return this.getData();
  }

  hasExpandedEndNode() {
    return this._expandedEndNode !== null;
  }

  setExpandedEndNode(expandedEndNode) {
    this._expandedEndNode = expandedEndNode;
  }

  getExpandedEndNode() {
    return this._expandedEndNode;
  }

  setMatchingRelationshipIds(relationshipIds) {
    this._matchingRelationshipsIds = relationshipIds;
  }

  getMatchingRelationshipIds() {
    const ids = this._matchingRelationshipsIds ? this._matchingRelationshipsIds.slice() : null;
    this._matchingRelationshipsIds = null;
    return ids;
  }

  expandedPathLastItem() {
    return this._expandedPath[this._expandedPath.length - 1];
  }

  backTrackExpandedPath() {
    if (this._expandedPath.length === 0) return;
    this._expandedPath.pop();
    const path = this._pathList.pop();
    if (this._expandedPath.length === 0) {
      this._visitedNodes = {};
    } else {
      this._visitedNodes[path.toNodeId] = (this._visitedNodes[path.toNodeId] || 0) - 1;
    }
  }

  resetExpandedPath() {
    this._expandedPath = [];
    this._pathList = [];
    this._visitedNodes = {};
  }

  pathLengthFromSatisfied() {
    return !this.expandPath() || 
           this._pathLengthFrom === null || 
           (this._pathLengthFrom && this._expandedPath.length >= this._pathLengthFrom);
  }

  pathLengthToSatisfied() {
    return !this.expandPath() || 
           this._pathLengthTo === null || 
           (this._pathLengthTo && this._expandedPath.length <= this._pathLengthTo);
  }

  pathLengthSatisfied() {
    return this.pathLengthFromSatisfied() && this.pathLengthToSatisfied();
  }

  getExpandedPath() {
    return this._expandedPath;
  }

  setShortestPath(shortestPath) {
    this._expandedPath = shortestPath;
  }

  // Data access

  get() {
    const RelationshipReference = require('./RelationshipReference.js').RelationshipReference;
    return new RelationshipReference(this._db, this._id);
  }

  toObject() {
    return {
      id: this._id,
      type: this._relationshipType,
      properties: this._addAssociativeArrayFunctions(this._properties),
      fromNode: this._fromNode ? this._fromNode.get() : null,
      toNode: this._toNode ? this._toNode.get() : null,
      direction: this.direction(),
      getProperty: (key) => this._properties[key],
      getProperties: () => this._properties,
      getKeys: () => Object.keys(this._properties),
      getType: () => this._relationshipType
    };
  }

  toString() {
    let direction = 'none';
    if (this.leftDirection()) direction = 'left';
    else if (this.rightDirection()) direction = 'right';
    
    return `id: ${this._id}, type: ${this._relationshipType}, ` +
           `properties: ${JSON.stringify(this._properties)}, ` +
           `fromNodeId: ${this._fromNode ? this._fromNode.id() : null}, ` +
           `toNodeId: ${this._toNode ? this._toNode.id() : null}, ` +
           `direction: ${direction}`;
  }

  value() {
    return this.get();
  }

  getData() {
    if (this._hasVariablePathLength) {
      const List = require('../types/List.js').List;
      return new List(this._expandedPath, (relationshipId) => {
        const rel = this._db.getRelationshipById(relationshipId);
        return rel ? rel.value() : null;
      });
    }
    return this._db ? this._db.getRelationshipById(this._matchedRelationship) : null;
  }

  // Variable methods

  setVariableKey(variableKey) {
    this._variableKey = variableKey;
  }

  getVariableKey() {
    return this._variableKey;
  }

  hasVariableKey() {
    return this._variableKey !== undefined;
  }

  // Action methods

  nextAction() {
    // No-op
  }

  setNextAction(f) {
    this.nextAction = f;
  }

  // Grouping methods

  groupByKey() {
    const data = this.getData();
    return data ? data.id() : this._id;
  }

  groupByValue() {
    const data = this.getData();
    return data ? data.get() : this;
  }

  // Copy and mapping

  copy() {
    const r = new Relationship(this._db);
    r.setType(this._relationshipType);
    r.setProperties(this._properties);
    r.setLeftDirection(this._leftDirection);
    r.setRightDirection(this._rightDirection);
    r.setFromNode(this._fromNode);
    r.setToNode(this._toNode);
    return r;
  }

  mappable() {
    if (this._referredRelationship) {
      if (this._referredRelationship.mappable && !this._referredRelationship.mappable()) {
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

  _addAssociativeArrayFunctions(obj) {
    const result = { ...obj };
    result.getKeys = function() { return Object.keys(this); };
    return result;
  }
}

module.exports = { Relationship };
