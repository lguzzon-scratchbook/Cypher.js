/**
 * @fileoverview Delete operation for CypherNG
 *
 * Implements the DELETE and DETACH DELETE clauses for removing nodes and relationships.
 *
 * @module CypherNG/query/operations/Delete
 */

/**
 * Delete operation class
 * @class
 */
class Delete {
    /**
     * Creates a new Delete operation
     * @param {Object} statement - Statement context
     * @param {boolean} [detach=false] - If true, also delete connected relationships
     */
    constructor(statement, detach) {
        /** @private @type {Object} */
        this._statement = statement;
        /** @private @type {boolean} */
        this._detach = detach || false;
        /** @private @type {Array} */
        this._expressions = [];
        /** @private @type {Object|null} */
        this._previousOperation = null;
        /** @private @type {Object|null} */
        this._nextOperation = null;
    }

    /**
     * Add an expression to delete
     * @param {Object} expression - Expression to evaluate and delete
     */
    addExpression(expression) {
        this._expressions.push(expression);
    }

    /**
     * Set the previous operation
     * @param {Object} previousOperation - Previous operation
     */
    setPreviousOperation(previousOperation) {
        this._previousOperation = previousOperation;
    }

    /**
     * Set the next operation
     * @param {Object} nextOperation - Next operation
     */
    setNextOperation(nextOperation) {
        this._nextOperation = nextOperation;
        if (nextOperation && nextOperation.setPreviousOperation) {
            nextOperation.setPreviousOperation(this);
        }
    }

    /**
     * Get the previous operation
     * @returns {Object} Previous operation
     */
    previousOperation() {
        return this._previousOperation;
    }

    /**
     * Execute the delete operation
     */
    doIt() {
        var i;
        for (i = 0; i < this._expressions.length; i++) {
            this._deleteOne(this._expressions[i]);
        }

        if (this._nextOperation) {
            var result = this._nextOperation.doIt();
            if (result instanceof Promise) {
                result.then();
            }
        }
    }

    /**
     * Delete a single entity
     * @private
     * @param {Object} expression - Expression to delete
     */
    _deleteOne(expression) {
        try {
            var toDelete = expression.value();

            if (toDelete && toDelete.isNode && toDelete.isNode()) {
                this._deleteNode(toDelete);
            } else if (toDelete && toDelete.isRelationship && toDelete.isRelationship()) {
                this._deleteRelationship(toDelete);
            } else if (toDelete && toDelete.getData && toDelete.getData()) {
                // Might be a reference object
                var data = toDelete.getData();
                if (data && data.isNode && data.isNode()) {
                    this._deleteNode(data);
                } else if (data && data.isRelationship && data.isRelationship()) {
                    this._deleteRelationship(data);
                }
            }
        } catch (e) {
            // Silently ignore delete errors
        }
    }

    /**
     * Delete a node
     * @private
     * @param {Object} node - Node to delete
     */
    _deleteNode(node) {
        var db = this._statement.engine().db();
        if (!db) return;

        var nodeId = node.id ? node.id() : node.getId ? node.getId() : null;
        if (nodeId === null) return;

        // If detach, delete all relationships first
        if (this._detach) {
            var relationships = db.getRelationshipsByNodeId(nodeId);
            if (relationships) {
                for (var i = 0; i < relationships.length; i++) {
                    this._deleteRelationship(relationships[i]);
                }
            }
        }

        // Remove from label index
        var labels = node.labels ? node.labels() : (node.getLabels ? node.getLabels() : []);
        if (labels && Array.isArray(labels)) {
            for (var j = 0; j < labels.length; j++) {
                db._removeLabelNodeIdLookup(labels[j], nodeId);
            }
        }

        // Remove from property index
        var props = node.getProperties ? node.getProperties() : {};
        for (var key in props) {
            db._removeNodeIdFromPropertyLookup(key, props[key], nodeId);
        }

        // Remove node
        db._removeNode(nodeId);
    }

    /**
     * Delete a relationship
     * @private
     * @param {Object} relationship - Relationship to delete
     */
    _deleteRelationship(relationship) {
        var db = this._statement.engine().db();
        if (!db) return;

        var relId = relationship.id ? relationship.id() : relationship.getId ? relationship.getId() : null;
        if (relId === null) return;

        var fromNodeId = relationship.getFromNode ? relationship.getFromNode().id() : null;
        var toNodeId = relationship.getToNode ? relationship.getToNode().id() : null;

        // Remove from node adjacency
        if (fromNodeId !== null) {
            db._removeRelationshipIdFromNodeIdLookup(fromNodeId, toNodeId, relId);
        }
        if (toNodeId !== null) {
            db._removeRelationshipIdFromNodeIdLookup(toNodeId, fromNodeId, relId);
        }

        // Remove from type index
        var relType = relationship.type ? relationship.type() : (relationship.getType ? relationship.getType() : null);
        if (relType) {
            db._removeRelationshipIdFromTypeLookup(relType, relId);
        }

        // Remove relationship
        db._removeRelationship(relId);
    }

    /**
     * Run the delete operation (synchronous)
     */
    run() {
        this.doIt();
        if (this._nextOperation) {
            this._nextOperation.finish();
        }
    }

    /**
     * Finish processing
     */
    finish() {
        if (this._nextOperation) {
            this._nextOperation.finish();
        } else {
            this._statement.success();
        }
    }

    /**
     * Get variables from previous operation
     * @returns {Array} Variables
     */
    variables() {
        if (this._previousOperation && this._previousOperation.variables) {
            return this._previousOperation.variables();
        }
        return [];
    }

    /**
     * Get operation type
     * @returns {string} Type name
     */
    type() {
        return this.constructor.name;
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Delete;
}