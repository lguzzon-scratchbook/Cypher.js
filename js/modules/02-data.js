/**
 * @fileoverview Section 2: Data Layer Module for CypherNG
 * @description Contains data structures, database, and entities for the Cypher query engine.
 * @module cypher-ng/data
 * @version 1.0.0
 * @license GPL-3.0-or-later
 */

import { addAssociativeArrayFunctions, NodeReference, RelationshipReference } from './01-utilities.js';

/**
 * StringRecoder: maps strings to integer codes for fast index lookups.
 * Uses a trie-based approach for efficient encoding.
 * @class StringRecoder
 */
export class StringRecoder {
    constructor() {
        const TrieNode = function () { return [{}, null]; };
        const root = TrieNode();
        let code_factory = 1;
        const CHARS = 0;
        const CODE = 1;

        /**
         * Encodes a string value to an integer code
         * @method recode
         * @param {*} _val - The value to encode
         * @returns {*} The encoded value (integer or original)
         */
        this.recode = function (_val) {
            if (!_val) return _val;
            let val = _val;
            if (!val.charAt) { val = '' + _val; }
            let n = root, char;
            for (let i = 0; i < val.length; i++) {
                char = val.charAt(i);
                if (!n[CHARS][char]) { n[CHARS][char] = TrieNode(); }
                n = n[CHARS][char];
            }
            return n[CODE] || (n[CODE] = code_factory++);
        };
    }
}

/**
 * IDFactory: generates unique IDs for nodes and relationships
 * @class IDFactory
 */
export class IDFactory {
    constructor() {
        let ID = -1;

        /**
         * Gets the next unique ID
         * @method getId
         * @returns {number} The next ID
         */
        this.getId = function () { return ID++; };
    }
}

/**
 * StoredNode: pure data entity stored in DB.
 * Holds id, labels, properties. No pattern-matching state.
 * @class StoredNode
 * @param {Object} _db - Database reference for index updates
 */
export class StoredNode {
    constructor(_db) {
        const db = _db;
        let id;
        const labels = {};
        const properties = {};
        const propertyExpressions = {}; // For Setter compatibility

        // ID methods
        this.setId = function (_id) { id = _id; };
        this.id = function () { return id; };
        this.getId = function () { return id; };

        // Label methods
        this.setLabel = function (name) {
            labels[name] = true;
            if (db && db._addLabelNodeIdLookup) {
                db._addLabelNodeIdLookup(name, id);
            }
        };
        this.hasLabel = function (name) { return labels[name]; };
        this.setLabels = function (_labels) {
            for (const key in _labels) { labels[key] = _labels[key]; }
        };
        this.setLabelsFromObject = function (_labels) { this.setLabels(_labels); };
        this.labels = function () { return labels; };
        this.getLabels = function () { return Object.keys(labels); };
        this.hasLabels = function () { return Object.keys(labels).length > 0; };

        // Property methods - setProperty stores an expression for Setter use
        this.setProperty = function (key, expression) {
            properties[key] = null;
            propertyExpressions[key] = expression.value;
        };
        this.bindProperty = function (key) {
            properties[key] = propertyExpressions[key]();
        };
        this.setProperties = function (_properties) {
            for (const key in _properties) { properties[key] = _properties[key]; }
        };
        this.getLocalProperty = function (key) {
            return (properties[key] != undefined) ? properties[key] : null;
        };
        this.getProperty = function (key) { return this.getLocalProperty(key); };
        this.getProperties = function () { return Object.create(properties); };
        this.getRawProperties = function () { return properties; };
        this.hasProperties = function () { return Object.keys(properties).length > 0; };

        // Node instance wrapper for output
        const NodeInstance = function (nodeInstance) {
            const self = this;
            for (const key in nodeInstance) { this[key] = nodeInstance[key]; }
            this.getId = function () { return self.id; };
            this.getData = function () { return self; };
            this.getObject = function () { return self; };
            this.groupByKey = function () { return self.id; };
            this.groupByValue = function () { return self; };
        };

        // Get NodeReference for this node
        this.get = function () {
            return new NodeReference(db, id);
        };

        // Convert to plain object for output
        this.toObject = function () {
            return new NodeInstance({
                id: id,
                labels: this.getLabels(),
                properties: addAssociativeArrayFunctions(properties),
                getProperty: function (k) { return properties[k]; },
                getProperties: function () { return this.properties; },
                getLabels: function () { return this.labels; },
                getKeys: function () { return this.properties.getKeys(); }
            });
        };

        this.toString = function () { return JSON.stringify(this.get()); };

        // Type checking methods
        this.isNode = function () { return true; };
        this.isRelationship = function () { return false; };
        this.type = function () { return this.constructor.name; };

        // Group by methods
        this.groupByKey = function () { return id; };
        this.groupByValue = function () { return this.get(); };

        // Serializable representation
        this.toSerializable = function () {
            return { id: id, labels: labels, properties: properties };
        };
    }
}

/**
 * StoredRelationship: pure data entity stored in DB.
 * Stores fromNodeId/toNodeId as numbers; resolves nodes via db reference.
 * @class StoredRelationship
 * @param {Object} _db - Database reference for node lookups
 */
export class StoredRelationship {
    constructor(_db) {
        const db = _db;
        let id;
        let relationshipType;
        const properties = {};
        const propertyExpressions = {}; // For Setter compatibility
        let _fromNodeId;
        let _toNodeId;
        let _leftDirection;
        let _rightDirection;
        let isAdded = false;

        // ID methods
        this.setId = function (_id) { id = _id; };
        this.id = function () { return id; };

        // Type methods
        this.setStoredType = function (type) { relationshipType = type; };
        this.setType = function (type) { relationshipType = type; };
        this.getType = function () { return relationshipType; };

        // Property methods
        this.setProperty = function (key, expression) {
            properties[key] = null;
            propertyExpressions[key] = expression.value;
        };
        this.bindProperty = function (key) {
            properties[key] = propertyExpressions[key]();
        };
        this.setProperties = function (_properties) {
            for (const key in _properties) { properties[key] = _properties[key]; }
        };
        this.getLocalProperty = function (key) {
            return (properties[key] != undefined) ? properties[key] : null;
        };
        this.getProperty = function (key) { return properties[key]; };
        this.getProperties = function () { return properties; };
        this.getRelationshipProperties = function () { return properties; };

        // Node reference methods - stores IDs, resolves via db
        this.setFromNodeId = function (nodeId) { _fromNodeId = nodeId; };
        this.setToNodeId = function (nodeId) { _toNodeId = nodeId; };
        this.setFromNode = function (node) { _fromNodeId = node.id(); };
        this.setToNode = function (node) { _toNodeId = node.id(); };

        this.getFromNode = function (fromNodeId) {
            if (fromNodeId != undefined) {
                if (fromNodeId != _fromNodeId) {
                    return db.getNodeById(_toNodeId);
                }
            }
            return db.getNodeById(_fromNodeId);
        };
        this.getToNode = function (fromNodeId) {
            if (fromNodeId != undefined) {
                if (fromNodeId != _fromNodeId) {
                    return db.getNodeById(_fromNodeId);
                }
            }
            return db.getNodeById(_toNodeId);
        };

        // Expose raw IDs for index operations
        Object.defineProperty(this, 'fromNodeId', { get: function () { return _fromNodeId; } });
        Object.defineProperty(this, 'toNodeId', { get: function () { return _toNodeId; } });

        // Direction methods
        this.setLeftDirection = function (ld) { _leftDirection = ld; };
        this.setRightDirection = function (rd) { _rightDirection = rd; };

        this.leftDirection = function (fromNodeId) {
            if (fromNodeId != undefined) {
                if (fromNodeId != _fromNodeId) { return !_leftDirection && _rightDirection; }
            }
            return _leftDirection && !_rightDirection;
        };
        this.leftDirectionRaw = function () { return _leftDirection; };
        this.rightDirection = function (fromNodeId) {
            if (fromNodeId != undefined) {
                if (fromNodeId != _fromNodeId) { return !_rightDirection && _leftDirection; }
            }
            return _rightDirection && !_leftDirection;
        };
        this.rightDirectionRaw = function () { return _rightDirection; };
        this.uniDirectional = function () {
            return (_rightDirection && _leftDirection) || (!_leftDirection && !_rightDirection);
        };
        this.noDirection = function () { return !_leftDirection && !_rightDirection; };
        this.direction = function () {
            const l = this.leftDirection(), r = this.rightDirection();
            if (l && !r) return 'left';
            if (!l && r) return 'right';
            if (l && r) return 'both';
            return 'none';
        };

        // Status methods
        this.isAdded = function () { return isAdded; };
        this.setIsAdded = function () { isAdded = true; };

        // Type checking
        this.isRelationship = function () { return true; };
        this.isNode = function () { return false; };
        this.type = function () { return this.constructor.name; };

        // Relationship instance wrapper
        const RelationshipInstance = function (ri) {
            for (const key in ri) { this[key] = ri[key]; }
            this.getId = function () { return this.id; };
            this.getData = function () { return this; };
            this.getObject = function () { return this; };
            this.groupByKey = function () { return this.id; };
            this.groupByValue = function () { return this; };
        };

        // Get RelationshipReference
        this.get = function () { return new RelationshipReference(db, id); };

        // Convert to plain object for output
        this.toObject = function () {
            const fromNode = this.getFromNode();
            const toNode = this.getToNode();
            return new RelationshipInstance({
                id: id,
                type: relationshipType,
                properties: addAssociativeArrayFunctions(properties),
                fromNode: (fromNode ? fromNode.get() : null),
                toNode: (toNode ? toNode.get() : null),
                direction: this.direction(),
                getProperty: function (k) { return properties[k]; },
                getProperties: function () { return properties; },
                getKeys: function () { return addAssociativeArrayFunctions(properties).getKeys(); },
                getType: function () { return relationshipType; }
            });
        };

        this.toString = function () {
            let direction = 'none';
            if (this.leftDirection()) direction = 'left';
            else if (this.rightDirection()) direction = 'right';
            return 'id: ' + id +
                '. type: ' + relationshipType +
                '. properties: ' + JSON.stringify(properties) +
                '. fromNodeId: ' + _fromNodeId +
                '. toNodeId: ' + _toNodeId +
                '. direction: ' + direction;
        };
        this.value = function () { return this.get(); };

        // Serializable representation
        this.toSerializable = function () {
            return {
                id: id, type: relationshipType, properties: properties,
                fromNodeId: _fromNodeId, toNodeId: _toNodeId,
                leftDirection: _leftDirection, rightDirection: _rightDirection
            };
        };
    }
}

/**
 * PatternNode: used during parsing and query execution.
 * Holds pattern-matching state and delegates DB operations to db.
 * copy() creates a StoredNode.
 * @class PatternNode
 * @param {Object} _db - Database reference
 */
export class PatternNode {
    constructor(_db) {
        const db = _db;
        let id;
        const labels = {};
        const propertyExpressions = {};
        const properties = {};
        let variableKey;
        let referredNode = null;
        let expandedNode = null;
        const me = this;
        let previousObject;
        let nextObject;
        let pattern;
        let expandedIsMatched = false;

        // Navigation methods
        this.setPreviousObject = function (object) { previousObject = object; };
        this.getPreviousObject = function () { return previousObject; };
        this.setNextObject = function (object) { nextObject = object; };
        this.getNextObject = function () { return nextObject; };
        this.setPattern = function (_pattern) { pattern = _pattern; };
        this.getPattern = function () { return pattern; };

        this.nextNode = function () {
            if (me.getNextObject()) {
                if (me.getNextObject().isRelationship()) return me.getNextObject().getNextObject();
                else if (me.getNextObject().isNode()) return me.getNextObject();
            }
            return null;
        };
        this.previousNode = function () {
            if (me.getPreviousObject()) {
                if (me.getPreviousObject().isRelationship()) return me.getPreviousObject().getPreviousObject();
                else if (me.getPreviousObject().isNode()) return me.getPreviousObject();
            }
            return null;
        };
        this.incomingRelationship = function () {
            if (me.getPreviousObject() && me.getPreviousObject().isRelationship()) return me.getPreviousObject();
            return null;
        };
        this.outgoingRelationship = function () {
            if (me.getNextObject() && me.getNextObject().isRelationship()) return me.getNextObject();
            return null;
        };

        // ID methods
        this.setId = function (_id) { id = _id; };
        this.id = function () { return id; };
        this.getId = function () { return id; };

        // Property methods
        this.setProperty = function (key, expression) {
            properties[key] = null;
            propertyExpressions[key] = expression.value;
        };
        this.setProperties = function (_properties) {
            for (const key in _properties) { properties[key] = _properties[key]; }
        };
        this.bindProperty = function (key) { properties[key] = propertyExpressions[key](); };
        this.bindProperties = function () {
            for (const key in properties) { this.bindProperty(key); }
        };
        this.setLabel = function (labelName) { labels[labelName] = true; };
        this.hasLabel = function (labelName) { return labels[labelName]; };
        this.setLabels = function (_labels) {
            for (const label in _labels) { labels[label] = _labels[label]; }
        };
        this.setVariableKey = function (_variableKey) { variableKey = _variableKey; };
        this.getVariableKey = function () { return variableKey; };
        this.hasVariableKey = function () { return variableKey != undefined; };
        this.getProperties = function () { return Object.create(properties); };
        this.getRawProperties = function () { return properties; };
        this.labels = function () { return labels; };
        this.getLabels = function () { return Object.keys(labels); };
        this.hasLabels = function () { return Object.keys(labels).length > 0; };
        this.hasProperties = function () { return Object.keys(properties).length > 0; };
        this.getLocalProperty = function (key) { return properties[key] || null; };
        this.getProperty = function (key) {
            const n = db.getNodeById(matchedNode);
            if (!n) return null;
            return n.getLocalProperty(key);
        };

        this.get = function (asKey) {
            if (asKey) return id;
            return new NodeReference(db, id);
        };
        this.toObject = function () {
            return db.getNodeById(matchedNode) ? db.getNodeById(matchedNode).toObject() : null;
        };
        this.toString = function () { return JSON.stringify(this.get()); };
        this.type = function () { return this.constructor.name; };

        this.isRelationship = function () { return false; };
        this.isNode = function () { return true; };

        // Referred node methods
        this.setReferredNode = function (_referredNode) { referredNode = _referredNode; };
        this.isReferred = function () { return referredNode != null; };
        this.getReferredNode = function () { return referredNode; };

        // Expanded node methods
        this.setExpandedIsMatched = function () { expandedIsMatched = true; };
        this.expandedIsMatched = function () {
            if (expandedIsMatched) { expandedIsMatched = false; return true; }
            return false;
        };
        this.setExpandedNode = function (_expandedNode) { expandedNode = _expandedNode; };
        this.isExpanded = function () { return expandedNode != null; };
        this.getExpandedNode = function () { return expandedNode; };

        // Action methods
        this.nextAction = function () { ; };
        this.setNextAction = function (f) { this.nextAction = f; };

        // DB operations
        this.convey = function (merge, pathExpansionDepth) {
            return db.matchNode(me, merge, pathExpansionDepth);
        };
        this.create = function () { return db.createNode(me); };
        this.merge = function () { return db.mergeNode(me); };
        this.match = function () { return db.matchNodes(me); };

        // Matched node tracking
        let matchedNode;
        let matchedIncomingRelationshipIds = {};

        this.addMatchedNode = function (node) { matchedNode = node.id(); };
        this.getMatchedNode = function () { return this.getData(); };
        this.addMatchedIncomingRelationshipId = function (nodeId, matchedIncomingRelationshipId) {
            if (!matchedIncomingRelationshipIds[nodeId]) matchedIncomingRelationshipIds[nodeId] = [];
            matchedIncomingRelationshipIds[nodeId].push(matchedIncomingRelationshipId);
        };
        this.getMatchedIncomingRelationshipIds = function (nodeId) {
            if (!matchedIncomingRelationshipIds[nodeId]) return null;
            const ids = matchedIncomingRelationshipIds[nodeId];
            matchedIncomingRelationshipIds[nodeId] = [];
            return ids;
        };

        this.getData = function () { return db.getNodeById(matchedNode); };
        this.groupByKey = function () { return this.getData().id(); };
        this.groupByValue = function () { return this.getData().get(); };

        // copy() creates a StoredNode — the persistence-ready entity stored in DB
        this.copy = function () {
            const n = new StoredNode(db);
            n.setLabels(labels);
            n.setProperties(properties);
            return n;
        };

        this.mappable = function () {
            if (referredNode) {
                if (referredNode.mappable && !referredNode.mappable()) return false;
            }
            for (const propertyKey in properties) {
                if (!propertyExpressions[propertyKey].mappable()) return false;
            }
            return true;
        };
    }
}

/**
 * PatternRelationship: used during parsing and query execution.
 * Holds pattern-matching state. copy() creates a StoredRelationship.
 * @class PatternRelationship
 * @param {Object} _db - Database reference
 */
export class PatternRelationship {
    constructor(_db) {
        const db = _db;
        let id;
        let relationshipType;
        const properties = {};
        const propertyExpressions = {};
        let fromNode;   // StoredNode reference set during create/match
        let toNode;     // StoredNode reference set during create/match
        let leftDirection;
        let rightDirection;
        let variableKey;
        let previousObject;
        let nextObject;
        let isAdded = false;
        let hasVariablePathLength = false;
        let pathLengthFrom = 1;
        let pathLengthTo = 1;
        let pattern;
        let referredRelationship = null;

        // Navigation
        this.setPreviousObject = function (object) { previousObject = object; };
        this.getPreviousObject = function () { return previousObject; };
        this.setNextObject = function (object) { nextObject = object; };
        this.getNextObject = function () { return nextObject; };
        this.setPattern = function (_pattern) { pattern = _pattern; };
        this.getPattern = function () { return pattern; };

        // ID and type
        this.setId = function (_id) { id = _id; };
        this.id = function () { return id; };
        this.setStoredType = function (_type) { relationshipType = _type; };
        this.setType = function (_type) { relationshipType = _type; };
        this.getType = function () { return relationshipType; };

        // Properties
        this.setProperty = function (key, expression) {
            properties[key] = null;
            propertyExpressions[key] = expression.value;
        };
        this.bindProperty = function (key) { properties[key] = propertyExpressions[key](); };
        this.bindProperties = function () {
            for (const key in properties) { this.bindProperty(key); }
        };
        this.setProperties = function (_properties) {
            for (const key in _properties) { properties[key] = _properties[key]; }
        };
        this.getProperty = function (key) { return properties[key]; };
        this.getProperties = function () { return properties; };
        this.getRelationshipProperties = function () { return properties; };

        // Node references
        this.setFromNode = function (node) { fromNode = node; };
        this.setToNode = function (node) { toNode = node; };
        this.getFromNode = function (fromNodeId) {
            if (fromNodeId != undefined) {
                if (fromNodeId != fromNode.id()) return toNode;
            }
            return fromNode;
        };
        this.getToNode = function (fromNodeId) {
            if (fromNodeId != undefined) {
                if (fromNodeId != fromNode.id()) return fromNode;
            }
            return toNode;
        };

        // Direction
        this.setLeftDirection = function (ld) { leftDirection = ld; };
        this.setRightDirection = function (rd) { rightDirection = rd; };
        this.leftDirection = function (fromNodeId) {
            if (fromNodeId != undefined) {
                if (fromNodeId != fromNode.id()) return !leftDirection && rightDirection;
            }
            return leftDirection && !rightDirection;
        };
        this.rightDirection = function (fromNodeId) {
            if (fromNodeId != undefined) {
                if (fromNodeId != fromNode.id()) return !rightDirection && leftDirection;
            }
            return rightDirection && !leftDirection;
        };
        this.uniDirectional = function () {
            return (rightDirection && leftDirection) || (!leftDirection && !rightDirection);
        };
        this.noDirection = function () { return !leftDirection && !rightDirection; };
        this.direction = function () {
            const l = this.leftDirection(), r = this.rightDirection();
            if (l && !r) return 'left';
            if (!l && r) return 'right';
            if (l && r) return 'both';
            return 'none';
        };
        this.type = function () { return this.constructor.name; };
        this.isRelationship = function () { return true; };
        this.isNode = function () { return false; };

        // Referred relationship
        this.setReferredRelationship = function (rr) { referredRelationship = rr; };
        this.isReferred = function () { return referredRelationship != null; };
        this.getReferredRelationship = function () { return referredRelationship; };

        // Status
        this.isAdded = function () { return isAdded; };
        this.setIsAdded = function () { isAdded = true; };
        this.setHasVariablePathLength = function () {
            hasVariablePathLength = true;
            pathLengthFrom = null;
            pathLengthTo = null;
        };
        this.hasVariablePathLength = function () { return hasVariablePathLength; };
        this.setPathLengthFrom = function (v) { pathLengthFrom = v; };
        this.pathLengthFrom = function () { return pathLengthFrom; };
        this.setPathLengthTo = function (v) { pathLengthTo = v; };
        this.pathLengthTo = function () { return pathLengthTo; };
        this.expandPath = function () { return hasVariablePathLength; };

        // Relationship instance
        const RelationshipInstance = function (ri) {
            for (const key in ri) { this[key] = ri[key]; }
            this.getId = function () { return this.id; };
            this.getData = function () { return this; };
            this.getObject = function () { return this; };
            this.groupByKey = function () { return this.id; };
            this.groupByValue = function () { return this; };
        };

        this.get = function () { return new RelationshipReference(db, id); };
        this.toObject = function () {
            return new RelationshipInstance({
                id: id,
                type: relationshipType,
                properties: addAssociativeArrayFunctions(properties),
                fromNode: (fromNode ? fromNode.get() : null),
                toNode: (toNode ? toNode.get() : null),
                direction: this.direction(),
                getProperty: function (k) { return properties[k]; },
                getProperties: function () { return properties; },
                getKeys: function () { return addAssociativeArrayFunctions(properties).getKeys(); },
                getType: function () { return relationshipType; }
            });
        };
        this.toString = function () {
            return 'id: ' + id + '. type: ' + relationshipType +
                '. properties: ' + JSON.stringify(properties) +
                '. fromNodeId: ' + (fromNode ? fromNode.id() : null) +
                '. toNodeId: ' + (toNode ? toNode.id() : null) +
                '. direction: ' + this.direction();
        };
        this.value = function () { return this.get(); };

        this.setVariableKey = function (_variableKey) { variableKey = _variableKey; };
        this.getVariableKey = function () { return variableKey; };
        this.hasVariableKey = function () { return variableKey != undefined; };
        this.nextAction = function () { ; };
        this.setNextAction = function (f) { this.nextAction = f; };

        // Variable path expansion state
        let matchedRelationship;
        let expandedPath = [];
        let pathList = [];
        let visitedNodes = {};
        let matchingRelationshipsIds;
        let expandedEndNode = null;

        const updateVisitedNodes = function (nodeId) {
            visitedNodes[nodeId] = (visitedNodes[nodeId] || 0) + 1;
        };
        const updateVisitedRelationships = function (path) {
            if (expandedPath.length == 0) updateVisitedNodes(path.fromNodeId);
            updateVisitedNodes(path.toNodeId);
        };

        this.visitedBefore = function (nodeId) {
            if (expandedPath.length > 1) {
                if (expandedPath[expandedPath.length - 1] == expandedPath[expandedPath.length - 2]) return true;
            }
            return visitedNodes[nodeId] >= 2;
        };
        this.setMatchedRelationship = function (relationship) {
            matchedRelationship = relationship.id();
        };
        this.addMatchedRelationship = function (relationship, path) {
            if (hasVariablePathLength) {
                expandedPath.push(relationship.id());
                pathList.push(path);
                updateVisitedRelationships(path);
            } else {
                this.setMatchedRelationship(relationship);
            }
        };
        this.getMatchedRelationship = function () { return this.getData(); };
        this.hasExpandedEndNode = function () { return expandedEndNode != null; };
        this.setExpandedEndNode = function (n) { expandedEndNode = n; };
        this.getExpandedEndNode = function () { return expandedEndNode; };
        this.setMatchingRelationshipIds = function (ids) { matchingRelationshipsIds = ids; };
        this.getMatchingRelationshipIds = function () {
            let r = null;
            if (matchingRelationshipsIds) r = matchingRelationshipsIds.slice();
            matchingRelationshipsIds = null;
            return r;
        };
        this.expandedPathLastItem = function () { return expandedPath[expandedPath.length - 1]; };
        this.backTrackExpandedPath = function () {
            if (expandedPath.length == 0) return;
            expandedPath.pop();
            const path = pathList.pop();
            if (expandedPath.length == 0) { visitedNodes = {}; }
            else { visitedNodes[path.toNodeId]--; }
        };
        this.resetExpandedPath = function () {
            expandedPath = [];
            pathList = [];
            visitedNodes = {};
        };
        this.pathLengthFromSatisfied = function () {
            return !this.expandPath() || (pathLengthFrom == null) || (pathLengthFrom && expandedPath.length >= pathLengthFrom);
        };
        this.pathLengthToSatisfied = function () {
            return !this.expandPath() || (pathLengthTo == null) || (pathLengthTo && expandedPath.length <= pathLengthTo);
        };
        this.pathLengthSatisfied = function () {
            return this.pathLengthFromSatisfied() && this.pathLengthToSatisfied();
        };
        this.getExpandedPath = function () { return expandedPath; };
        this.setShortestPath = function (sp) { expandedPath = sp; };

        // Import List class for variable path length
        let List;
        this.getData = function () {
            if (hasVariablePathLength) {
                // Lazy import to avoid circular dependency
                if (!List) List = require('./03-query.js').List;
                return new List(expandedPath, function (relationshipId) {
                    return db.getRelationshipById(relationshipId).value();
                });
            }
            return db.getRelationshipById(matchedRelationship);
        };
        this.getLocalProperty = function (key) { return properties[key] || null; };
        this.getProperty = function (key) {
            const r = db.getRelationshipById(matchedRelationship);
            if (!r) return null;
            return r.getLocalProperty(key);
        };
        this.groupByKey = function () { return this.getData().id(); };
        this.groupByValue = function () { return this.getData().get(); };

        // copy() creates a StoredRelationship — the persistence-ready entity
        this.copy = function () {
            const r = new StoredRelationship(db);
            r.setStoredType(relationshipType);
            r.setProperties(properties);
            r.setLeftDirection(leftDirection);
            r.setRightDirection(rightDirection);
            r.setFromNode(fromNode);
            r.setToNode(toNode);
            return r;
        };

        this.mappable = function () {
            if (referredRelationship) {
                if (referredRelationship.mappable && !referredRelationship.mappable()) return false;
            }
            for (const propertyKey in properties) {
                if (!propertyExpressions[propertyKey].mappable()) return false;
            }
            return true;
        };
    }
}

/**
 * Matcher: helper for set-based node/relationship matching
 * @class Matcher
 */
export class Matcher {
    constructor() {
        let toMatchCount = 0;
        let idsMatchCount = [];
        let matchingSet = [];

        this.setMatchingSet = function (_matchingSet, initialMatchCount) {
            matchingSet = _matchingSet;
            idsMatchCount = new Array(matchingSet.length).fill(
                initialMatchCount != undefined ? initialMatchCount : 1
            );
        };
        this.addToMatchingSet = function (id) {
            matchingSet.push(parseInt(id));
            idsMatchCount.push(0);
        };
        this.updateMatchingSet = function () {
            let carryOverCount = 0;
            for (let i = 0; i < matchingSet.length; i++) {
                if (idsMatchCount[i] == toMatchCount) carryOverCount++;
            }
            const newMatchingSet = new Array(carryOverCount);
            let new_i = 0;
            for (let i = 0; i < matchingSet.length; i++) {
                if (idsMatchCount[i] == toMatchCount) newMatchingSet[new_i++] = matchingSet[i];
            }
            matchingSet = newMatchingSet;
            idsMatchCount = new Array(matchingSet.length).fill(toMatchCount);
        };
        this.incrementToMatchCount = function () { toMatchCount++; };
        this.keepMatchTally = function (id) {
            for (let i = 0; i < matchingSet.length; i++) {
                if (matchingSet[i] == id) idsMatchCount[i] = (idsMatchCount[i] + 1 || 1);
            }
        };
        this.toMatchCount = function () { return toMatchCount; };
        this.matchingSet = function () { return matchingSet; };
        this.matchingSetSize = function () { return matchingSet.length; };
    }
}

/**
 * Pattern: represents a graph pattern in a query
 * @class Pattern
 */
export class Pattern {
    constructor() {
        const objects = [];
        const nodes = [];
        const relationships = [];
        const me = this;
        let usedAsCondition = false;
        let findShortestPath = false;
        let shortestPathLength = Number.MAX_SAFE_INTEGER;
        let shortestPath;

        // Import addArrayFunctions
        let addArrayFunctions;
        
        const addObject = function (object) {
            if (!me.empty()) {
                me.lastObject().setNextObject(object);
                object.setPreviousObject(me.lastObject());
            }
            object.setPattern(me);
            objects.push(object);
        };
        const processShortestPath = function () {
            if (relationships[0].getExpandedPath().length < shortestPathLength) {
                shortestPathLength = relationships[0].getExpandedPath().length;
                shortestPath = relationships[0].getExpandedPath().slice();
            }
        };

        this.shortestpath = function () { findShortestPath = true; };
        this.addNode = function (node) { nodes.push(node); addObject(node); };
        this.addRelationship = function (relationship) { relationships.push(relationship); addObject(relationship); };
        this.nodeCount = function () { return nodes.length; };
        this.relationshipCount = function () { return relationships.length; };

        this.getData = function () {
            let d = [], r, relationshipList;
            const groupByKey = [];
            for (let i = 0; i < relationships.length; i++) {
                if (!relationships[i].hasVariablePathLength()) {
                    r = relationships[i].getData().value().getRelationship();
                    d.push(r.getFromNode().get(), r.get(), r.getToNode().get());
                    groupByKey.push(r.id());
                } else {
                    relationshipList = relationships[i].getData().value();
                    for (let j = 0; j < relationshipList.length; j++) {
                        r = relationshipList[j].getRelationship();
                        d.push(r.getFromNode().get(), r.get(), r.getToNode().get());
                        groupByKey.push(r.id());
                    }
                }
            }
            // Lazy import to avoid circular dependency
            if (!addArrayFunctions) addArrayFunctions = require('./01-utilities.js').addArrayFunctions;
            d = addArrayFunctions(d);
            d.getNodes = function () {
                const ns = [];
                for (let i = 0; i < d.length; i += 3) {
                    if (i == 0) ns.push(d[i]);
                    ns.push(d[i + 2]);
                }
                return addArrayFunctions(ns);
            };
            d.getRelationships = function () {
                const rs = [];
                for (let i = 0; i < d.length; i += 3) { rs.push(d[i + 1]); }
                return addArrayFunctions(rs);
            };
            this.groupByKey = function () { return groupByKey; };
            this.groupByValue = function () { return d; };
            return d;
        };

        this.objects = function () { return objects; };
        this.getObject = function (index) { return objects[index]; };
        this.lastObject = function () { return objects[objects.length - 1]; };
        this.getLast = this.lastObject;
        this.empty = function () { return objects.length == 0; };

        this.setNextAction = function (f) { nextAction = f; };
        let nextAction = function () { ; };

        this.finish = function () {
            if (findShortestPath) {
                relationships[0].setShortestPath(shortestPath);
                nextAction();
            }
        };
        const initialiseConveyorBelt = function () {
            me.lastObject().setNextAction(function () {
                if (!findShortestPath) { nextAction(); }
                else { processShortestPath(); }
            });
        };
        this.useAsCondition = function () {
            usedAsCondition = true;
            me.lastObject().setNextAction(function () { return true; });
        };
        this.usedAsCondition = function () { return usedAsCondition; };
        this.value = function () { return nodes[0].convey(false); };
        this.match = function () { initialiseConveyorBelt(); nodes[0].convey(false); };
        this.merge = function () { initialiseConveyorBelt(); nodes[0].convey(true); };
        this.create = function () { initialiseConveyorBelt(); nodes[0].create(); };

        this.mappable = function () {
            for (let i = 0; i < objects.length; i++) {
                if (!objects[i].mappable()) return false;
            }
            return true;
        };
        this.type = function () { return this.constructor.name; };
    }
}