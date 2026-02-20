/**
 * @fileoverview Section 1: Utilities Module for CypherNG
 * @description Core utility functions and reference classes used throughout the Cypher query engine.
 * @module cypher-ng/utilities
 * @version 1.0.0
 * @license GPL-3.0-or-later
 */

/**
 * Prints the call stack trace for debugging purposes.
 * @function printStackTrace
 * @param {Function} f - The function to start tracing from
 * @returns {void}
 */
export function printStackTrace(f) {
    let c = f;
    try {
        while (c) {
            console.log(c);
            c = c.caller;
        }
    } catch (e) {
        // Silent fail for security/performance reasons
    }
}

/**
 * Adds utility methods to arrays for Cypher compatibility.
 * @function addArrayFunctions
 * @param {Array} array - The array to enhance
 * @returns {Array} The enhanced array
 */
export function addArrayFunctions(array) {
    array.contains = function (value) {
        for (let i = 0; i < array.length; i++) {
            if (value == array[i]) return true;
        }
        return false;
    };
    array.toLowerCase = function () {
        const a = [];
        for (let i = 0; i < array.length; i++) {
            a.push(array[i].toLowerCase && array[i].toLowerCase() || array[i]);
        }
        return a;
    };
    array.toUpperCase = function () {
        const a = [];
        for (let i = 0; i < array.length; i++) {
            a.push(array[i].toUpperCase && array[i].toUpperCase() || array[i]);
        }
        return a;
    };
    array.get = function () { return array; };
    array.last = function () { return array[array.length - 1]; };
    array.beforeLast = function () { return array[array.length - 2]; };
    array.value = function () { return array; };
    array.join = function (joinBy) {
        let joined = '';
        for (let i = 0; i < array.length; i++) {
            joined += (i > 0 ? joinBy : '') + array[i];
        }
        return joined;
    };
    array.trim = function () {
        const trimmedElements = new Array(array.length);
        for (let i = 0; i < array.length; i++) {
            trimmedElements[i] = array[i].trim();
        }
        return trimmedElements;
    };
    return array;
}

/**
 * Adds utility methods to associative arrays (objects) for Cypher compatibility.
 * @function addAssociativeArrayFunctions
 * @param {Object} associativeArray - The object to enhance
 * @returns {Object} The enhanced object
 */
export function addAssociativeArrayFunctions(associativeArray) {
    if (!associativeArray.getProperty) {
        associativeArray.getProperty = function (key) {
            return associativeArray[key];
        };
    }
    if (!associativeArray.getProperties) {
        associativeArray.getProperties = function () {
            return associativeArray;
        };
    }
    if (!associativeArray.getKeys) {
        associativeArray.getKeys = function () {
            const props = [];
            for (const key in associativeArray) {
                if (associativeArray[key].constructor !== Function) {
                    props.push(key);
                }
            }
            return props;
        };
    }
    return associativeArray;
}

/**
 * Cleans an object by removing function properties and processing nested objects.
 * Used to prepare data for serialization/output.
 * @function clean
 * @param {*} o - The object to clean
 * @returns {*} The cleaned object
 */
export function clean(o) {
    if (o && o.constructor == String) {
        return o.replace(/\0/g, '');
    }
    if (o && (o.constructor == NodeReference || o.constructor == RelationshipReference)) {
        return clean(o.value());
    }
    if (o) {
        for (const p in o) {
            if (typeof o[p] === 'function') {
                delete o[p];
                continue;
            }
            if (o[p]) {
                o[p] = clean(o[p]);
            }
        }
        o.fromNode && (o.fromNode = clean(o.fromNode));
        o.toNode && (o.toNode = clean(o.toNode));
    }
    return o;
}

/**
 * Lightweight proxy class for stored node lookup.
 * Provides lazy access to node data without holding the full node in memory.
 * @class NodeReference
 * @param {Object} _db - The database instance
 * @param {number} _nodeId - The node ID to reference
 */
export class NodeReference {
    constructor(_db, _nodeId) {
        const db = _db;
        const nodeId = _nodeId;
        
        /**
         * @method nodeId
         * @returns {number} The node ID
         */
        this.nodeId = function () { return nodeId; };
        
        /**
         * Alias for nodeId
         * @method id
         * @returns {number} The node ID
         */
        this.id = this.nodeId;
        
        /**
         * Gets the stored node from the database
         * @method getNode
         * @returns {Object} The stored node
         */
        this.getNode = function () { return db.getNodeById(nodeId); };
        
        /**
         * Alias for getNode
         * @method getObject
         * @returns {Object} The stored node
         */
        this.getObject = function () { return db.getNodeById(nodeId); };
        
        /**
         * Gets the node as a plain object for output
         * @method value
         * @returns {Object} The node data as plain object
         */
        this.value = function () { return db.getNodeById(nodeId).toObject(); };
        
        /**
         * Alias for value
         * @method getData
         * @returns {Object} The node data
         */
        this.getData = this.value;
        
        /**
         * Gets a specific property from the node
         * @method getProperty
         * @param {string} propertyKey - The property key to retrieve
         * @returns {*} The property value
         */
        this.getProperty = function (propertyKey) {
            return db.getNodeById(nodeId).getLocalProperty(propertyKey);
        };
        
        /**
         * Gets all properties from the node
         * @method getProperties
         * @returns {Object} All properties
         */
        this.getProperties = function () { return this.value().getProperties(); };
        
        /**
         * Gets all labels from the node
         * @method getLabels
         * @returns {Array} All labels
         */
        this.getLabels = function () { return this.value().getLabels(); };
        
        /**
         * Gets all keys from the node
         * @method getKeys
         * @returns {Array} All property keys
         */
        this.getKeys = function () { return this.value().getProperties().getKeys(); };
        
        /**
         * Group by key function for aggregation
         * @method groupByKey
         * @returns {number} The node ID
         */
        this.groupByKey = this.nodeId;
    }
}

/**
 * Lightweight proxy class for stored relationship lookup.
 * Provides lazy access to relationship data without holding the full relationship in memory.
 * @class RelationshipReference
 * @param {Object} _db - The database instance
 * @param {number} _relationshipId - The relationship ID to reference
 */
export class RelationshipReference {
    constructor(_db, _relationshipId) {
        const db = _db;
        const relationshipId = _relationshipId;
        
        /**
         * @method relationshipId
         * @returns {number} The relationship ID
         */
        this.relationshipId = function () { return relationshipId; };
        
        /**
         * Alias for relationshipId
         * @method id
         * @returns {number} The relationship ID
         */
        this.id = this.relationshipId;
        
        /**
         * Gets the stored relationship from the database
         * @method getRelationship
         * @returns {Object} The stored relationship
         */
        this.getRelationship = function () { return db.getRelationshipById(relationshipId); };
        
        /**
         * Alias for getRelationship
         * @method getObject
         * @returns {Object} The stored relationship
         */
        this.getObject = function () { return db.getRelationshipById(relationshipId); };
        
        /**
         * Gets the relationship as a plain object for output
         * @method value
         * @returns {Object} The relationship data
         */
        this.value = function () { return db.getRelationshipById(relationshipId).toObject(); };
        
        /**
         * Gets the start node of the relationship
         * @method startNode
         * @returns {NodeReference} The start node
         */
        this.startNode = function () { return this.getRelationship().getFromNode().get(); };
        
        /**
         * Gets the end node of the relationship
         * @method endNode
         * @returns {NodeReference} The end node
         */
        this.endNode = function () { return this.getRelationship().getToNode().get(); };
        
        /**
         * Alias for value
         * @method getData
         * @returns {Object} The relationship data
         */
        this.getData = this.value;
        
        /**
         * Gets a specific property from the relationship
         * @method getProperty
         * @param {string} propertyKey - The property key to retrieve
         * @returns {*} The property value
         */
        this.getProperty = function (propertyKey) {
            return db.getRelationshipById(relationshipId).getLocalProperty(propertyKey);
        };
        
        /**
         * Gets all properties from the relationship
         * @method getProperties
         * @returns {Object} All properties
         */
        this.getProperties = function () { return this.value().getProperties(); };
        
        /**
         * Gets all keys from the relationship
         * @method getKeys
         * @returns {Array} All property keys
         */
        this.getKeys = function () { return this.value().getProperties().getKeys(); };
        
        /**
         * Gets the relationship type
         * @method getType
         * @returns {string} The relationship type
         */
        this.getType = function () { return this.value().getType(); };
        
        /**
         * Group by key function for aggregation
         * @method groupByKey
         * @returns {number} The relationship ID
         */
        this.groupByKey = this.relationshipId;
    }
}

/**
 * Factory function to create a new NodeReference (for backward compatibility)
 * @function createNodeReference
 * @param {Object} db - Database instance
 * @param {number} nodeId - Node ID
 * @returns {NodeReference} New node reference
 */
export function createNodeReference(db, nodeId) {
    return new NodeReference(db, nodeId);
}

/**
 * Factory function to create a new RelationshipReference (for backward compatibility)
 * @function createRelationshipReference
 * @param {Object} db - Database instance
 * @param {number} relationshipId - Relationship ID
 * @returns {RelationshipReference} New relationship reference
 */
export function createRelationshipReference(db, relationshipId) {
    return new RelationshipReference(db, relationshipId);
}