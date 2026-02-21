/**
 * Pattern - Graph pattern for matching and creation
 * 
 * Represents a pattern of nodes and relationships for MATCH, CREATE, and MERGE operations.
 * Manages the chain of pattern elements and their execution.
 */
class Pattern {
  constructor() {
    /** @private @type {Array<Node|Relationship>} */
    this._objects = [];
    /** @private @type {Array<Node>} */
    this._nodes = [];
    /** @private @type {Array<Relationship>} */
    this._relationships = [];
    /** @private */
    this._usedAsCondition = false;
    /** @private */
    this._findShortestPath = false;
    /** @private */
    this._shortestPathLength = Number.MAX_SAFE_INTEGER;
    /** @private */
    this._shortestPath = null;
    /** @private */
    this._nextAction = null;
  }

  /**
   * Adds an object to the pattern chain
   * @private
   * @param {Node|Relationship} object - Object to add
   */
  _addObject(object) {
    if (this._objects.length > 0) {
      const lastObject = this._objects[this._objects.length - 1];
      lastObject.setNextObject(object);
      object.setPreviousObject(lastObject);
    }
    object.setPattern(this);
    this._objects.push(object);
  }

  /**
   * Adds a node to the pattern
   * @param {Node} node - Node to add
   */
  addNode(node) {
    this._nodes.push(node);
    this._addObject(node);
  }

  /**
   * Adds a relationship to the pattern
   * @param {Relationship} relationship - Relationship to add
   */
  addRelationship(relationship) {
    this._relationships.push(relationship);
    this._addObject(relationship);
  }

  /**
   * Gets the count of nodes in the pattern
   * @returns {number}
   */
  nodeCount() {
    return this._nodes.length;
  }

  /**
   * Gets the count of relationships in the pattern
   * @returns {number}
   */
  relationshipCount() {
    return this._relationships.length;
  }

  /**
   * Gets all objects in the pattern
   * @returns {Array<Node|Relationship>}
   */
  objects() {
    return this._objects;
  }

  /**
   * Gets an object at a specific index
   * @param {number} index - Object index
   * @returns {Node|Relationship|undefined}
   */
  getObject(index) {
    return this._objects[index];
  }

  /**
   * Gets the last object in the pattern
   * @returns {Node|Relationship|undefined}
   */
  lastObject() {
    return this._objects[this._objects.length - 1];
  }

  /**
   * Alias for lastObject()
   * @returns {Node|Relationship|undefined}
   */
  getLast() {
    return this.lastObject();
  }

  /**
   * Checks if the pattern is empty
   * @returns {boolean}
   */
  empty() {
    return this._objects.length === 0;
  }

  /**
   * Sets the next action to execute after pattern matching
   * @param {Function} f - Action function
   */
  setNextAction(f) {
    this._nextAction = f;
  }

  /**
   * Marks this pattern for shortest path finding
   */
  shortestpath() {
    this._findShortestPath = true;
  }

  /**
   * Processes shortest path during execution
   * @private
   */
  _processShortestPath() {
    if (this._relationships.length > 0 && this._relationships[0].getExpandedPath) {
      const path = this._relationships[0].getExpandedPath();
      if (path && path.length < this._shortestPathLength) {
        this._shortestPathLength = path.length;
        this._shortestPath = path.slice();
      }
    }
  }

  /**
   * Finishes pattern execution
   */
  finish() {
    if (this._findShortestPath) {
      if (this._relationships.length > 0 && this._relationships[0].setShortestPath) {
        this._relationships[0].setShortestPath(this._shortestPath);
      }
    }
    if (this._nextAction) {
      this._nextAction();
    }
  }

  /**
   * Marks this pattern as being used as a condition
   */
  useAsCondition() {
    this._usedAsCondition = true;
    this.setNextAction(() => true);
  }

  /**
   * Checks if this pattern is used as a condition
   * @returns {boolean}
   */
  usedAsCondition() {
    return this._usedAsCondition;
  }

  /**
   * Gets the pattern data as a traversable structure
   * @returns {Array}
   */
  getData() {
    const data = [];
    const groupByKey = [];

    for (let i = 0; i < this._relationships.length; i++) {
      const rel = this._relationships[i];
      
      if (!rel.hasVariablePathLength || !rel.hasVariablePathLength()) {
        const r = rel.getData ? rel.getData().value().getRelationship() : null;
        if (r) {
          data.push(r.getFromNode().get(), r.get(), r.getToNode().get());
          groupByKey.push(r.id());
        }
      } else {
        const relationshipList = rel.getData ? rel.getData().value() : [];
        for (let j = 0; j < relationshipList.length; j++) {
          const r = relationshipList[j].getRelationship();
          data.push(r.getFromNode().get(), r.get(), r.getToNode().get());
          groupByKey.push(r.id());
        }
      }
    }

    // Add array helper functions
    const result = this._addArrayFunctions(data);
    
    result.getNodes = function() {
      const nodes = [];
      for (let i = 0; i < this.length; i += 3) {
        if (i === 0) {
          nodes.push(this[i]);
        }
        nodes.push(this[i + 2]);
      }
      return this._addArrayFunctions(nodes);
    };

    result.getRelationships = function() {
      const relationships = [];
      for (let i = 0; i < this.length; i += 3) {
        relationships.push(this[i + 1]);
      }
      return this._addArrayFunctions(relationships);
    };

    this.groupByKey = () => groupByKey;
    this.groupByValue = () => result;

    return result;
  }

  /**
   * Gets the pattern value (alias for getData)
   * @returns {Array}
   */
  value() {
    if (this._nodes.length > 0 && this._nodes[0].convey) {
      return this._nodes[0].convey(false, 0);
    }
    return null;
  }

  /**
   * Executes a MATCH operation on this pattern
   */
  match() {
    this._initialiseConveyorBelt();
    if (this._nodes.length > 0 && this._nodes[0].convey) {
      this._nodes[0].convey(false, 0);
    }
  }

  /**
   * Executes a MERGE operation on this pattern
   */
  merge() {
    this._initialiseConveyorBelt();
    if (this._nodes.length > 0 && this._nodes[0].convey) {
      this._nodes[0].convey(true, 0);
    }
  }

  /**
   * Executes a CREATE operation on this pattern
   */
  create() {
    this._initialiseConveyorBelt();
    if (this._nodes.length > 0 && this._nodes[0].create) {
      this._nodes[0].create();
    }
  }

  /**
   * Initializes the conveyor belt for pattern execution
   * @private
   */
  _initialiseConveyorBelt() {
    const lastObject = this.lastObject();
    if (lastObject && lastObject.setNextAction) {
      lastObject.setNextAction(() => {
        if (!this._findShortestPath) {
          if (this._nextAction) this._nextAction();
        } else {
          this._processShortestPath();
        }
      });
    }
  }

  /**
   * Checks if all objects in the pattern are mappable
   * @returns {boolean}
   */
  mappable() {
    for (let i = 0; i < this._objects.length; i++) {
      if (this._objects[i].mappable && !this._objects[i].mappable()) {
        return false;
      }
    }
    return true;
  }

  /**
   * Gets the type name
   * @returns {string}
   */
  type() {
    return this.constructor.name;
  }

  /**
   * @private
   * Adds array helper functions
   */
  _addArrayFunctions(arr) {
    // Basic array functions that might be expected
    return arr;
  }
}

module.exports = { Pattern };
