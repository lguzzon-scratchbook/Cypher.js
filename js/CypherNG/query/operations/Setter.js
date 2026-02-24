/**
 * @fileoverview Setter operation for CypherNG
 * 
 * Implements the SET clause for updating properties and labels.
 * 
 * @module CypherNG/query/operations/Setter
 */

/**
 * Setter entry for property assignment
 * @private
 * @class
 */
class SetterEntry {
    constructor(variable, propertyKey, expression) {
        this._variable = variable;
        this._propertyKey = propertyKey;
        this._expression = expression;
    }

    set() {
        let o = this._variable.getObject();
        let assignee;

        if (o.constructor && o.constructor.name === 'Unwind') {
            o = o.value();
        }

        if (o.constructor && o.constructor.name === 'NodeReference') {
            assignee = o.getObject();
        } else if (o.constructor && o.constructor.name === 'Node') {
            assignee = o.getData();
        } else if (o.constructor && o.constructor.name === 'RelationshipReference') {
            assignee = o.getObject();
        } else if (o.constructor && o.constructor.name === 'Relationship') {
            assignee = o.getData();
        } else {
            throw new Error(`Cannot assign to object of type "${o.constructor.name}".`);
        }

        try {
            assignee.setProperty(this._propertyKey, this._expression);
            assignee.bindProperty(this._propertyKey);
        } catch (e) {
            // Silently ignore errors
        }
    }
}

/**
 * Map setter entry for bulk property assignment
 * @private
 * @class
 */
class MapSetterEntry {
    constructor(variable, mapExpression) {
        this._variable = variable;
        this._mapExpression = mapExpression;
    }

    set() {
        let o = this._variable.getObject();
        let assignee;

        if (o.constructor && o.constructor.name === 'Unwind') {
            o = o.value();
        }

        if (o.constructor && o.constructor.name === 'NodeReference' || 
            o.constructor && o.constructor.name === 'RelationshipReference') {
            assignee = o.getObject();
        } else if (o.constructor && o.constructor.name === 'Node' || 
                   o.constructor && o.constructor.name === 'Relationship') {
            assignee = o.getData();
        } else {
            throw new Error(`Cannot assign to object of type "${o.constructor.name}".`);
        }

        assignee.setProperties(this._mapExpression.value());
    }
}

/**
 * Label setter entry for node labels
 * @private
 * @class
 */
class LabelSetterEntry {
    constructor(variable, labelExpression) {
        this._variable = variable;
        this._labelExpression = labelExpression;
    }

    set() {
        let o = this._variable.getObject();
        let assignee;

        if (o.constructor && o.constructor.name === 'Unwind') {
            o = o.value();
        }

        if (o.constructor && o.constructor.name === 'NodeReference') {
            assignee = o.getObject();
        } else if (o.constructor && o.constructor.name === 'Node') {
            assignee = o.getData();
        } else {
            throw new Error(`Cannot assign to object of type "${o.constructor.name}".`);
        }

        assignee.setLabel(this._labelExpression.value(), assignee.getId());
    }
}

/**
 * Type setter entry for relationship types
 * @private
 * @class
 */
class TypeSetterEntry {
    constructor(variable, typeExpression) {
        this._variable = variable;
        this._typeExpression = typeExpression;
    }

    set() {
        let o = this._variable.getObject();
        let assignee;

        if (o.constructor && o.constructor.name === 'Unwind') {
            o = o.value();
        }

        if (o.constructor && o.constructor.name === 'RelationshipReference') {
            assignee = o.getObject();
        } else if (o.constructor && o.constructor.name === 'Relationship') {
            assignee = o.getData();
        } else {
            throw new Error(`Cannot assign to object of type "${o.constructor.name}".`);
        }

        try {
            assignee.setType(this._typeExpression.value(), assignee.id());
        } catch (e) {
            // Silently ignore errors
        }
    }
}

/**
 * Setter operation class
 * @class
 */
class Setter {
    /**
     * Creates a new Setter operation
     */
    constructor() {
        /** @private @type {Array|null} */
        this._setters = null;
        /** @private @type {Object|null} */
        this._previousOperation = null;
        /** @private @type {Object|null} */
        this._nextOperation = null;
    }

    /**
     * Adds a property setter
     * @param {Object} variable - Variable to set on
     * @param {string} propertyKey - Property key
     * @param {Object} expression - Expression for value
     */
    addSetter(variable, propertyKey, expression) {
        if (!this._setters) {
            this._setters = [];
        }
        this._setters.push(new SetterEntry(variable, propertyKey, expression));
    }

    /**
     * Adds a label setter
     * @param {Object} variable - Variable to set on
     * @param {Object} labelExpression - Expression for label
     */
    addLabelSetter(variable, labelExpression) {
        if (!this._setters) {
            this._setters = [];
        }
        this._setters.push(new LabelSetterEntry(variable, labelExpression));
    }

    /**
     * Adds a map setter
     * @param {Object} variable - Variable to set on
     * @param {Object} mapExpression - Expression for map
     */
    addMapSetter(variable, mapExpression) {
        if (!this._setters) {
            this._setters = [];
        }
        this._setters.push(new MapSetterEntry(variable, mapExpression));
    }

    /**
     * Adds a type setter
     * @param {Object} variable - Variable to set on
     * @param {Object} typeExpression - Expression for type
     */
    addTypeSetter(variable, typeExpression) {
        if (!this._setters) {
            this._setters = [];
        }
        this._setters.push(new TypeSetterEntry(variable, typeExpression));
    }

    /**
     * Sets the previous operation
     * @param {Object} previousOperation - Previous operation
     */
    setPreviousOperation(previousOperation) {
        this._previousOperation = previousOperation;
    }

    /**
     * Sets the next operation
     * @param {Object} nextOperation - Next operation
     */
    setNextOperation(nextOperation) {
        this._nextOperation = nextOperation;
        nextOperation.setPreviousOperation(this);
    }

    /**
     * Gets variables from previous operation
     * @returns {Array} Array of variables
     */
    variables() {
        return this._previousOperation.variables();
    }

    /**
     * Executes the setter operation
     */
    doIt() {
        if (this._setters) {
            for (let i = 0; i < this._setters.length; i++) {
                this._setters[i].set();
            }
        }
        if (this._nextOperation) {
            const result = this._nextOperation.doIt();
            if (result instanceof Promise) {
                result.then();
            }
        }
    }

    /**
     * Finishes the operation
     */
    finish() {
        if (this._nextOperation) {
            this._nextOperation.finish();
        }
    }

    /**
     * Runs the operation (throws error - cannot be first)
     */
    run() {
        throw new Error('Set-operation cannot be first in statement.');
    }

    /**
     * Gets the operation type
     * @returns {string} Operation type
     */
    type() {
        return this.constructor.name;
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Setter;
}
