/**
 * @fileoverview Pattern class for CypherNG.
 * Represents a graph pattern (sequence of nodes and relationships).
 */

/**
 * Pattern - Represents a graph pattern with nodes and relationships.
 * Used for MATCH, CREATE, and MERGE operations.
 *
 * @class
 * @memberof CypherNG.core
 */
function Pattern() {
    var objects = [];
    var nodes = [];
    var relationships = [];
    var me = this;

    var usedAsCondition = false;
    var findShortestPath = false;
    var shortestPathLength = Number.MAX_SAFE_INTEGER;
    var shortestPath;

    // Persistence Design Note: Patterns are transient query constructs.
    // They don't need persistence but their results (nodes/relationships) do.

    /**
     * Add an object to the pattern chain.
     * @param {Node|Relationship} object - The object to add
     */
    var addObject = function(object) {
        if (!me.empty()) {
            me.lastObject().setNextObject(object);
            object.setPreviousObject(me.lastObject());
        }
        object.setPattern(me);
        objects.push(object);
    };

    /**
     * Process and store the shortest path found.
     */
    var processShortestPath = function() {
        if (relationships[0].getExpandedPath().length < shortestPathLength) {
            shortestPathLength = relationships[0].getExpandedPath().length;
            shortestPath = relationships[0].getExpandedPath().slice();
        }
    };

    /**
     * Mark this pattern as finding shortest path.
     */
    this.shortestpath = function() {
        findShortestPath = true;
    };

    /**
     * Add a node to the pattern.
     * @param {Node} node - The node to add
     */
    this.addNode = function(node) {
        nodes.push(node);
        addObject(node);
    };

    /**
     * Add a relationship to the pattern.
     * @param {Relationship} relationship - The relationship to add
     */
    this.addRelationship = function(relationship) {
        relationships.push(relationship);
        addObject(relationship);
    };

    /**
     * Get the number of nodes in the pattern.
     * @returns {number} The node count
     */
    this.nodeCount = function() {
        return nodes.length;
    };

    /**
     * Get the number of relationships in the pattern.
     * @returns {number} The relationship count
     */
    this.relationshipCount = function() {
        return relationships.length;
    };

    /**
     * Get the pattern data as a plain object.
     * @returns {Object} The pattern data with nodes and relationships
     */
    this.getData = function() {
        var addArrayFunctions = (typeof module !== 'undefined' && module.exports ?
            require('../structures/utils.js').addArrayFunctions :
            CypherNG.structures.addArrayFunctions);

        var d = [], r, relationshipList;
        var groupByKey = [];

        for (var i = 0; i < relationships.length; i++) {
            if (!relationships[i].hasVariablePathLength()) {
                r = relationships[i].getData().value().getRelationship();
                d.push(
                    r.getFromNode().get(),
                    r.get(),
                    r.getToNode().get()
                );
                groupByKey.push(r.id());
            } else if (relationships[i].hasVariablePathLength()) {
                relationshipList = relationships[i].getData().value();
                for (var j = 0; j < relationshipList.length; j++) {
                    r = relationshipList[j].getRelationship();
                    d.push(
                        r.getFromNode().get(),
                        r.get(),
                        r.getToNode().get()
                    );
                    groupByKey.push(r.id());
                }
            }
        }

        d = addArrayFunctions(d);

        /**
         * Get all nodes from the pattern data.
         * @returns {Array} Array of node references
         */
        d.getNodes = function() {
            var nodes = [];
            for (var i = 0; i < d.length; i += 3) {
                if (i == 0) {
                    nodes.push(d[i]);
                }
                nodes.push(d[i + 2]);
            }
            return addArrayFunctions(nodes);
        };

        /**
         * Get all relationships from the pattern data.
         * @returns {Array} Array of relationship references
         */
        d.getRelationships = function() {
            var relationships = [];
            for (var i = 0; i < d.length; i += 3) {
                relationships.push(d[i + 1]);
            }
            return addArrayFunctions(relationships);
        };

        this.groupByKey = function() { return groupByKey; };
        this.groupByValue = function() { return d; };

        return d;
    };

    /**
     * Get all objects in the pattern.
     * @returns {Array} Array of nodes and relationships
     */
    this.objects = function() {
        return objects;
    };

    /**
     * Get an object at a specific index.
     * @param {number} index - The object index
     * @returns {Node|Relationship} The object at the index
     */
    this.getObject = function(index) {
        return objects[index];
    };

    /**
     * Get the last object in the pattern.
     * @returns {Node|Relationship} The last object
     */
    this.lastObject = function() {
        return objects[objects.length - 1];
    };

    /**
     * Alias for lastObject().
     * @returns {Node|Relationship} The last object
     */
    this.getLast = this.lastObject;

    /**
     * Check if the pattern is empty.
     * @returns {boolean} True if the pattern has no objects
     */
    this.empty = function() {
        return objects.length == 0;
    };

    /**
     * Set the next action function.
     * @param {Function} f - The action function
     */
    this.setNextAction = function(f) {
        nextAction = f;
    };

    var nextAction = function() {
        ;
    };

    /**
     * Finish pattern processing (handle shortest path).
     */
    this.finish = function() {
        if (findShortestPath) {
            relationships[0].setShortestPath(shortestPath);
            nextAction();
        }
    };

    /**
     * Initialize the conveyor belt (chain of operations).
     */
    var initialiseConveyorBelt = function() {
        me.lastObject().setNextAction(
            function() {
                if (!findShortestPath) {
                    nextAction();
                } else if (findShortestPath) {
                    processShortestPath();
                }
            }
        );
    };

    /**
     * Mark the pattern as used as a condition.
     */
    this.useAsCondition = function() {
        usedAsCondition = true;
        me.lastObject().setNextAction(
            function() {
                return true;
            }
        );
    };

    /**
     * Check if the pattern is used as a condition.
     * @returns {boolean} True if used as condition
     */
    this.usedAsCondition = function() {
        return usedAsCondition;
    };

    /**
     * Get the pattern value (execute the pattern match).
     * @returns {*} The result of the pattern match
     */
    this.value = function() {
        return nodes[0].convey(false);
    };

    /**
     * Match the pattern against the database.
     */
    this.match = function() {
        initialiseConveyorBelt();
        nodes[0].convey(false); // match: merge == false
    };

    /**
     * Merge the pattern with the database.
     */
    this.merge = function() {
        initialiseConveyorBelt();
        nodes[0].convey(true); // merge: merge == true
    };

    /**
     * Create the pattern in the database.
     */
    this.create = function() {
        initialiseConveyorBelt();
        nodes[0].create();
    };

    /**
     * Check if the pattern is mappable (for serialization).
     * @returns {boolean} True if all objects are mappable
     */
    this.mappable = function() {
        for (var i = 0; i < objects.length; i++) {
            if (!objects[i].mappable) {
                return false;
            }
            if (!objects[i].mappable()) {
                return false;
            }
        }
        return true;
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Pattern"
     */
    this.type = function() {
        return this.constructor.name;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Pattern = Pattern;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).core = (this.CypherNG = this.CypherNG || {}).core || {});
