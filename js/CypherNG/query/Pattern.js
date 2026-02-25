/**
 * @fileoverview Pattern class for CypherNG
 *
 * Handles pattern matching, creation, and merging in Cypher queries.
 * Patterns consist of nodes and relationships that define graph traversals.
 *
 * @module CypherNG/query/Pattern
 */

/**
 * Pattern class for matching, creating, merging graph patterns
 * @class
 */
class Pattern {
    /**
     * Creates a new Pattern
     */
    constructor() {
        /** @private @type {Array} */
        this._objects = [];
        /** @private @type {Array} */
        this._nodes = [];
        /** @private @type {Array} */
        this._relationships = [];
        /** @private @type {boolean} */
        this._usedAsCondition = false;
        /** @private @type {boolean} */
        this._findShortestPath = false;
        /** @private @type {number} */
        this._shortestPathLength = Number.MAX_SAFE_INTEGER;
        /** @private @type {Array} */
        this._shortestPath = null;
        /** @private @type {Function} */
        this._nextAction = function() {};
        /** @private @type {Object|null} */
        this._pattern = null;
    }

    /**
     * Add a node to the pattern
     * @param {Object} node - Node to add
     */
    addNode(node) {
        this._nodes.push(node);
        this._addObject(node);
    }

    /**
     * Add a relationship to the pattern
     * @param {Object} relationship - Relationship to add
     */
    addRelationship(relationship) {
        this._relationships.push(relationship);
        this._addObject(relationship);
    }

    /**
     * @private
     */
    _addObject(object) {
        if (!this.empty()) {
            var lastObj = this.lastObject();
            if (lastObj && lastObj.setNextObject) {
                lastObj.setNextObject(object);
            }
            if (object && object.setPreviousObject) {
                object.setPreviousObject(lastObj);
            }
        }
        if (object && object.setPattern) {
            object.setPattern(this);
        }
        this._objects.push(object);
    }

    /**
     * Get node count
     * @returns {number} Number of nodes
     */
    nodeCount() {
        return this._nodes.length;
    }

    /**
     * Get relationship count
     * @returns {number} Number of relationships
     */
    relationshipCount() {
        return this._relationships.length;
    }

    /**
     * Get all objects
     * @returns {Array} Array of objects
     */
    objects() {
        return this._objects;
    }

    /**
     * Get object by index
     * @param {number} index - Object index
     * @returns {Object} Object at index
     */
    getObject(index) {
        return this._objects[index];
    }

    /**
     * Get last object
     * @returns {Object} Last object
     */
    lastObject() {
        return this._objects[this._objects.length - 1];
    }

    /**
     * Alias for lastObject
     * @returns {Object} Last object
     */
    getLast() {
        return this.lastObject();
    }

    /**
     * Check if pattern is empty
     * @returns {boolean} True if empty
     */
    empty() {
        return this._objects.length === 0;
    }

    /**
     * Set the next action callback
     * @param {Function} f - Action function
     */
    setNextAction(f) {
        this._nextAction = f;
    }

    /**
     * Execute next action
     */
    nextAction() {
        this._nextAction();
    }

    /**
     * Set pattern reference
     * @param {Object} pattern - Pattern reference
     */
    setPattern(pattern) {
        this._pattern = pattern;
    }

    /**
     * Enable shortest path mode
     */
    shortestpath() {
        this._findShortestPath = true;
    }

    /**
     * Use as condition
     */
    useAsCondition() {
        this._usedAsCondition = true;
        this._nextAction = function() {
            return true;
        };
    }

    /**
     * Check if used as condition
     * @returns {boolean} True if used as condition
     */
    usedAsCondition() {
        return this._usedAsCondition;
    }

    /**
     * Get data for grouping
     * @returns {Object} Data object with groupByKey and groupByValue
     */
    getData() {
        var data = [];
        var groupByKey = [];

        for (var i = 0; i < this._relationships.length; i++) {
            var rel = this._relationships[i];
            if (!rel.hasVariablePathLength || !rel.hasVariablePathLength()) {
                // Get relationship data
                try {
                    var relData = rel.getData ? rel.getData() : rel;
                    var relValue = relData.value ? relData.value() : relData;

                    if (relValue && relValue.getRelationship) {
                        var relationship = relValue.getRelationship();
                        var fromNode = relationship.getFromNode ? relationship.getFromNode().get() : null;
                        var toNode = relationship.getToNode ? relationship.getToNode().get() : null;
                        var relItem = relationship.get ? relationship.get() : relationship;

                        if (fromNode) data.push(fromNode);
                        data.push(relItem);
                        if (toNode) data.push(toNode);
                        groupByKey.push(relationship.id ? relationship.id() : rel);
                    }
                } catch (e) {
                    // Skip this relationship
                }
            } else if (rel.hasVariablePathLength && rel.hasVariablePathLength()) {
                // Handle variable length paths
                try {
                    var relList = rel.getData ? rel.getData().value() : null;
                    if (relList && Array.isArray(relList)) {
                        for (var j = 0; j < relList.length; j++) {
                            var item = relList[j];
                            if (item && item.getRelationship) {
                                var r = item.getRelationship();
                                var from = r.getFromNode ? r.getFromNode().get() : null;
                                var to = r.getToNode ? r.getToNode().get() : null;
                                var relItem = r.get ? r.get() : r;

                                if (from) data.push(from);
                                data.push(relItem);
                                if (to) data.push(to);
                                groupByKey.push(r.id ? r.id() : item);
                            }
                        }
                    }
                } catch (e) {
                    // Skip this relationship
                }
            }
        }

        // Add helper functions
        data.getNodes = function() {
            var nodes = [];
            for (var i = 0; i < data.length; i += 3) {
                if (i === 0 || data[i + 2]) {
                    nodes.push(data[i + 2] || data[i]);
                }
            }
            return nodes;
        };

        data.getRelationships = function() {
            var rels = [];
            for (var i = 1; i < data.length; i += 3) {
                rels.push(data[i]);
            }
            return rels;
        };

        data.groupByKey = function() {
            return groupByKey;
        };

        data.groupByValue = function() {
            return data;
        };

        return data;
    }

    /**
     * Initialize the conveyor belt pattern
     * @private
     */
    _initializeConveyorBelt() {
        var me = this;
        if (this.lastObject() && this.lastObject().setNextAction) {
            this.lastObject().setNextAction(function() {
                if (!me._findShortestPath) {
                    me.nextAction();
                } else if (me._findShortestPath) {
                    me._processShortestPath();
                }
            });
        }
    }

    /**
     * Process shortest path
     * @private
     */
    _processShortestPath() {
        if (this._relationships.length > 0) {
            var rel = this._relationships[0];
            if (rel.getExpandedPath) {
                var expandedPath = rel.getExpandedPath();
                if (expandedPath && expandedPath.length < this._shortestPathLength) {
                    this._shortestPathLength = expandedPath.length;
                    this._shortestPath = expandedPath.slice();
                }
            }
        }
    }

    /**
     * Match pattern - find existing nodes/relationships
     */
    match() {
        this._initializeConveyorBelt();
        if (this._nodes.length > 0 && this._nodes[0].convey) {
            this._nodes[0].convey(false); // merge == false
        }
    }

    /**
     * Merge pattern - match or create
     */
    merge() {
        this._initializeConveyorBelt();
        if (this._nodes.length > 0 && this._nodes[0].convey) {
            this._nodes[0].convey(true); // merge == true
        }
    }

    /**
     * Create pattern - create new nodes/relationships
     */
    create() {
        this._initializeConveyorBelt();
        if (this._nodes.length > 0 && this._nodes[0].create) {
            this._nodes[0].create();
        }
    }

    /**
     * Check if all objects are mappable
     * @returns {boolean} True if all mappable
     */
    mappable() {
        for (var i = 0; i < this._objects.length; i++) {
            if (this._objects[i] && this._objects[i].mappable && !this._objects[i].mappable()) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get value
     * @returns {*} Value of first node
     */
    value() {
        if (this._nodes.length > 0 && this._nodes[0].convey) {
            return this._nodes[0].convey(false);
        }
        return null;
    }

    /**
     * Finish processing
     */
    finish() {
        if (this._findShortestPath && this._relationships.length > 0) {
            this._relationships[0].setShortestPath(this._shortestPath);
            this.nextAction();
        }
    }

    /**
     * Get type name
     * @returns {string} Type name
     */
    type() {
        return this.constructor.name;
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Pattern;
}