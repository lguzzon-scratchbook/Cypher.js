/**
 * @fileoverview Setter class for CypherNG.
 * Represents a SET operation for updating properties, labels, and types.
 */

// Import required classes
var Unwind = (typeof module !== 'undefined' && module.exports ?
    require('./Unwind.js').Unwind :
    CypherNG.query.operations.Unwind);
var Node = (typeof module !== 'undefined' && module.exports ?
    require('../../core/Node.js').Node :
    CypherNG.core.Node);
var NodeReference = (typeof module !== 'undefined' && module.exports ?
    require('../../core/References.js').NodeReference :
    CypherNG.core.NodeReference);
var Relationship = (typeof module !== 'undefined' && module.exports ?
    require('../../core/Relationship.js').Relationship :
    CypherNG.core.Relationship);
var RelationshipReference = (typeof module !== 'undefined' && module.exports ?
    require('../../core/References.js').RelationshipReference :
    CypherNG.core.RelationshipReference);

/**
 * Setter - Represents a SET operation.
 * Updates properties, labels, and types on nodes and relationships.
 *
 * @class
 * @memberof CypherNG.query.operations
 */
function Setter() {
    var setters;

    var previousOperation;
    var nextOperation;

    // Persistence Design Note: Setter modifies persistent entity properties.
    // Changes made by Setter are persisted to the database.

    /**
     * SetterEntry - Sets a property on an entity.
     * @class
     * @param {Object} _variable - The variable referencing the entity
     * @param {string} _propertyKey - The property key
     * @param {Object} _expression - The value expression
     */
    function SetterEntry(_variable, _propertyKey, _expression) {
        var variable = _variable;
        var propertyKey = _propertyKey;
        var expression = _expression;

        /**
         * Execute the property set.
         */
        this.set = function() {
            var o = variable.getObject();
            var assignee;

            if (o.constructor == Unwind) {
                o = o.value();
            }

            if (o.constructor == NodeReference) {
                assignee = o.getObject();
            } else if (o.constructor == Node) {
                assignee = o.getData();
            } else if (o.constructor == RelationshipReference) {
                assignee = o.getObject();
            } else if (o.constructor == Relationship) {
                assignee = o.getData();
            } else {
                throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
            }
            try {
                assignee.setProperty(
                    propertyKey,
                    expression
                );
                assignee.bindProperty(propertyKey);
            } catch (e) {
                ;
            }
        };
    }

    /**
     * MapSetterEntry - Sets multiple properties from a map.
     * @class
     * @param {Object} _variable - The variable referencing the entity
     * @param {Object} _mapExpression - The map expression
     */
    function MapSetterEntry(_variable, _mapExpression) {
        var variable = _variable;
        var mapExpression = _mapExpression;

        /**
         * Execute the map set.
         */
        this.set = function() {
            var o = variable.getObject();
            var assignee;

            if (o.constructor == Unwind) {
                o = o.value();
            }

            if (o.constructor == NodeReference || o.constructor == RelationshipReference) {
                assignee = o.getObject();
            } else if (o.constructor == Node || o.constructor == Relationship) {
                assignee = o.getData();
            } else {
                throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
            }
            assignee.setProperties(
                mapExpression.value()
            );
        };
    }

    /**
     * LabelSetterEntry - Sets a label on a node.
     * @class
     * @param {Object} _variable - The variable referencing the node
     * @param {Object} _labelExpression - The label expression
     */
    function LabelSetterEntry(_variable, _labelExpression) {
        var variable = _variable;
        var labelExpression = _labelExpression;

        /**
         * Execute the label set.
         */
        this.set = function() {
            var o = variable.getObject();
            var assignee;

            if (o.constructor == Unwind) {
                o = o.value();
            }

            if (o.constructor == NodeReference) {
                assignee = o.getObject();
            } else if (o.constructor == Node) {
                assignee = o.getData();
            } else {
                throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
            }
            assignee.setLabel(
                labelExpression.value(),
                assignee.getId()
            );
        };
    }

    /**
     * TypeSetterEntry - Sets a type on a relationship.
     * @class
     * @param {Object} _variable - The variable referencing the relationship
     * @param {Object} _typeExpression - The type expression
     */
    function TypeSetterEntry(_variable, _typeExpression) {
        var variable = _variable;
        var typeExpression = _typeExpression;

        /**
         * Execute the type set.
         */
        this.set = function() {
            var o = variable.getObject();
            var assignee;

            if (o.constructor == Unwind) {
                o = o.value();
            }

            if (o.constructor == RelationshipReference) {
                assignee = o.getObject();
            } else if (o.constructor == Relationship) {
                assignee = o.getData();
            } else {
                throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
            }
            try {
                assignee.setType(
                    typeExpression.value(),
                    assignee.id()
                );
            } catch (e) {
                ;
            }
        };
    }

    /**
     * Add a property setter.
     * @param {Object} variable - The variable
     * @param {string} propertyKey - The property key
     * @param {Object} expression - The value expression
     */
    this.addSetter = function(variable, propertyKey, expression) {
        if (!setters) {
            setters = [];
        }
        setters.push(
            new SetterEntry(variable, propertyKey, expression)
        );
    };

    /**
     * Add a label setter.
     * @param {Object} variable - The variable
     * @param {Object} labelExpression - The label expression
     */
    this.addLabelSetter = function(variable, labelExpression) {
        if (!setters) {
            setters = [];
        }
        setters.push(
            new LabelSetterEntry(variable, labelExpression)
        );
    };

    /**
     * Add a map setter.
     * @param {Object} variable - The variable
     * @param {Object} mapExpression - The map expression
     */
    this.addMapSetter = function(variable, mapExpression) {
        if (!setters) {
            setters = [];
        }
        setters.push(
            new MapSetterEntry(variable, mapExpression)
        );
    };

    /**
     * Add a type setter.
     * @param {Object} variable - The variable
     * @param {Object} typeExpression - The type expression
     */
    this.addTypeSetter = function(variable, typeExpression) {
        if (!setters) {
            setters = [];
        }
        setters.push(
            new TypeSetterEntry(variable, typeExpression)
        );
    };

    /**
     * Set the previous operation.
     * @param {Object} _previousOperation - The previous operation
     */
    this.setPreviousOperation = function(_previousOperation) {
        previousOperation = _previousOperation;
    };

    /**
     * Set the next operation.
     * @param {Object} _nextOperation - The next operation
     */
    this.setNextOperation = function(_nextOperation) {
        nextOperation = _nextOperation;
        nextOperation.setPreviousOperation(this);
    };

    /**
     * Get the variables from the previous operation.
     * @returns {Array} Array of variables
     */
    this.variables = function() {
        return previousOperation.variables();
    };

    /**
     * Execute the set operation.
     */
    this.doIt = function() {
        for (var i = 0; i < setters.length; i++) {
            setters[i].set();
        }
        if (nextOperation) {
            const result = nextOperation.doIt();
            if (result instanceof Promise) {
                result.then();
            }
        }
    };

    /**
     * Finish the set operation.
     */
    this.finish = function() {
        if (nextOperation) {
            nextOperation.finish();
        }
    };

    /**
     * Run the set operation.
     * @throws {Error} Always throws - Setter cannot be first in statement
     */
    this.run = function() {
        throw "Set-operation cannot be first in statement.";
    };

    /**
     * Get the type name of this object.
     * @returns {string} Always returns "Setter"
     */
    this.type = function() {
        return this.constructor.name;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Setter = Setter;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).query.operations = (this.CypherNG = this.CypherNG || {}).query.operations || {});
