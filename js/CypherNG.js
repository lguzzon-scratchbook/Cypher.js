/*
* Cypher.js graph query engine for Javascript. https://github.com/niclasko/Cypher.js.
* Copyright (c) 2024 "Niclas Kjall-Ohlsson"
*
* This file is part of Cypher.js.
*
* Cypher.js is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* Cypher.js is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with Cypher.js.  If not, see <https://www.gnu.org/licenses/>.
*/

// ═══════════════════════════════════════════════════════
// CypherNG.js — Next-Generation Cypher Query Engine
// Refactored from Cypher.js with persistence-ready architecture
// ═══════════════════════════════════════════════════════

function CypherNG() {

// ── Section 1: Utilities ──────────────────────────────
// addArrayFunctions, addAssociativeArrayFunctions, clean,
// NodeReference, RelationshipReference, printStackTrace

    function printStackTrace(f) {
        let c = f;
        try {
            while(c) {
                console.log(c);
                c = c.caller;
            }
        } catch(e) {
            ;
        }
    }

    function addArrayFunctions(array) {
        array.contains = function(value) {
            for(let i=0; i<array.length; i++) {
                if(value == array[i]) return true;
            }
            return false;
        };
        array.toLowerCase = function() {
            const a = [];
            for(let i=0; i<array.length; i++) {
                a.push(array[i].toLowerCase && array[i].toLowerCase() || array[i]);
            }
            return a;
        };
        array.toUpperCase = function() {
            const a = [];
            for(let i=0; i<array.length; i++) {
                a.push(array[i].toUpperCase && array[i].toUpperCase() || array[i]);
            }
            return a;
        };
        array.get = function() { return array; };
        array.last = function() { return array[array.length-1]; };
        array.beforeLast = function() { return array[array.length-2]; };
        array.value = function() { return array; };
        array.join = function(joinBy) {
            let joined = '';
            for(let i=0; i<array.length; i++) {
                joined += (i>0 ? joinBy : '') + array[i];
            }
            return joined;
        };
        array.trim = function() {
            const trimmedElements = new Array(array.length);
            for(let i=0; i<array.length; i++) {
                trimmedElements[i] = array[i].trim();
            }
            return trimmedElements;
        };
        return array;
    }

    function addAssociativeArrayFunctions(associativeArray) {
        if(!associativeArray.getProperty) {
            associativeArray.getProperty = function(key) {
                return associativeArray[key];
            };
        }
        if(!associativeArray.getProperties) {
            associativeArray.getProperties = function() {
                return associativeArray;
            };
        }
        if(!associativeArray.getKeys) {
            associativeArray.getKeys = function() {
                const props = [];
                for(let key in associativeArray) {
                    if(associativeArray[key].constructor !== Function) {
                        props.push(key);
                    }
                }
                return props;
            };
        }
        return associativeArray;
    }

    function clean(o) {
        if(o && o.constructor == String) {
            return o.replace(/\0/g, '');
        }
        if(o && (o.constructor == NodeReference || o.constructor == RelationshipReference)) {
            return clean(o.value());
        }
        if(o) {
            for(let p in o) {
                if(typeof o[p] === "function") {
                    delete o[p];
                    continue;
                }
                if(o[p]) {
                    o[p] = clean(o[p]);
                }
            }
            o.fromNode && (o.fromNode = clean(o.fromNode));
            o.toNode && (o.toNode = clean(o.toNode));
        }
        return o;
    }

    // NodeReference: lightweight proxy for stored node lookup
    function NodeReference(_db, _nodeId) {
        const db = _db;
        const nodeId = _nodeId;
        this.nodeId = function() { return nodeId; };
        this.id = this.nodeId;
        this.getNode = function() { return db.getNodeById(nodeId); };
        this.getObject = function() { return db.getNodeById(nodeId); };
        this.value = function() { return db.getNodeById(nodeId).toObject(); };
        this.getData = this.value;
        this.getProperty = function(propertyKey) {
            return db.getNodeById(nodeId).getLocalProperty(propertyKey);
        };
        this.getProperties = function() { return this.value().getProperties(); };
        this.getLabels = function() { return this.value().getLabels(); };
        this.getKeys = function() { return this.value().getProperties().getKeys(); };
        this.groupByKey = this.nodeId;
    }

    // RelationshipReference: lightweight proxy for stored relationship lookup
    function RelationshipReference(_db, _relationshipId) {
        const db = _db;
        const relationshipId = _relationshipId;
        this.relationshipId = function() { return relationshipId; };
        this.id = this.relationshipId;
        this.getRelationship = function() { return db.getRelationshipById(relationshipId); };
        this.getObject = function() { return db.getRelationshipById(relationshipId); };
        this.value = function() { return db.getRelationshipById(relationshipId).toObject(); };
        this.startNode = function() { return this.getRelationship().getFromNode().get(); };
        this.endNode = function() { return this.getRelationship().getToNode().get(); };
        this.getData = this.value;
        this.getProperty = function(propertyKey) {
            return db.getRelationshipById(relationshipId).getLocalProperty(propertyKey);
        };
        this.getProperties = function() { return this.value().getProperties(); };
        this.getKeys = function() { return this.value().getProperties().getKeys(); };
        this.getType = function() { return this.value().getType(); };
        this.groupByKey = this.relationshipId;
    }

// ── Section 2: Data Layer ─────────────────────────────
// StringRecoder, IDFactory, StoredNode, StoredRelationship,
// PatternNode, PatternRelationship, Pattern, Matcher, DB,
// List, AssociativeArray, Constant, Case, Predicate, FString,
// Table, TableColumn

    // StringRecoder: maps strings to integer codes for fast index lookups
    function StringRecoder() {
        const TrieNode = function() { return [{}, null]; };
        const root = TrieNode();
        let code_factory = 1;
        const CHARS = 0;
        const CODE = 1;
        this.recode = function(_val) {
            if(!_val) return _val;
            let val = _val;
            if(!val.charAt) { val = '' + _val; }
            let n = root, char;
            for(let i=0; i<val.length; i++) {
                char = val.charAt(i);
                if(!n[CHARS][char]) { n[CHARS][char] = TrieNode(); }
                n = n[CHARS][char];
            }
            return n[CODE] || (n[CODE] = code_factory++);
        };
    }

    function IDFactory() {
        let ID = -1;
        this.getId = function() { return ID++; };
    }

    // StoredNode: pure data entity stored in DB.
    // Holds id, labels, properties. No pattern-matching state.
    // db reference retained for NodeReference creation and label index updates.
    function StoredNode(_db) {
        const db = _db;
        let id;
        const labels = {};
        const properties = {};
        const propertyExpressions = {}; // For Setter compatibility

        this.setId = function(_id) { id = _id; };
        this.id = function() { return id; };
        this.getId = function() { return id; };

        this.setLabel = function(name) {
            labels[name] = true;
            if(db && db._addLabelNodeIdLookup) {
                db._addLabelNodeIdLookup(name, id);
            }
        };
        this.hasLabel = function(name) { return labels[name]; };
        this.setLabels = function(_labels) {
            for(const key in _labels) { labels[key] = _labels[key]; }
        };
        this.setLabelsFromObject = function(_labels) { this.setLabels(_labels); };
        this.labels = function() { return labels; };
        this.getLabels = function() { return Object.keys(labels); };
        this.hasLabels = function() { return Object.keys(labels).length > 0; };

        // setProperty stores an expression for Setter use
        this.setProperty = function(key, expression) {
            properties[key] = null;
            propertyExpressions[key] = expression.value;
        };
        this.bindProperty = function(key) {
            properties[key] = propertyExpressions[key]();
        };
        this.setProperties = function(_properties) {
            for(const key in _properties) { properties[key] = _properties[key]; }
        };
        this.getLocalProperty = function(key) {
            return (properties[key] != undefined) ? properties[key] : null;
        };
        this.getProperty = function(key) { return this.getLocalProperty(key); };
        this.getProperties = function() { return Object.create(properties); };
        this.getRawProperties = function() { return properties; };
        this.hasProperties = function() { return Object.keys(properties).length > 0; };

        const NodeInstance = function(nodeInstance) {
            const self = this;
            for(const key in nodeInstance) { this[key] = nodeInstance[key]; }
            this.getId = function() { return self.id; };
            this.getData = function() { return self; };
            this.getObject = function() { return self; };
            this.groupByKey = function() { return self.id; };
            this.groupByValue = function() { return self; };
        };

        this.get = function() {
            return new NodeReference(db, id);
        };
        this.toObject = function() {
            return new NodeInstance({
                id: id,
                labels: this.getLabels(),
                properties: addAssociativeArrayFunctions(properties),
                getProperty: function(k) { return properties[k]; },
                getProperties: function() { return this.properties; },
                getLabels: function() { return this.labels; },
                getKeys: function() { return this.properties.getKeys(); }
            });
        };
        this.toString = function() { return JSON.stringify(this.get()); };

        this.isNode = function() { return true; };
        this.isRelationship = function() { return false; };
        this.type = function() { return this.constructor.name; };

        this.groupByKey = function() { return id; };
        this.groupByValue = function() { return this.get(); };

        // Serializable representation
        this.toSerializable = function() {
            return { id: id, labels: labels, properties: properties };
        };
    }

    // StoredRelationship: pure data entity stored in DB.
    // Stores fromNodeId/toNodeId as numbers; resolves nodes via db reference.
    function StoredRelationship(_db) {
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

        this.setId = function(_id) { id = _id; };
        this.id = function() { return id; };

        this.setStoredType = function(type) { relationshipType = type; };
        this.setType = function(type) { relationshipType = type; };
        this.getType = function() { return relationshipType; };

        this.setProperty = function(key, expression) {
            properties[key] = null;
            propertyExpressions[key] = expression.value;
        };
        this.bindProperty = function(key) {
            properties[key] = propertyExpressions[key]();
        };
        this.setProperties = function(_properties) {
            for(const key in _properties) { properties[key] = _properties[key]; }
        };
        this.getLocalProperty = function(key) {
            return (properties[key] != undefined) ? properties[key] : null;
        };
        this.getProperty = function(key) { return properties[key]; };
        this.getProperties = function() { return properties; };
        this.getRelationshipProperties = function() { return properties; };

        this.setFromNodeId = function(nodeId) { _fromNodeId = nodeId; };
        this.setToNodeId = function(nodeId) { _toNodeId = nodeId; };
        this.setFromNode = function(node) { _fromNodeId = node.id(); };
        this.setToNode = function(node) { _toNodeId = node.id(); };

        this.getFromNode = function(fromNodeId) {
            if(fromNodeId != undefined) {
                if(fromNodeId != _fromNodeId) {
                    return db.getNodeById(_toNodeId);
                }
            }
            return db.getNodeById(_fromNodeId);
        };
        this.getToNode = function(fromNodeId) {
            if(fromNodeId != undefined) {
                if(fromNodeId != _fromNodeId) {
                    return db.getNodeById(_fromNodeId);
                }
            }
            return db.getNodeById(_toNodeId);
        };

        // Expose raw IDs for index operations
        Object.defineProperty(this, 'fromNodeId', { get: function() { return _fromNodeId; } });
        Object.defineProperty(this, 'toNodeId',   { get: function() { return _toNodeId; } });

        this.setLeftDirection = function(ld) { _leftDirection = ld; };
        this.setRightDirection = function(rd) { _rightDirection = rd; };

        this.leftDirection = function(fromNodeId) {
            if(fromNodeId != undefined) {
                if(fromNodeId != _fromNodeId) { return !_leftDirection && _rightDirection; }
            }
            return _leftDirection && !_rightDirection;
        };
        this.leftDirectionRaw = function() { return _leftDirection; };
        this.rightDirection = function(fromNodeId) {
            if(fromNodeId != undefined) {
                if(fromNodeId != _fromNodeId) { return !_rightDirection && _leftDirection; }
            }
            return _rightDirection && !_leftDirection;
        };
        this.rightDirectionRaw = function() { return _rightDirection; };
        this.uniDirectional = function() {
            return (_rightDirection && _leftDirection) || (!_leftDirection && !_rightDirection);
        };
        this.noDirection = function() { return !_leftDirection && !_rightDirection; };
        this.direction = function() {
            const l = this.leftDirection(), r = this.rightDirection();
            if(l && !r) return "left";
            if(!l && r) return "right";
            if(l && r) return "both";
            return "none";
        };

        this.isAdded = function() { return isAdded; };
        this.setIsAdded = function() { isAdded = true; };

        this.isRelationship = function() { return true; };
        this.isNode = function() { return false; };
        this.type = function() { return this.constructor.name; };

        const RelationshipInstance = function(ri) {
            for(const key in ri) { this[key] = ri[key]; }
            this.getId = function() { return this.id; };
            this.getData = function() { return this; };
            this.getObject = function() { return this; };
            this.groupByKey = function() { return this.id; };
            this.groupByValue = function() { return this; };
        };

        this.get = function() { return new RelationshipReference(db, id); };
        this.toObject = function() {
            const fromNode = this.getFromNode();
            const toNode = this.getToNode();
            return new RelationshipInstance({
                id: id,
                type: relationshipType,
                properties: addAssociativeArrayFunctions(properties),
                fromNode: (fromNode ? fromNode.get() : null),
                toNode: (toNode ? toNode.get() : null),
                direction: this.direction(),
                getProperty: function(k) { return properties[k]; },
                getProperties: function() { return properties; },
                getKeys: function() { return addAssociativeArrayFunctions(properties).getKeys(); },
                getType: function() { return relationshipType; }
            });
        };
        this.toString = function() {
            let direction = "none";
            if(this.leftDirection()) direction = "left";
            else if(this.rightDirection()) direction = "right";
            return "id: " + id +
                ". type: " + relationshipType +
                ". properties: " + JSON.stringify(properties) +
                ". fromNodeId: " + _fromNodeId +
                ". toNodeId: " + _toNodeId +
                ". direction: " + direction;
        };
        this.value = function() { return this.get(); };

        this.toSerializable = function() {
            return {
                id: id, type: relationshipType, properties: properties,
                fromNodeId: _fromNodeId, toNodeId: _toNodeId,
                leftDirection: _leftDirection, rightDirection: _rightDirection
            };
        };
    }

    // PatternNode: used during parsing and query execution.
    // Holds pattern-matching state and delegates DB operations to db.
    // copy() creates a StoredNode.
    function PatternNode(_db) {
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

        this.setPreviousObject = function(object) { previousObject = object; };
        this.getPreviousObject = function() { return previousObject; };
        this.setNextObject = function(object) { nextObject = object; };
        this.getNextObject = function() { return nextObject; };
        this.setPattern = function(_pattern) { pattern = _pattern; };
        this.getPattern = function() { return pattern; };

        this.nextNode = function() {
            if(me.getNextObject()) {
                if(me.getNextObject().isRelationship()) return me.getNextObject().getNextObject();
                else if(me.getNextObject().isNode()) return me.getNextObject();
            }
            return null;
        };
        this.previousNode = function() {
            if(me.getPreviousObject()) {
                if(me.getPreviousObject().isRelationship()) return me.getPreviousObject().getPreviousObject();
                else if(me.getPreviousObject().isNode()) return me.getPreviousObject();
            }
            return null;
        };
        this.incomingRelationship = function() {
            if(me.getPreviousObject() && me.getPreviousObject().isRelationship()) return me.getPreviousObject();
            return null;
        };
        this.outgoingRelationship = function() {
            if(me.getNextObject() && me.getNextObject().isRelationship()) return me.getNextObject();
            return null;
        };

        this.setId = function(_id) { id = _id; };
        this.id = function() { return id; };
        this.getId = function() { return id; };

        this.setProperty = function(key, expression) {
            properties[key] = null;
            propertyExpressions[key] = expression.value;
        };
        this.setProperties = function(_properties) {
            for(const key in _properties) { properties[key] = _properties[key]; }
        };
        this.bindProperty = function(key) { properties[key] = propertyExpressions[key](); };
        this.bindProperties = function() {
            for(const key in properties) { this.bindProperty(key); }
        };
        this.setLabel = function(labelName) { labels[labelName] = true; };
        this.hasLabel = function(labelName) { return labels[labelName]; };
        this.setLabels = function(_labels) {
            for(const label in _labels) { labels[label] = _labels[label]; }
        };
        this.setVariableKey = function(_variableKey) { variableKey = _variableKey; };
        this.getVariableKey = function() { return variableKey; };
        this.hasVariableKey = function() { return variableKey != undefined; };
        this.getProperties = function() { return Object.create(properties); };
        this.getRawProperties = function() { return properties; };
        this.labels = function() { return labels; };
        this.getLabels = function() { return Object.keys(labels); };
        this.hasLabels = function() { return Object.keys(labels).length > 0; };
        this.hasProperties = function() { return Object.keys(properties).length > 0; };
        this.getLocalProperty = function(key) { return properties[key] || null; };
        this.getProperty = function(key) {
            const n = db.getNodeById(matchedNode);
            if(!n) return null;
            return n.getLocalProperty(key);
        };

        this.get = function(asKey) {
            if(asKey) return id;
            return new NodeReference(db, id);
        };
        this.toObject = function() {
            return db.getNodeById(matchedNode) ? db.getNodeById(matchedNode).toObject() : null;
        };
        this.toString = function() { return JSON.stringify(this.get()); };
        this.type = function() { return this.constructor.name; };

        this.isRelationship = function() { return false; };
        this.isNode = function() { return true; };

        this.setReferredNode = function(_referredNode) { referredNode = _referredNode; };
        this.isReferred = function() { return referredNode != null; };
        this.getReferredNode = function() { return referredNode; };

        this.setExpandedIsMatched = function() { expandedIsMatched = true; };
        this.expandedIsMatched = function() {
            if(expandedIsMatched) { expandedIsMatched = false; return true; }
            return false;
        };
        this.setExpandedNode = function(_expandedNode) { expandedNode = _expandedNode; };
        this.isExpanded = function() { return expandedNode != null; };
        this.getExpandedNode = function() { return expandedNode; };

        this.nextAction = function() { ; };
        this.setNextAction = function(f) { this.nextAction = f; };

        this.convey = function(merge, pathExpansionDepth) {
            return db.matchNode(me, merge, pathExpansionDepth);
        };
        this.create = function() { return db.createNode(me); };
        this.merge = function() { return db.mergeNode(me); };
        this.match = function() { return db.matchNodes(me); };

        let matchedNode;
        let matchedIncomingRelationshipIds = {};

        this.addMatchedNode = function(node) { matchedNode = node.id(); };
        this.getMatchedNode = function() { return this.getData(); };
        this.addMatchedIncomingRelationshipId = function(nodeId, matchedIncomingRelationshipId) {
            if(!matchedIncomingRelationshipIds[nodeId]) matchedIncomingRelationshipIds[nodeId] = [];
            matchedIncomingRelationshipIds[nodeId].push(matchedIncomingRelationshipId);
        };
        this.getMatchedIncomingRelationshipIds = function(nodeId) {
            if(!matchedIncomingRelationshipIds[nodeId]) return null;
            const ids = matchedIncomingRelationshipIds[nodeId];
            matchedIncomingRelationshipIds[nodeId] = [];
            return ids;
        };

        this.getData = function() { return db.getNodeById(matchedNode); };
        this.groupByKey = function() { return this.getData().id(); };
        this.groupByValue = function() { return this.getData().get(); };

        // copy() creates a StoredNode — the persistence-ready entity stored in DB
        this.copy = function() {
            const n = new StoredNode(db);
            n.setLabels(labels);
            n.setProperties(properties);
            return n;
        };

        this.mappable = function() {
            if(referredNode) {
                if(referredNode.mappable && !referredNode.mappable()) return false;
            }
            for(const propertyKey in properties) {
                if(!propertyExpressions[propertyKey].mappable()) return false;
            }
            return true;
        };
    }

    // PatternRelationship: used during parsing and query execution.
    // Holds pattern-matching state. copy() creates a StoredRelationship.
    function PatternRelationship(_db) {
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

        this.setPreviousObject = function(object) { previousObject = object; };
        this.getPreviousObject = function() { return previousObject; };
        this.setNextObject = function(object) { nextObject = object; };
        this.getNextObject = function() { return nextObject; };
        this.setPattern = function(_pattern) { pattern = _pattern; };
        this.getPattern = function() { return pattern; };

        this.setId = function(_id) { id = _id; };
        this.id = function() { return id; };
        this.setStoredType = function(_type) { relationshipType = _type; };
        this.setType = function(_type) { relationshipType = _type; };
        this.getType = function() { return relationshipType; };

        this.setProperty = function(key, expression) {
            properties[key] = null;
            propertyExpressions[key] = expression.value;
        };
        this.bindProperty = function(key) { properties[key] = propertyExpressions[key](); };
        this.bindProperties = function() {
            for(const key in properties) { this.bindProperty(key); }
        };
        this.setProperties = function(_properties) {
            for(const key in _properties) { properties[key] = _properties[key]; }
        };
        this.getProperty = function(key) { return properties[key]; };
        this.getProperties = function() { return properties; };
        this.getRelationshipProperties = function() { return properties; };

        this.setFromNode = function(node) { fromNode = node; };
        this.setToNode = function(node) { toNode = node; };
        this.getFromNode = function(fromNodeId) {
            if(fromNodeId != undefined) {
                if(fromNodeId != fromNode.id()) return toNode;
            }
            return fromNode;
        };
        this.getToNode = function(fromNodeId) {
            if(fromNodeId != undefined) {
                if(fromNodeId != fromNode.id()) return fromNode;
            }
            return toNode;
        };

        this.setLeftDirection = function(ld) { leftDirection = ld; };
        this.setRightDirection = function(rd) { rightDirection = rd; };
        this.leftDirection = function(fromNodeId) {
            if(fromNodeId != undefined) {
                if(fromNodeId != fromNode.id()) return !leftDirection && rightDirection;
            }
            return leftDirection && !rightDirection;
        };
        this.rightDirection = function(fromNodeId) {
            if(fromNodeId != undefined) {
                if(fromNodeId != fromNode.id()) return !rightDirection && leftDirection;
            }
            return rightDirection && !leftDirection;
        };
        this.uniDirectional = function() {
            return (rightDirection && leftDirection) || (!leftDirection && !rightDirection);
        };
        this.noDirection = function() { return !leftDirection && !rightDirection; };
        this.direction = function() {
            const l = this.leftDirection(), r = this.rightDirection();
            if(l && !r) return "left";
            if(!l && r) return "right";
            if(l && r) return "both";
            return "none";
        };
        this.type = function() { return this.constructor.name; };
        this.isRelationship = function() { return true; };
        this.isNode = function() { return false; };

        this.setReferredRelationship = function(rr) { referredRelationship = rr; };
        this.isReferred = function() { return referredRelationship != null; };
        this.getReferredRelationship = function() { return referredRelationship; };

        this.isAdded = function() { return isAdded; };
        this.setIsAdded = function() { isAdded = true; };
        this.setHasVariablePathLength = function() {
            hasVariablePathLength = true;
            pathLengthFrom = null;
            pathLengthTo = null;
        };
        this.hasVariablePathLength = function() { return hasVariablePathLength; };
        this.setPathLengthFrom = function(v) { pathLengthFrom = v; };
        this.pathLengthFrom = function() { return pathLengthFrom; };
        this.setPathLengthTo = function(v) { pathLengthTo = v; };
        this.pathLengthTo = function() { return pathLengthTo; };
        this.expandPath = function() { return hasVariablePathLength; };

        const RelationshipInstance = function(ri) {
            for(const key in ri) { this[key] = ri[key]; }
            this.getId = function() { return this.id; };
            this.getData = function() { return this; };
            this.getObject = function() { return this; };
            this.groupByKey = function() { return this.id; };
            this.groupByValue = function() { return this; };
        };

        this.get = function() { return new RelationshipReference(db, id); };
        this.toObject = function() {
            return new RelationshipInstance({
                id: id,
                type: relationshipType,
                properties: addAssociativeArrayFunctions(properties),
                fromNode: (fromNode ? fromNode.get() : null),
                toNode: (toNode ? toNode.get() : null),
                direction: this.direction(),
                getProperty: function(k) { return properties[k]; },
                getProperties: function() { return properties; },
                getKeys: function() { return addAssociativeArrayFunctions(properties).getKeys(); },
                getType: function() { return relationshipType; }
            });
        };
        this.toString = function() {
            return "id: " + id + ". type: " + relationshipType +
                ". properties: " + JSON.stringify(properties) +
                ". fromNodeId: " + (fromNode ? fromNode.id() : null) +
                ". toNodeId: " + (toNode ? toNode.id() : null) +
                ". direction: " + this.direction();
        };
        this.value = function() { return this.get(); };

        this.setVariableKey = function(_variableKey) { variableKey = _variableKey; };
        this.getVariableKey = function() { return variableKey; };
        this.hasVariableKey = function() { return variableKey != undefined; };
        this.nextAction = function() { ; };
        this.setNextAction = function(f) { this.nextAction = f; };

        let matchedRelationship;
        let expandedPath = [];
        let pathList = [];
        let visitedNodes = {};
        let matchingRelationshipsIds;
        let expandedEndNode = null;

        const updateVisitedNodes = function(nodeId) {
            visitedNodes[nodeId] = (visitedNodes[nodeId] || 0) + 1;
        };
        const updateVisitedRelationships = function(path) {
            if(expandedPath.length == 0) updateVisitedNodes(path.fromNodeId);
            updateVisitedNodes(path.toNodeId);
        };

        this.visitedBefore = function(nodeId) {
            if(expandedPath.length > 1) {
                if(expandedPath[expandedPath.length-1] == expandedPath[expandedPath.length-2]) return true;
            }
            return visitedNodes[nodeId] >= 2;
        };
        this.setMatchedRelationship = function(relationship) {
            matchedRelationship = relationship.id();
        };
        this.addMatchedRelationship = function(relationship, path) {
            if(hasVariablePathLength) {
                expandedPath.push(relationship.id());
                pathList.push(path);
                updateVisitedRelationships(path);
            } else {
                this.setMatchedRelationship(relationship);
            }
        };
        this.getMatchedRelationship = function() { return this.getData(); };
        this.hasExpandedEndNode = function() { return expandedEndNode != null; };
        this.setExpandedEndNode = function(n) { expandedEndNode = n; };
        this.getExpandedEndNode = function() { return expandedEndNode; };
        this.setMatchingRelationshipIds = function(ids) { matchingRelationshipsIds = ids; };
        this.getMatchingRelationshipIds = function() {
            let r = null;
            if(matchingRelationshipsIds) r = matchingRelationshipsIds.slice();
            matchingRelationshipsIds = null;
            return r;
        };
        this.expandedPathLastItem = function() { return expandedPath[expandedPath.length-1]; };
        this.backTrackExpandedPath = function() {
            if(expandedPath.length == 0) return;
            expandedPath.pop();
            const path = pathList.pop();
            if(expandedPath.length == 0) { visitedNodes = {}; }
            else { visitedNodes[path.toNodeId]--; }
        };
        this.resetExpandedPath = function() {
            expandedPath = [];
            pathList = [];
            visitedNodes = {};
        };
        this.pathLengthFromSatisfied = function() {
            return !this.expandPath() || (pathLengthFrom == null) || (pathLengthFrom && expandedPath.length >= pathLengthFrom);
        };
        this.pathLengthToSatisfied = function() {
            return !this.expandPath() || (pathLengthTo == null) || (pathLengthTo && expandedPath.length <= pathLengthTo);
        };
        this.pathLengthSatisfied = function() {
            return this.pathLengthFromSatisfied() && this.pathLengthToSatisfied();
        };
        this.getExpandedPath = function() { return expandedPath; };
        this.setShortestPath = function(sp) { expandedPath = sp; };

        this.getData = function() {
            if(hasVariablePathLength) {
                return new List(expandedPath, function(relationshipId) {
                    return db.getRelationshipById(relationshipId).value();
                });
            }
            return db.getRelationshipById(matchedRelationship);
        };
        this.getLocalProperty = function(key) { return properties[key] || null; };
        this.getProperty = function(key) {
            const r = db.getRelationshipById(matchedRelationship);
            if(!r) return null;
            return r.getLocalProperty(key);
        };
        this.groupByKey = function() { return this.getData().id(); };
        this.groupByValue = function() { return this.getData().get(); };

        // copy() creates a StoredRelationship — the persistence-ready entity
        this.copy = function() {
            const r = new StoredRelationship(db);
            r.setStoredType(relationshipType);
            r.setProperties(properties);
            r.setLeftDirection(leftDirection);
            r.setRightDirection(rightDirection);
            r.setFromNode(fromNode);
            r.setToNode(toNode);
            return r;
        };

        this.mappable = function() {
            if(referredRelationship) {
                if(referredRelationship.mappable && !referredRelationship.mappable()) return false;
            }
            for(const propertyKey in properties) {
                if(!propertyExpressions[propertyKey].mappable()) return false;
            }
            return true;
        };
    }

    function Pattern() {
        const objects = [];
        const nodes = [];
        const relationships = [];
        const me = this;
        let usedAsCondition = false;
        let findShortestPath = false;
        let shortestPathLength = Number.MAX_SAFE_INTEGER;
        let shortestPath;

        const addObject = function(object) {
            if(!me.empty()) {
                me.lastObject().setNextObject(object);
                object.setPreviousObject(me.lastObject());
            }
            object.setPattern(me);
            objects.push(object);
        };
        const processShortestPath = function() {
            if(relationships[0].getExpandedPath().length < shortestPathLength) {
                shortestPathLength = relationships[0].getExpandedPath().length;
                shortestPath = relationships[0].getExpandedPath().slice();
            }
        };

        this.shortestpath = function() { findShortestPath = true; };
        this.addNode = function(node) { nodes.push(node); addObject(node); };
        this.addRelationship = function(relationship) { relationships.push(relationship); addObject(relationship); };
        this.nodeCount = function() { return nodes.length; };
        this.relationshipCount = function() { return relationships.length; };

        this.getData = function() {
            let d = [], r, relationshipList;
            const groupByKey = [];
            for(let i=0; i<relationships.length; i++) {
                if(!relationships[i].hasVariablePathLength()) {
                    r = relationships[i].getData().value().getRelationship();
                    d.push(r.getFromNode().get(), r.get(), r.getToNode().get());
                    groupByKey.push(r.id());
                } else {
                    relationshipList = relationships[i].getData().value();
                    for(let j=0; j<relationshipList.length; j++) {
                        r = relationshipList[j].getRelationship();
                        d.push(r.getFromNode().get(), r.get(), r.getToNode().get());
                        groupByKey.push(r.id());
                    }
                }
            }
            d = addArrayFunctions(d);
            d.getNodes = function() {
                const ns = [];
                for(let i=0; i<d.length; i+=3) {
                    if(i==0) ns.push(d[i]);
                    ns.push(d[i+2]);
                }
                return addArrayFunctions(ns);
            };
            d.getRelationships = function() {
                const rs = [];
                for(let i=0; i<d.length; i+=3) { rs.push(d[i+1]); }
                return addArrayFunctions(rs);
            };
            this.groupByKey = function() { return groupByKey; };
            this.groupByValue = function() { return d; };
            return d;
        };

        this.objects = function() { return objects; };
        this.getObject = function(index) { return objects[index]; };
        this.lastObject = function() { return objects[objects.length-1]; };
        this.getLast = this.lastObject;
        this.empty = function() { return objects.length == 0; };

        this.setNextAction = function(f) { nextAction = f; };
        let nextAction = function() { ; };

        this.finish = function() {
            if(findShortestPath) {
                relationships[0].setShortestPath(shortestPath);
                nextAction();
            }
        };
        const initialiseConveyorBelt = function() {
            me.lastObject().setNextAction(function() {
                if(!findShortestPath) { nextAction(); }
                else { processShortestPath(); }
            });
        };
        this.useAsCondition = function() {
            usedAsCondition = true;
            me.lastObject().setNextAction(function() { return true; });
        };
        this.usedAsCondition = function() { return usedAsCondition; };
        this.value = function() { return nodes[0].convey(false); };
        this.match = function() { initialiseConveyorBelt(); nodes[0].convey(false); };
        this.merge = function() { initialiseConveyorBelt(); nodes[0].convey(true); };
        this.create = function() { initialiseConveyorBelt(); nodes[0].create(); };

        this.mappable = function() {
            for(let i=0; i<objects.length; i++) {
                if(!objects[i].mappable()) return false;
            }
            return true;
        };
        this.type = function() { return this.constructor.name; };
    }

    // Matcher: helper for set-based node/relationship matching
    function Matcher() {
        let toMatchCount = 0;
        let idsMatchCount = [];
        let matchingSet = [];
        this.setMatchingSet = function(_matchingSet, initialMatchCount) {
            matchingSet = _matchingSet;
            idsMatchCount = new Array(matchingSet.length).fill(
                initialMatchCount != undefined ? initialMatchCount : 1
            );
        };
        this.addToMatchingSet = function(id) {
            matchingSet.push(parseInt(id));
            idsMatchCount.push(0);
        };
        this.updateMatchingSet = function() {
            let carryOverCount = 0;
            for(let i=0; i<matchingSet.length; i++) {
                if(idsMatchCount[i] == toMatchCount) carryOverCount++;
            }
            const newMatchingSet = new Array(carryOverCount);
            let new_i = 0;
            for(let i=0; i<matchingSet.length; i++) {
                if(idsMatchCount[i] == toMatchCount) newMatchingSet[new_i++] = matchingSet[i];
            }
            matchingSet = newMatchingSet;
            idsMatchCount = new Array(matchingSet.length).fill(toMatchCount);
        };
        this.incrementToMatchCount = function() { toMatchCount++; };
        this.keepMatchTally = function(id) {
            for(let i=0; i<matchingSet.length; i++) {
                if(matchingSet[i] == id) idsMatchCount[i] = (idsMatchCount[i] + 1 || 1);
            }
        };
        this.toMatchCount = function() { return toMatchCount; };
        this.matchingSet = function() { return matchingSet; };
        this.matchingSetSize = function() { return matchingSet.length; };
    }

    // DB: in-memory graph store.
    // Uses statsCallback pattern to decouple from engine.
    // Provides exportData()/importData() for persistence readiness.
    function DB(statsCallback) {
        const self = this;
        let nodes = [];
        let NODE_ID_FACTORY = 0;
        let nodeIdLookup = {};
        let labelNodeIdLookup = {};
        let relationships = [];
        let RELATIONSHIP_ID_FACTORY = 0;
        let relationshipLookup = {};
        let relationshipIdsByNodeIdLookup = {};
        let relationshipIdsByNodeIdLookupIncoming = {};
        let relationshipIdLookup = {};
        let typeRelationshipIdLookup = {};
        const tables = {};
        let stringRecoder = new StringRecoder();

        const recode = function(val) { return stringRecoder.recode(val); };

        // ── Index management ──────────────────────────────
        const initializeRelationshipLookup = function(fromNodeId, toNodeId) {
            if(fromNodeId != undefined) {
                if(!relationshipLookup[fromNodeId]) relationshipLookup[fromNodeId] = {};
                if(toNodeId != undefined && !relationshipLookup[fromNodeId][toNodeId]) {
                    relationshipLookup[fromNodeId][toNodeId] = [];
                }
            }
        };
        const lookupRelationships = function(fromNodeId, toNodeId) {
            initializeRelationshipLookup(fromNodeId, toNodeId);
            if(fromNodeId != undefined) {
                if(toNodeId != undefined) return relationshipLookup[fromNodeId][toNodeId];
                else {
                    let ids = [];
                    for(const nodeId in relationshipLookup[fromNodeId]) {
                        ids = ids.concat(relationshipLookup[fromNodeId][nodeId]);
                    }
                    return ids;
                }
            }
            return [];
        };
        const addLookupRelationship = function(fromNodeId, toNodeId, relationshipId) {
            initializeRelationshipLookup(fromNodeId, toNodeId);
            relationshipLookup[fromNodeId][toNodeId].push(relationshipId);
            addLookupRelationshipIdsByNodeId(fromNodeId, relationshipId);
            addLookupRelationshipIdsByNodeIdIncoming(toNodeId, relationshipId);
        };
        const initializeRelationshipIdsByNodeIdLookup = function(nodeId) {
            if(!relationshipIdsByNodeIdLookup[nodeId]) relationshipIdsByNodeIdLookup[nodeId] = [];
        };
        const lookupRelationshipIdsByNodeId = function(nodeId) {
            initializeRelationshipIdsByNodeIdLookup(nodeId);
            return relationshipIdsByNodeIdLookup[nodeId];
        };
        const addLookupRelationshipIdsByNodeId = function(nodeId, relationshipId) {
            initializeRelationshipIdsByNodeIdLookup(nodeId);
            relationshipIdsByNodeIdLookup[nodeId].push(relationshipId);
        };
        const initializeRelationshipIdsByNodeIdLookupIncoming = function(nodeId) {
            if(!relationshipIdsByNodeIdLookupIncoming[nodeId]) relationshipIdsByNodeIdLookupIncoming[nodeId] = [];
        };
        const lookupRelationshipIdsByNodeIdIncoming = function(nodeId) {
            initializeRelationshipIdsByNodeIdLookupIncoming(nodeId);
            return relationshipIdsByNodeIdLookupIncoming[nodeId];
        };
        const addLookupRelationshipIdsByNodeIdIncoming = function(nodeId, relationshipId) {
            initializeRelationshipIdsByNodeIdLookupIncoming(nodeId);
            relationshipIdsByNodeIdLookupIncoming[nodeId].push(relationshipId);
        };
        const initializeNodeIdLookup = function(key, value) {
            if(!nodeIdLookup[key]) nodeIdLookup[key] = {};
            if(!nodeIdLookup[key][value]) nodeIdLookup[key][value] = [];
        };
        const lookupNodeIds = function(_key, _value) {
            const key = recode(_key), value = recode(_value);
            initializeNodeIdLookup(key, value);
            return nodeIdLookup[key][value];
        };
        const initializeRelationshipIdLookup = function(key, value) {
            if(!relationshipIdLookup[key]) relationshipIdLookup[key] = {};
            if(!relationshipIdLookup[key][value]) relationshipIdLookup[key][value] = [];
        };
        const addLookupNodeId = function(_key, _value, nodeId) {
            const key = recode(_key), value = recode(_value);
            initializeNodeIdLookup(key, value);
            nodeIdLookup[key][value].push(nodeId);
        };
        const addLookupRelationshipId = function(_key, _value, relationshipId) {
            const key = recode(_key), value = recode(_value);
            initializeRelationshipIdLookup(key, value);
            relationshipIdLookup[key][value].push(relationshipId);
        };
        const initializeLabelNodeIdLookup = function(label) {
            if(!labelNodeIdLookup[label]) labelNodeIdLookup[label] = [];
        };
        const lookupLabelNodeIds = function(_label) {
            const label = recode(_label);
            initializeLabelNodeIdLookup(label);
            return labelNodeIdLookup[label];
        };
        const initializeTypeRelationshipIdLookup = function(type) {
            if(!typeRelationshipIdLookup[type]) {
                typeRelationshipIdLookup[type] = [];
                return false;
            }
        };
        const addLabelNodeIdLookup = function(_label, nodeId) {
            const label = recode(_label);
            initializeLabelNodeIdLookup(label);
            const equalsCheck = function(el) { return el == nodeId; };
            if(nodeId != undefined && !labelNodeIdLookup[label].find(equalsCheck)) {
                labelNodeIdLookup[label].push(nodeId);
            }
        };
        this._addLabelNodeIdLookup = function(_label, nodeId) { addLabelNodeIdLookup(_label, nodeId); };

        const addTypeRelationshipIdLookup = function(_type, relationshipId) {
            if(relationshipId == undefined) return;
            const type = recode(_type);
            initializeTypeRelationshipIdLookup(type);
            const equalsCheck = function(el) { return el == relationshipId; };
            if(!typeRelationshipIdLookup[type].find(equalsCheck)) {
                typeRelationshipIdLookup[type].push(relationshipId);
                relationships[relationshipId].setStoredType(_type);
            }
        };
        this._addTypeRelationshipIdLookup = function(_type, relationshipId) {
            addTypeRelationshipIdLookup(_type, relationshipId);
        };

        // ── Internal add operations ───────────────────────
        const getFreeNodeId = function() {
            while(nodes[NODE_ID_FACTORY]) NODE_ID_FACTORY++;
            return NODE_ID_FACTORY;
        };
        const addNode = function(node, givenId) {
            if(!givenId) {
                node.setId(getFreeNodeId());
                nodes[node.id()] = node;
            } else {
                if(nodes[givenId]) throw "Node with ID " + givenId + " already exists in the database.";
                node.setId(givenId);
                nodes[givenId] = node;
            }
            for(const key in node.getRawProperties()) {
                addLookupNodeId(key, node.getLocalProperty(key), node.id());
            }
            for(const label in node.labels()) {
                addLabelNodeIdLookup(label, node.id());
            }
            if(statsCallback && statsCallback.onNodeAdded) statsCallback.onNodeAdded();
        };
        const getFreeRelationshipId = function() {
            while(relationships[RELATIONSHIP_ID_FACTORY]) RELATIONSHIP_ID_FACTORY++;
            return RELATIONSHIP_ID_FACTORY;
        };
        const addRelationship = function(relationship, givenId) {
            let relationshipId = null;
            if(!givenId) {
                relationshipId = getFreeRelationshipId();
            } else {
                if(nodes[givenId]) throw "Relationship with ID " + givenId + " already exists in the database.";
                relationshipId = givenId;
            }
            relationship.setId(relationshipId);
            relationships[relationshipId] = relationship;
            addLookupRelationship(
                relationship.getFromNode().id(),
                relationship.getToNode().id(),
                relationship.id()
            );
            if(relationship.getToNode().id() != relationship.getFromNode().id()) {
                addLookupRelationship(
                    relationship.getToNode().id(),
                    relationship.getFromNode().id(),
                    relationship.id()
                );
            }
            for(const key in relationship.getProperties()) {
                addLookupRelationshipId(key, relationship.getProperty(key), relationship.id());
            }
            addTypeRelationshipIdLookup(relationship.getType(), relationship.id());
            relationship.setIsAdded();
            if(statsCallback && statsCallback.onRelationshipAdded) statsCallback.onRelationshipAdded();
        };

        // ── Relationship matching ─────────────────────────
        const relationshipMatch = function(relationship, fromNode, toNode) {
            let relationshipIds = [];
            let relationshipIdsFromLookup;

            if(!relationship.isReferred()) {
                if(fromNode && toNode) {
                    relationshipIdsFromLookup = lookupRelationships(fromNode.id(), toNode.id());
                    relationshipIds = relationshipIds.concat(relationshipIdsFromLookup);
                } else if(fromNode && !toNode) {
                    relationshipIdsFromLookup = lookupRelationshipIdsByNodeId(fromNode.id());
                    if(relationship.uniDirectional()) {
                        relationshipIdsFromLookup.concat(lookupRelationshipIdsByNodeIdIncoming(fromNode.id()));
                    }
                    relationshipIds = relationshipIds.concat(relationshipIdsFromLookup);
                }
            } else {
                const referredRelationship = relationship.getReferredRelationship().getData();
                if(referredRelationship) {
                    if(!(referredRelationship.constructor == StoredRelationship ||
                        referredRelationship.constructor == RelationshipReference)) {
                        throw "Expected relationship.";
                    }
                } else {
                    throw "Expected relationship.";
                }
                relationshipIds.push(referredRelationship.id());
            }

            if(relationshipIds.length == 0) return false;

            const matcher = new Matcher();
            matcher.setMatchingSet(relationshipIds, 0);

            if(relationship.leftDirection() || relationship.rightDirection()) matcher.incrementToMatchCount();
            if(relationship.getType()) matcher.incrementToMatchCount();
            for(const key in relationship.getProperties()) matcher.incrementToMatchCount();

            if(matcher.toMatchCount() > 0) {
                let dbRelationship;
                for(let i=0; i<relationshipIds.length; i++) {
                    dbRelationship = relationships[relationshipIds[i]];
                    if(relationship.leftDirection() || relationship.rightDirection()) {
                        if(relationship.leftDirection() == dbRelationship.leftDirection(fromNode.id()) ||
                            relationship.rightDirection() == dbRelationship.rightDirection(fromNode.id())) {
                            matcher.keepMatchTally(relationshipIds[i]);
                        }
                    }
                    if(relationship.getType()) {
                        if(dbRelationship.getType() && dbRelationship.getType() == relationship.getType()) {
                            matcher.keepMatchTally(relationshipIds[i]);
                        }
                    }
                    for(const key in relationship.getProperties()) {
                        if(relationship.getLocalProperty(key) == dbRelationship.getLocalProperty(key)) {
                            matcher.keepMatchTally(relationshipIds[i]);
                        }
                    }
                }
                matcher.updateMatchingSet();
            }

            if(matcher.matchingSetSize() == 0) return false;
            return matcher.matchingSet();
        };

        // ── Node creation ─────────────────────────────────
        this.createNode = function(node) {
            let nodeInstance;
            if(node.isReferred()) {
                nodeInstance = node.getReferredNode().getData();
                if(nodeInstance.constructor == Unwind) nodeInstance = nodeInstance.value();
                if(nodeInstance.constructor == NodeReference) nodeInstance = self.getNodeById(nodeInstance.nodeId());
            } else {
                node.bindProperties();
                nodeInstance = node.copy(); // Returns StoredNode
                addNode(nodeInstance);
                node.addMatchedNode(nodeInstance);
            }
            if(node.outgoingRelationship()) node.outgoingRelationship().setFromNode(nodeInstance);
            if(node.incomingRelationship()) {
                node.incomingRelationship().bindProperties();
                node.incomingRelationship().setToNode(nodeInstance);
                const relationshipToAdd = node.incomingRelationship().copy(); // Returns StoredRelationship
                addRelationship(relationshipToAdd);
                node.incomingRelationship().addMatchedRelationship(relationshipToAdd);
            }
            if(node.nextNode()) { node.nextNode().create(); }
            else { node.nextAction(); }
        };

        // ── Node matching ─────────────────────────────────
        const matchNodeProperties = function(node, matcher) {
            for(const key in node.getProperties()) {
                node.bindProperty(key);
                if(matcher.toMatchCount() == 0 && matcher.matchingSetSize() == 0) {
                    const nodeIds = lookupNodeIds(key, node.getLocalProperty(key));
                    if(nodeIds) matcher.setMatchingSet(nodeIds);
                } else if(matcher.matchingSetSize() > 0) {
                    for(let i=0; i<matcher.matchingSetSize(); i++) {
                        if(node.getLocalProperty(key) == nodes[matcher.matchingSet()[i]].getLocalProperty(key)) {
                            matcher.keepMatchTally(matcher.matchingSet()[i]);
                        }
                    }
                }
                matcher.incrementToMatchCount();
                matcher.updateMatchingSet();
            }
        };

        const matchNodeLabels = function(node, matcher) {
            for(const label in node.labels()) {
                if(matcher.toMatchCount() == 0 && matcher.matchingSetSize() == 0) {
                    const nodeIds = lookupLabelNodeIds(label);
                    if(nodeIds) matcher.setMatchingSet(nodeIds);
                } else if(matcher.matchingSetSize() > 0) {
                    for(let i=0; i<matcher.matchingSetSize(); i++) {
                        if(nodes[matcher.matchingSet()[i]].hasLabel(label)) {
                            matcher.keepMatchTally(matcher.matchingSet()[i]);
                        }
                    }
                }
                matcher.incrementToMatchCount();
                matcher.updateMatchingSet();
            }
        };

        const conveyorBelt = function(node, merge, _pathExpansionDepth) {
            if(node.nextNode()) {
                if(node.getPattern().usedAsCondition()) return node.nextNode().convey(merge, _pathExpansionDepth);
                else node.nextNode().convey(merge, _pathExpansionDepth);
            } else {
                if(node.getPattern().usedAsCondition()) return node.nextAction();
                else node.nextAction();
            }
        };

        const processNodeMatcher = function(matcher) {
            let nodeIdsForConveyorBelt = [];
            if(matcher.matchingSetSize() > 0) {
                nodeIdsForConveyorBelt = matcher.matchingSet();
            } else if(matcher.toMatchCount() == 0) {
                nodeIdsForConveyorBelt = new Array(nodes.length);
                for(let i=0; i<nodes.length; i++) {
                    nodeIdsForConveyorBelt[i] = nodes[i].id();
                }
            }
            return nodeIdsForConveyorBelt;
        };

        const getMatchingNodeIds = function(node, merge) {
            let nodeIdsForConveyorBelt = [];
            if(!node.isExpanded()) {
                const matcher = new Matcher();
                if(node.isReferred()) {
                    let referredNode = node.getReferredNode().getData();
                    if(referredNode.constructor == Unwind) referredNode = referredNode.value();
                    if(referredNode) {
                        if(!(referredNode.constructor == StoredNode ||
                            referredNode.constructor == NodeReference)) {
                            throw "Expected node.";
                        }
                    } else {
                        throw "Expected node.";
                    }
                    matcher.addToMatchingSet(referredNode.id());
                }
                if(node.incomingRelationship()) {
                    if(node.incomingRelationship().hasExpandedEndNode() && !node.isReferred()) {
                        matcher.addToMatchingSet(node.incomingRelationship().getExpandedEndNode().id());
                    }
                }
                matchNodeProperties(node, matcher);
                matchNodeLabels(node, matcher);
                nodeIdsForConveyorBelt = processNodeMatcher(matcher);

                if(nodeIdsForConveyorBelt.length == 0 && merge) {
                    if(node.getPattern().usedAsCondition()) return false;
                    else { node.getPattern().create(); return; }
                }
            } else {
                nodeIdsForConveyorBelt = [node.getExpandedNode().id()];
            }
            return nodeIdsForConveyorBelt;
        };

        const processNodeWithoutRelationships = function(node, nodeId, merge, pathExpansionDepth) {
            if(!node.incomingRelationship() && !node.outgoingRelationship()) {
                node.addMatchedNode(nodes[nodeId]);
                if(node.getPattern().usedAsCondition()) return conveyorBelt(node, merge, pathExpansionDepth);
                else conveyorBelt(node, merge, pathExpansionDepth);
            }
        };

        const processNodeWithOutgoingRelationship = function(node, nodeIdIndex, nodeId, merge, pathExpansionDepth) {
            let returnValue;
            if(node.outgoingRelationship()) {
                const matchingRelationshipIds = getMatchingRelationshipIds(node, nodeIdIndex, nodeId, pathExpansionDepth);
                if(!matchingRelationshipIds && merge) {
                    node.getPattern().create();
                    returnValue = -1;
                } else if(matchingRelationshipIds.length > 0) {
                    returnValue = processMatchingRelationships(node, nodeId, merge, pathExpansionDepth, matchingRelationshipIds);
                    if(returnValue != undefined) return returnValue;
                    returnValue = pathExpansion(node, nodeId, pathExpansionDepth, matchingRelationshipIds);
                    if(returnValue != undefined) return returnValue;
                }
            }
            return returnValue;
        };

        const processNodeWithIncomingRelationship = function(node, nodeId, merge, pathExpansionDepth) {
            let returnValue;
            if(node.incomingRelationship()) {
                node.addMatchedNode(nodes[nodeId]);
                if(node.incomingRelationship().hasExpandedEndNode()) {
                    let convey = true;
                    if(node.isReferred()) {
                        if(node.getReferredNode().getData().id() != node.incomingRelationship().getExpandedEndNode().id()) {
                            convey = false;
                        }
                    }
                    if(convey) {
                        if(node.getPattern().usedAsCondition()) {
                            returnValue = conveyorBelt(node, merge, pathExpansionDepth);
                            if(returnValue != undefined) return returnValue;
                        } else {
                            conveyorBelt(node, merge, pathExpansionDepth);
                        }
                    }
                }
            }
        };

        const getMatchingRelationshipIds = function(node, nodeIdIndex, nodeId, pathExpansionDepth) {
            if(!pathExpansionDepth && node.outgoingRelationship().expandPath() && nodeIdIndex > 0) {
                node.outgoingRelationship().resetExpandedPath();
            }
            if(!node.isExpanded()) {
                node.addMatchedNode(nodes[nodeId]);
                node.outgoingRelationship().setFromNode(nodes[nodeId]);
            }
            let toNode = null;
            if(node.outgoingRelationship().getNextObject().isReferred() &&
                !node.outgoingRelationship().hasVariablePathLength()) {
                toNode = node.outgoingRelationship().getNextObject().getReferredNode().getData();
            }
            node.outgoingRelationship().bindProperties();
            return relationshipMatch(node.outgoingRelationship(), nodes[nodeId], toNode);
        };

        const processMatchingRelationships = function(node, nodeId, merge, pathExpansionDepth, matchingRelationshipIds) {
            let returnValue;
            for(let relationshipIdIdx=0; relationshipIdIdx<matchingRelationshipIds.length; relationshipIdIdx++) {
                const relationship = relationships[matchingRelationshipIds[relationshipIdIdx]];
                if(node.outgoingRelationship().pathLengthSatisfied()) {
                    node.outgoingRelationship().setExpandedEndNode(relationship.getToNode(nodeId));
                    node.outgoingRelationship().setMatchedRelationship(relationship);
                    node.outgoingRelationship().addMatchedRelationship(relationship,
                        {fromNodeId: nodeId, toNodeId: relationship.getToNode(nodeId).id()});
                    if(node.getPattern().usedAsCondition()) {
                        returnValue = conveyorBelt(node, merge, pathExpansionDepth);
                        if(returnValue != undefined) return returnValue;
                    } else {
                        conveyorBelt(node, merge, pathExpansionDepth);
                    }
                    node.outgoingRelationship().setExpandedEndNode(null);
                }
            }
        };

        const pathExpansion = function(node, nodeId, pathExpansionDepth, matchingRelationshipIds) {
            if(node.outgoingRelationship().expandPath()) {
                for(let relationshipIdIdx=0; relationshipIdIdx<matchingRelationshipIds.length; relationshipIdIdx++) {
                    const relationship = relationships[matchingRelationshipIds[relationshipIdIdx]];
                    if(node.outgoingRelationship().visitedBefore(relationship.getToNode(nodeId).id())) {
                        node.outgoingRelationship().backTrackExpandedPath();
                        continue;
                    }
                    if(node.outgoingRelationship().pathLengthSatisfied()) {
                        node.setExpandedNode(relationship.getToNode(nodeId));
                        self.matchNode(node, false, (pathExpansionDepth || 0) + 1);
                        node.setExpandedNode(null);
                    }
                    if(node.outgoingRelationship().expandPath() && !pathExpansionDepth) {
                        node.outgoingRelationship().backTrackExpandedPath();
                    }
                }
            }
        };

        this.matchNode = function(node, merge, pathExpansionDepth) {
            let returnValue;
            const nodeIdsForConveyorBelt = getMatchingNodeIds(node, merge);
            if(nodeIdsForConveyorBelt && nodeIdsForConveyorBelt.length) {
                for(let nodeIdIndex=0; nodeIdIndex<nodeIdsForConveyorBelt.length; nodeIdIndex++) {
                    const nodeId = nodeIdsForConveyorBelt[nodeIdIndex];
                    returnValue = processNodeWithoutRelationships(node, nodeId, merge, pathExpansionDepth);
                    if(returnValue != undefined) return returnValue;
                    returnValue = processNodeWithOutgoingRelationship(node, nodeIdIndex, nodeId, merge, pathExpansionDepth);
                    if(returnValue != undefined) return returnValue;
                    returnValue = processNodeWithIncomingRelationship(node, nodeId, merge, pathExpansionDepth);
                    if(returnValue != undefined) return returnValue;
                }
            }
            if(node.getPattern().usedAsCondition()) return false;
        };

        this.getNodeById = function(id) { return nodes[id]; };
        this.getRelationshipById = function(id) { return relationships[id]; };

        // Public addNode/addRelationship (used by addGraph)
        this.addNode = function(node) {
            const n = new StoredNode(this);
            n.setProperties(node.properties);
            n.setLabels(node.labels);
            addNode(n, node.id);
        };
        this.addRelationship = function(relationship) {
            const r = new StoredRelationship(this);
            r.setFromNode(this.getNodeById(relationship.from));
            r.setToNode(this.getNodeById(relationship.to));
            r.setProperties(relationship.properties);
            r.setStoredType(relationship.type);
            addRelationship(r, relationship.id);
        };

        this.addTable = function(table) { tables[table.name()] = table; };
        this.getTable = function(tableName) {
            if(!(tableName in tables)) throw "Table \"" + tableName + "\" does not exist.";
            return tables[tableName];
        };

        // ── Index rebuild (for importData) ────────────────
        const rebuildIndexes = function() {
            nodeIdLookup = {};
            labelNodeIdLookup = {};
            relationshipLookup = {};
            relationshipIdsByNodeIdLookup = {};
            relationshipIdsByNodeIdLookupIncoming = {};
            relationshipIdLookup = {};
            typeRelationshipIdLookup = {};
            stringRecoder = new StringRecoder();

            for(let i=0; i<nodes.length; i++) {
                const node = nodes[i];
                if(!node) continue;
                for(const key in node.getRawProperties()) {
                    addLookupNodeId(key, node.getLocalProperty(key), node.id());
                }
                for(const label in node.labels()) {
                    addLabelNodeIdLookup(label, node.id());
                }
            }
            for(let i=0; i<relationships.length; i++) {
                const rel = relationships[i];
                if(!rel) continue;
                addLookupRelationship(rel.fromNodeId, rel.toNodeId, rel.id());
                if(rel.toNodeId != rel.fromNodeId) {
                    addLookupRelationship(rel.toNodeId, rel.fromNodeId, rel.id());
                }
                for(const key in rel.getProperties()) {
                    addLookupRelationshipId(key, rel.getProperty(key), rel.id());
                }
                const type = recode(rel.getType());
                initializeTypeRelationshipIdLookup(type);
                const equalsCheck = function(rel_id) { return rel_id == rel.id(); };
                if(!typeRelationshipIdLookup[type].find(equalsCheck)) {
                    typeRelationshipIdLookup[type].push(rel.id());
                }
            }
        };

        // ── Persistence interface ─────────────────────────

        // exportData(): serialize current DB state to plain JSON-safe object
        this.exportData = function() {
            return {
                nodes: nodes
                    .filter(function(n) { return n != null && n != undefined; })
                    .map(function(n) { return n.toSerializable(); }),
                relationships: relationships
                    .filter(function(r) { return r != null && r != undefined; })
                    .map(function(r) { return r.toSerializable(); }),
                meta: {
                    nodeIdFactory: NODE_ID_FACTORY,
                    relationshipIdFactory: RELATIONSHIP_ID_FACTORY
                }
            };
        };

        // importData(): restore DB from a previously exported snapshot
        this.importData = function(snapshot) {
            nodes = [];
            relationships = [];
            NODE_ID_FACTORY = snapshot.meta.nodeIdFactory;
            RELATIONSHIP_ID_FACTORY = snapshot.meta.relationshipIdFactory;

            for(let i=0; i<snapshot.nodes.length; i++) {
                const nd = snapshot.nodes[i];
                const n = new StoredNode(self);
                n.setId(nd.id);
                n.setProperties(nd.properties);
                n.setLabelsFromObject(nd.labels);
                nodes[nd.id] = n;
            }
            for(let i=0; i<snapshot.relationships.length; i++) {
                const rd = snapshot.relationships[i];
                const r = new StoredRelationship(self);
                r.setId(rd.id);
                r.setStoredType(rd.type);
                r.setProperties(rd.properties);
                r.setFromNodeId(rd.fromNodeId);
                r.setToNodeId(rd.toNodeId);
                r.setLeftDirection(rd.leftDirection);
                r.setRightDirection(rd.rightDirection);
                relationships[rd.id] = r;
            }
            rebuildIndexes();
        };
    }

    function AssociativeArray() {
        const associativeArray = {};
        const boundAssociativeArray = {};
        const keys = [];
        const me = this;
        const bind = function() {
            for(const key in associativeArray) {
                boundAssociativeArray[key] = associativeArray[key].value();
            }
        };
        this.addEntry = function(key, element) {
            if(key in associativeArray) throw "Key \"" + key + "\" already exists in associative array.";
            associativeArray[key] = element;
            boundAssociativeArray[key] = null;
            keys.push(key);
        };
        this.get = function(_addAssociativeArrayFns) {
            if(_addAssociativeArrayFns == undefined) _addAssociativeArrayFns = true;
            bind();
            const boundAssociativeArrayCopy = {};
            for(const key in boundAssociativeArray) {
                boundAssociativeArrayCopy[key] = boundAssociativeArray[key];
                if(boundAssociativeArrayCopy[key]) {
                    boundAssociativeArrayCopy[key].constructor = boundAssociativeArray[key].constructor;
                }
            }
            if(_addAssociativeArrayFns) return addAssociativeArrayFunctions(boundAssociativeArrayCopy);
            return boundAssociativeArray;
        };
        this.getProperty = function(key) { bind(); return boundAssociativeArray[key]; };
        this.getProperties = function() { return Object.keys(associativeArray); };
        this.getValues = function() { return Object.values(associativeArray); };
        this.setValue = function(index, element) { associativeArray[keys[index]] = element; };
        this.next = function() { return false; };
        this.hasNext = function() { return true; };
        this.reset = function() { ; };
        this.getData = function() { return me; };
        this.getObject = function() { return me; };
        this.value = function(_addAssociativeArrayFns) {
            if(_addAssociativeArrayFns == undefined) _addAssociativeArrayFns = true;
            return me.get(_addAssociativeArrayFns);
        };
        this.type = function() { return me.constructor.name; };
        this.toString = function() { bind(); return JSON.stringify(boundAssociativeArray); };
        this.groupByKey = function() { return me.toString(); };
        this.groupByValue = function() { return me.get(); };
    }

    function List(list, bindFunction) {
        list = (list && (list.constructor == Array) && list) || [];
        let boundList = addArrayFunctions([]);
        const me = this;
        const bind = function() {
            if(!bindFunction) {
                for(let i=0; i<list.length; i++) { boundList[i] = list[i].value(); }
            } else {
                for(let i=0; i<list.length; i++) { boundList[i] = bindFunction(list[i]); }
            }
        };
        this.add = function(expression) {
            if(!expression) return;
            list.push(expression);
            boundList.push(null);
        };
        this.get = function() {
            bind();
            const boundListCopy = new Array(boundList.length);
            for(let i=0; i<boundList.length; i++) {
                if(boundList[i].constructor == NodeReference || boundList[i].constructor == RelationshipReference) {
                    boundListCopy[i] = boundList[i];
                    continue;
                }
                boundListCopy[i] = boundList[i];
                boundListCopy[i].constructor = boundList[i].constructor;
                for(const key in boundList[i]) {
                    if(boundListCopy[i][key]) {
                        boundListCopy[i][key].constructor = boundList[i][key].constructor;
                    }
                }
            }
            return addArrayFunctions(boundListCopy);
        };
        this.setElement = function(elementIndex, element) { list[elementIndex] = element; };
        this.getElements = function() { return list; };
        this.next = function() { return false; };
        this.hasNext = function() { return true; };
        this.reset = function() { ; };
        this.getData = function() { return me; };
        this.value = function() { return me.get(); };
        this.type = function() { return me.constructor.name; };
        this.groupByKey = function() { return me.get(); };
        this.groupByValue = function() { return me.get(); };
    }

    function Case() {
        const me = this;
        const whens = [];
        const thens = [];
        let _else;
        this.when = function(expression) { whens.push(expression); };
        this.whenCount = function() { return whens.length; };
        this.then = function(expression) { thens.push(expression); };
        this.else = function(expression) { _else = expression; };
        this.get = function() { return this.value(); };
        this.next = function() { return false; };
        this.hasNext = function() { return true; };
        this.reset = function() { ; };
        this.getData = function() { return me; };
        this.value = function() {
            for(let i=0; i<whens.length; i++) {
                if(whens[i].value()) return thens[i].value();
            }
            return _else.value();
        };
        this.type = function() { return me.constructor.name; };
        this.groupByKey = function() { return me.get(); };
        this.groupByValue = function() { return me.get(); };
    }

    function Predicate() {
        const me = this;
        let predicateFunctionName = null;
        let _variable = null;
        let list = null;
        let where = null;
        this.setPredicateFunctionName = function(name) { predicateFunctionName = name; };
        this.variable = function(_variableName) { _variable = new Variable(null, _variableName); };
        this.list = function(_list) { list = _list; };
        this.where = function(_where) {
            where = _where;
            if("setLocalVariable" in where && _variable) {
                where.setLocalVariable(_variable.getObjectKey(), _variable);
            }
        };
        this.get = function() { return this.value(); };
        this.next = function() { return false; };
        this.hasNext = function() { return true; };
        this.reset = function() { ; };
        this.getData = function() { return me; };
        this.value = function() {
            const _list = list.value();
            if(_list.constructor != Array) throw "Predicate list must be an array.";
            let trues = 0;
            for(let i=0; i<_list.length; i++) {
                _variable.setOverriddenValue(_list[i]);
                if(where.value()) trues++;
            }
            if(predicateFunctionName == "all") return trues == _list.length;
            else if(predicateFunctionName == "any") return trues > 0;
            else if(predicateFunctionName == "sum") return trues;
            return false;
        };
        this.type = function() { return me.constructor.name; };
        this.groupByKey = function() { return me.get(); };
        this.groupByValue = function() { return me.get(); };
    }

    function FString() {
        const parts = [];
        this.string = function(_string) { parts.push(_string); };
        this.expression = function(expression) { parts.push(expression); };
        this.get = function() { return this.value(); };
        this.next = function() { return false; };
        this.hasNext = function() { return true; };
        this.reset = function() { ; };
        this.getData = function() { return this; };
        this.value = function() {
            let combined = '';
            for(let i=0; i<parts.length; i++) {
                if(parts[i].value) combined += parts[i].value();
                else combined += parts[i];
            }
            return combined;
        };
        this.type = function() { return this.constructor.name; };
        this.groupByKey = function() { return this.get(); };
        this.groupByValue = function() { return this.get(); };
    }

    function Constant(_value) {
        let value = _value;
        this.get = function() { return value; };
        this.next = function() { return false; };
        this.hasNext = function() { return true; };
        this.reset = function() { ; };
        this.getData = function() { return this; };
        this.getObject = function() { return value; };
        this.value = function() { return value; };
        this.id = function() { return value.id; };
        this.setValue = function(_value) { value = _value; };
        this.type = function() { return this.constructor.name; };
        this.groupByKey = function() { return value; };
        this.groupByValue = function() { return value; };
    }

    function Table(_db, _tableName) {
        const me = this;
        const db = _db;
        const tableName = _tableName;
        const tableColumns = {};
        this.addColumn = function(columnName) {
            tableColumns[columnName] = new TableColumn(this, columnName);
            return tableColumns[columnName];
        };
        this.addValue = function(columnName, value) { tableColumns[columnName].addValue(value); };
        this.getColumn = function(columnName) { return tableColumns[columnName]; };
        this.name = function() { return tableName; };
        this.type = function() { return this.constructor.name; };
        // init
        db.addTable(me);
    }

    function TableColumn(_table, _columnName) {
        const columnName = _columnName;
        const runLengths = [];
        const values = [];
        let valueIndex = 0;
        let runLengthIndex = 0;
        this.addValue = function(value) {
            if(values.length > 0) {
                if(values[values.length-1] == value) { runLengths[runLengths.length-1]++; }
                else { values.push(value); runLengths.push(1); }
            } else { values.push(value); runLengths.push(1); }
        };
        this.value = function() {
            if(runLengthIndex > runLengths[valueIndex]) { runLengthIndex = 0; valueIndex++; }
            runLengthIndex++;
            return values[valueIndex];
        };
        this.reset = function() { valueIndex = 0; runLengthIndex = 0; };
        this.name = function() { return columnName; };
        this.type = function() { return this.constructor.name; };
    }

// ── Section 3: Network Layer ──────────────────────────
// XMLHttpRequestFactory, HTTP

    function XMLHttpRequestFactory() {
        try {
            return new XMLHttpRequest();
        } catch(e) {
            ;
        }
        // Node.js fallback
        return new (function() {
            this.UNSENT = 0; this.OPENED = 1; this.HEADERS_RECEIVED = 2;
            this.LOADING = 3; this.DONE = 4;
            this.readyState = this.UNSENT;
            this.status = null; this.responseText = null;
            this.response = null; this.responseType = null;
            this.method = null; this.url = null; this.async = true;
            this.headers = {};
            this.onreadystatechange = function() {};
            this.onload = function() {};

            this.setRequestHeader = function(header, value) { this.headers[header] = value; };
            this.open = function(method, url, async) {
                this.method = method.toUpperCase();
                this.url = url;
                this.async = async;
                this.readyState = this.OPENED;
            };
            this.send = function(payload) {
                let http = null, urlLib = null;
                const ssl_url = (this.url.indexOf("https") == 0);
                try {
                    http = (ssl_url ? require('https') : require('http'));
                    urlLib = require('url');
                } catch(e) { ; }

                const me = this;
                const processResponse = function(resp) {
                    let data = '';
                    resp.on('data', function(chunk) { data += chunk; });
                    resp.on('end', function() {
                        me.responseText = data;
                        me.response = data;
                        me.readyState = me.DONE;
                        if(resp.statusCode >= 200 && resp.statusCode < 300) {
                            me.status = 200;
                        } else {
                            me.status = resp.statusCode;
                        }
                        me.onreadystatechange();
                        me.onload();
                    });
                };
                const handleError = function(err) {
                    console.log("Error: " + err);
                    me.status = 0;
                    me.onreadystatechange();
                };
                const parsedUrl = new urlLib.URL(this.url);
                const options = {
                    hostname: parsedUrl.hostname,
                    port: (parsedUrl.port ? parsedUrl.port : (ssl_url ? 443 : 80)),
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: this.method
                };
                if(this.headers) options["headers"] = this.headers;
                const request = http.request(options, processResponse);
                request.on("error", handleError);
                if(payload) request.write(payload);
                request.end();
            };
        });
    }

    function HTTP() {
        this.get = function(url, headers, successCallback, errorCallback) {
            if(!headers) headers = {};
            const xhr = XMLHttpRequestFactory();
            xhr.onreadystatechange = function() {
                if(xhr.readyState === 4) {
                    if(xhr.status >= 200 && xhr.status < 300) {
                        successCallback(xhr.responseText);
                    } else {
                        errorCallback(new Error('Request failed with status ' + xhr.status));
                    }
                }
            };
            try {
                xhr.open("GET", url, true);
                for(const key in headers) {
                    if(headers.hasOwnProperty(key)) xhr.setRequestHeader(key, headers[key]);
                }
                xhr.send();
            } catch(e) { errorCallback(e); }
        };
        this.post = function(url, payload, headers, successCallback, errorCallback) {
            if(!headers) headers = {};
            const xhr = XMLHttpRequestFactory();
            xhr.onreadystatechange = function() {
                if(xhr.readyState === 4) {
                    if(xhr.status >= 200 && xhr.status < 300) successCallback(xhr.responseText);
                    else errorCallback(new Error('Request failed with status ' + xhr.status));
                }
            };
            try {
                xhr.open("POST", url, true);
                for(const key in headers) {
                    if(headers.hasOwnProperty(key)) xhr.setRequestHeader(key, headers[key]);
                }
                if(payload && payload.constructor === Object) {
                    const encoded = new TextEncoder().encode(JSON.stringify(payload));
                    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                    xhr.setRequestHeader("Content-Length", encoded.length);
                    xhr.send(encoded);
                } else {
                    xhr.send(payload);
                }
            } catch(e) { errorCallback(e); }
        };
    }
    const http = new HTTP();

// ── Section 4: Query Layer ────────────────────────────
// Expression, Variable, Statement, Where,
// GraphOperation (shared base), Create, Match, Merge,
// Return, With, Unwind, Load,
// GroupBy, ReturnValue, Setter, Inserter

    function Expression(_root, _alias, _aggregationFunctions, _context, _variableReferences, _non_deterministic) {
        const root = _root;
        let alias = (root.element ? (root.element().getKey ? root.element().getKey() : _alias) : _alias);
        const aggregationFunctions = _aggregationFunctions;
        const context = _context;
        const variableReferences = _variableReferences;
        let childrenHasVariableReferences = false;
        const localVariables = {};
        const me = this;

        if(aggregationFunctions) {
            context.addReduceExpression(this);
            for(let i=0; i<aggregationFunctions.length; i++) {
                aggregationFunctions[i].setGroupBy(context.getGroupBy());
                aggregationFunctions[i].setReducer(context.getGroupBy().addReducer());
                aggregationFunctions[i].initialize();
            }
        }

        const _childrenHasVariableReferences = function(children) {
            if(!children) return false;
            for(let i=0; i<children.length; i++) {
                if(children[i].element().hasReferredVariables && children[i].element().hasReferredVariables()) return true;
                else return _childrenHasVariableReferences(children[i].p);
            }
            return false;
        };
        childrenHasVariableReferences = _childrenHasVariableReferences(root.p);

        this.root = function() { return root; };
        this.rootObject = function() {
            if(root.element().getObject) return root.element().getObject();
            return root.element();
        };
        this.value = function() { return root.value(); };
        this.getData = function() { return this.value(); };
        this.getAlias = function() { return alias; };
        this.variableReferences = function() { return variableReferences; };
        this.hasReferredVariables = function() {
            return (variableReferences && (variableReferences.length > 0)) || childrenHasVariableReferences;
        };
        this.setAlias = function(a) { alias = a; };
        this.hasKey = function() { return root.hasKey && root.hasKey(); };
        this.isReduceExpression = function() { return (aggregationFunctions != undefined); };
        this.aggregate = function() {
            if(aggregationFunctions) {
                for(let i=0; i<aggregationFunctions.length; i++) { aggregationFunctions[i].aggregate(); }
                return;
            }
            context.getGroupBy().map(root);
        };
        this.hasAggregateFunctions = function() { return aggregationFunctions != undefined; };
        this.isArray = function() { return root.element().constructor == List; };
        this.isAssociativeArray = function() { return root.element().constructor == AssociativeArray; };
        this.getAggregateFunctions = function() { return aggregationFunctions; };
        this.type = function() { return this.constructor.name; };

        if(root.element().constructor == List) {
            const elements = root.element().getElements();
            for(let i=0; i<elements.length; i++) {
                if(elements[i].hasAggregateFunctions) {
                    me.hasAggregateFunctions = function() { return true; };
                }
                return;
            }
        }

        root.non_deterministic = function() { return _non_deterministic; };

        this.mappable = function() { return root.mappable(); };

        this.setLocalVariable = function(key, value) { localVariables[key] = value; };
        this.getLocalVariable = function(key) { return localVariables[key]; };
    }

    function Variable(_object, key) {
        const object = _object;
        const objectKey = key;
        let overriddenValue = null;
        this.getObjectKey = function() { return objectKey; };
        this.getObject = function() {
            if(overriddenValue) return overriddenValue;
            if(object && object.constructor == Constant) return object.getObject();
            return object;
        };
        this.value = function(asKey) {
            if(overriddenValue) return overriddenValue;
            try { return object.getData().get(asKey); } catch(e) { ; }
            return null;
        };
        this.setOverriddenValue = function(_overriddenValue) { overriddenValue = _overriddenValue; };
        this.type = function() { return this.constructor.name; };
    }

    function Statement(_engine) {
        const engine = _engine;
        let operations = [];
        let variables = {};
        let lastVariable;
        let lastPropertyKey;
        let output = [];
        let graph = { nodes: {}, relationships: {} };
        let nodesAdded = 0;
        let relationshipsAdded = 0;
        let overriddenContextStack = [];
        let overriddenContext = undefined;

        this.addOperation = function(operation) {
            if(this.context() && this.context().type() == 'Return') {
                throw "There can only be one return statement and it must be last in the query.";
            }
            if(this.context()) this.context().setNextOperation(operation);
            operations.push(operation);
        };
        this.operations = function() { return operations; };
        this.context = function() { return overriddenContext || operations[operations.length-1]; };
        this.setContext = function(context) {
            if(overriddenContext) overriddenContextStack.push(overriddenContext);
            overriddenContext = context;
        };
        this.resetContext = function() { overriddenContext = overriddenContextStack.pop(); };
        this.addVariable = function(key, object) {
            lastVariable = new Variable(object, key);
            if(variables[key]) throw "Variable `" + key + "` already declared.";
            variables[key] = lastVariable;
        };
        this.debugVariables = function() {
            for(const key in variables) {
                console.log("Variable \"" + key + "\":");
                console.log(JSON.stringify(variables[key].value()));
            }
        };
        this.variables = function() { return Object.values(variables); };
        this.getVariable = function(key) {
            if(variables[key] == undefined) {
                try {
                    if(window != undefined && key in window) {
                        return {value: function() { return window[key]; }};
                    }
                } catch(e) { ; }
                throw "Variable `" + key + "` has not been declared.";
            }
            return variables[key];
        };
        this.hasVariable = function(key) { return variables[key] != undefined; };
        this.getLastVariable = function() { return lastVariable; };
        this.setPropertyKey = function(key) { lastPropertyKey = key; };
        this.getPropertyKey = function() { return lastPropertyKey; };
        this.clear = function() {
            operations = [];
            variables = {};
            lastVariable = undefined;
            lastPropertyKey = undefined;
            output = [];
            nodesAdded = 0;
            relationshipsAdded = 0;
            graph = { nodes: {}, relationships: {} };
        };
        this.engine = function() { return engine; };
        this.results = function() {
            checkGraphConsistency();
            return {
                output: output,
                graph: {
                    nodes: Object.values(graph.nodes),
                    links: Object.values(graph.relationships)
                },
                stats: { nodesAdded: nodesAdded, relationshipsAdded: relationshipsAdded }
            };
        };
        this.addOutputRecord = function() { output.push({}); };
        this.addOutputEntry = function(key, value, id) {
            let _key = key;
            if(output[output.length-1][_key] != undefined) _key += id;
            this.addOutputEntryToGraph(value);
            output[output.length-1][_key] = clean(value);
        };
        const checkGraphConsistency = function() {
            const rel_ids_to_delete = [];
            for(const relationshipId in graph.relationships) {
                const rel = graph.relationships[relationshipId];
                if(!graph.nodes[rel.source] || !graph.nodes[rel.target]) {
                    rel_ids_to_delete.push(relationshipId);
                }
            }
            for(let i=0; i<rel_ids_to_delete.length; i++) {
                delete graph.relationships[rel_ids_to_delete[i]];
            }
        };
        this.addOutputEntryToGraph = function(entry) {
            if(entry && entry.constructor == NodeReference) {
                if(graph.nodes[entry.id()] == undefined) graph.nodes[entry.id()] = clean(entry);
            } else if(entry && entry.constructor == RelationshipReference) {
                if(graph.relationships[entry.id()] == undefined) {
                    const e = entry.getObject().toObject();
                    e.source = e.fromNode.id();
                    e.target = e.toNode.id();
                    graph.relationships[entry.id()] = clean(e);
                }
            } else if(entry && entry.constructor == Array) {
                for(let i=0; i<entry.length; i++) { this.addOutputEntryToGraph(entry[i]); }
            }
        };
        this.setNodesAdded = function(value) { nodesAdded = value; };
        this.setRelationshipsAdded = function(value) { relationshipsAdded = value; };
        this.getNodesAdded = function() { return nodesAdded; };
        this.getRelationshipsAdded = function() { return relationshipsAdded; };
        this.setSuccessCallback = function(_successCallback) { successCallback = _successCallback; };
        this.success = function() { successCallback(this.results()); };
    }

    function Where(_expression) {
        const expression = _expression;
        this.evaluate = function() { return expression.value() == true; };
        this.type = function() { return this.constructor.name; };
    }

    function Inserter(_db, _tableName) {
        const db = _db;
        const tableName = _tableName;
        const tableColumns = [];
        const table = new Table(db, tableName);
        let previousOperation;
        let nextOperation;

        this.setPreviousOperation = function(_previousOperation) {
            previousOperation = _previousOperation;
            let variable;
            for(let i=0; i<previousOperation.variables().length; i++) {
                variable = previousOperation.variables()[i];
                tableColumns.push(table.addColumn(variable.getObjectKey()));
            }
        };
        this.setNextOperation = function(_nextOperation) {
            nextOperation = _nextOperation;
            nextOperation.setPreviousOperation(this);
        };
        this.variables = function() { return previousOperation.variables(); };
        this.doIt = function() {
            let variable;
            for(let i=0; i<previousOperation.variables().length; i++) {
                variable = previousOperation.variables()[i];
                tableColumns[i].addValue(tableColumns[i].name(), variable.value());
            }
            if(nextOperation) {
                const result = nextOperation.doIt();
                if(result instanceof Promise) result.then();
            }
        };
        this.finish = function() { if(nextOperation) nextOperation.finish(); };
        this.run = function() { throw "Into-operation cannot be first in statement."; };
        this.type = function() { return this.constructor.name; };
    }

    function Setter() {
        let setters;
        let previousOperation;
        let nextOperation;

        function SetterEntry(_variable, _propertyKey, _expression) {
            const variable = _variable;
            const propertyKey = _propertyKey;
            const expression = _expression;
            this.set = function() {
                let o = variable.getObject();
                let assignee;
                if(o.constructor == Unwind) o = o.value();
                if(o.constructor == NodeReference) {
                    assignee = o.getObject(); // Returns StoredNode
                } else if(o.constructor == PatternNode) {
                    assignee = o.getData(); // Returns StoredNode
                } else if(o.constructor == RelationshipReference) {
                    assignee = o.getObject(); // Returns StoredRelationship
                } else if(o.constructor == PatternRelationship) {
                    assignee = o.getData(); // Returns StoredRelationship
                } else {
                    throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
                }
                try {
                    assignee.setProperty(propertyKey, expression);
                    assignee.bindProperty(propertyKey);
                } catch(e) { ; }
            };
        }

        function MapSetterEntry(_variable, _mapExpression) {
            const variable = _variable;
            const mapExpression = _mapExpression;
            this.set = function() {
                let o = variable.getObject();
                let assignee;
                if(o.constructor == Unwind) o = o.value();
                if(o.constructor == NodeReference || o.constructor == RelationshipReference) {
                    assignee = o.getObject();
                } else if(o.constructor == PatternNode || o.constructor == PatternRelationship) {
                    assignee = o.getData();
                } else {
                    throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
                }
                assignee.setProperties(mapExpression.value());
            };
        }

        function LabelSetterEntry(_variable, _labelExpression) {
            const variable = _variable;
            const labelExpression = _labelExpression;
            this.set = function() {
                let o = variable.getObject();
                let assignee;
                if(o.constructor == Unwind) o = o.value();
                if(o.constructor == NodeReference) {
                    assignee = o.getObject(); // StoredNode
                } else if(o.constructor == PatternNode) {
                    assignee = o.getData(); // StoredNode
                } else {
                    throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
                }
                assignee.setLabel(labelExpression.value());
            };
        }

        function TypeSetterEntry(_variable, _typeExpression) {
            const variable = _variable;
            const typeExpression = _typeExpression;
            this.set = function() {
                let o = variable.getObject();
                let assignee;
                if(o.constructor == Unwind) o = o.value();
                if(o.constructor == RelationshipReference) {
                    assignee = o.getObject(); // StoredRelationship
                } else if(o.constructor == PatternRelationship) {
                    assignee = o.getData(); // StoredRelationship
                } else {
                    throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
                }
                try {
                    assignee.setType(typeExpression.value(), assignee.id());
                } catch(e) { ; }
            };
        }

        this.addSetter = function(variable, propertyKey, expression) {
            if(!setters) setters = [];
            setters.push(new SetterEntry(variable, propertyKey, expression));
        };
        this.addLabelSetter = function(variable, labelExpression) {
            if(!setters) setters = [];
            setters.push(new LabelSetterEntry(variable, labelExpression));
        };
        this.addMapSetter = function(variable, mapExpression) {
            if(!setters) setters = [];
            setters.push(new MapSetterEntry(variable, mapExpression));
        };
        this.addTypeSetter = function(variable, typeExpression) {
            if(!setters) setters = [];
            setters.push(new TypeSetterEntry(variable, typeExpression));
        };
        this.setPreviousOperation = function(_previousOperation) { previousOperation = _previousOperation; };
        this.setNextOperation = function(_nextOperation) {
            nextOperation = _nextOperation;
            nextOperation.setPreviousOperation(this);
        };
        this.variables = function() { return previousOperation.variables(); };
        this.doIt = function() {
            for(let i=0; i<setters.length; i++) { setters[i].set(); }
            if(nextOperation) {
                const result = nextOperation.doIt();
                if(result instanceof Promise) result.then();
            }
        };
        this.finish = function() { if(nextOperation) nextOperation.finish(); };
        this.run = function() { throw "Set-operation cannot be first in statement."; };
        this.type = function() { return this.constructor.name; };
    }

    // GraphOperation: shared base for Create, Match, Merge.
    // Extracts the common structure (patterns, where, conveyor belt, operation linking).
    function GraphOperation(statement) {
        const patterns = [];
        let previousOperation;
        let nextOperation;
        let whereCondition;

        this.where = function(expression) { whereCondition = new Where(expression); };
        this.addPattern = function() { patterns.push(new Pattern()); };
        const lastPattern = function() { return patterns[patterns.length-1]; };
        this.getPattern = function() { return lastPattern(); };
        this.addNode = function(node) { lastPattern().addNode(node); };
        this.addRelationship = function(relationship) { lastPattern().addRelationship(relationship); };
        this.getLast = function() { return lastPattern().lastObject(); };
        this.variable = function(key) { statement.addVariable(key, this.getLast()); };
        this.setPreviousOperation = function(op) { previousOperation = op; };
        this.setNextOperation = function(op) {
            nextOperation = op;
            op.setPreviousOperation(this);
        };
        this.previousOperation = function() { return previousOperation; };
        this.nextOperation = function() { return nextOperation; };
        this.patterns = function() { return patterns; };
        this.whereCondition = function() { return whereCondition; };
        this.variables = function() { return statement.variables(); };

        this.initialiseConveyorBelt = function() {
            if(nextOperation) {
                lastPattern().setNextAction(function() {
                    if(!whereCondition || whereCondition.evaluate()) {
                        const result = nextOperation.doIt();
                        if(result instanceof Promise) result.then();
                    }
                });
            }
        };

        this.defaultFinish = function() {
            if(nextOperation) nextOperation.finish();
            else statement.success();
        };
    }

    function Create(_statement) {
        const statement = _statement;
        GraphOperation.call(this, statement);
        const base = this;

        this.doIt = function() {
            if(base.previousOperation() && base.previousOperation().constructor == Merge) {
                throw "WITH is required between MERGE and CREATE";
            }
            base.initialiseConveyorBelt();
            this.doIt = function() {
                const patterns = base.patterns();
                for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
                    patterns[patternIdx].create();
                }
            };
            this.doIt();
        };
        this.finish = base.defaultFinish.bind(this);
        this.run = function() {
            base.initialiseConveyorBelt();
            const patterns = base.patterns();
            for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
                patterns[patternIdx].create();
            }
            if(base.nextOperation()) base.nextOperation().finish();
        };
        this.type = function() { return 'Create'; };
    }

    function Match(_statement) {
        const statement = _statement;
        GraphOperation.call(this, statement);
        const base = this;

        this.doIt = function() {
            if(base.previousOperation() && base.previousOperation().constructor == Merge) {
                throw "WITH is required between MERGE and MATCH";
            }
            base.initialiseConveyorBelt();
            this.doIt = function() {
                const patterns = base.patterns();
                for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
                    patterns[patternIdx].match();
                }
            };
            this.doIt();
        };
        this.finish = function() {
            const patterns = base.patterns();
            const next = base.nextOperation();
            if(next) {
                for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
                    patterns[patternIdx].finish();
                }
                next.finish();
            } else {
                statement.success();
            }
        };
        this.run = function() {
            base.initialiseConveyorBelt();
            const patterns = base.patterns();
            for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
                patterns[patternIdx].match();
            }
            const next = base.nextOperation();
            if(next) {
                for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
                    patterns[patternIdx].finish();
                }
                next.finish();
            }
        };
        this.type = function() { return 'Match'; };
    }

    function Merge(_statement) {
        const statement = _statement;
        GraphOperation.call(this, statement);
        const base = this;

        // Override variable to also set variableKey on the pattern object
        const baseVariable = this.variable.bind(this);
        this.variable = function(key) {
            this.getLast().setVariableKey(key);
            baseVariable(key);
        };

        this.doIt = function() {
            base.initialiseConveyorBelt();
            this.doIt = function() {
                base.patterns()[base.patterns().length-1].merge();
            };
            this.doIt();
        };
        this.finish = base.defaultFinish.bind(this);
        this.run = function() {
            base.initialiseConveyorBelt();
            base.patterns()[base.patterns().length-1].merge();
            if(base.nextOperation()) base.nextOperation().finish();
        };
        this.type = function() { return 'Merge'; };
    }

    function GroupBy(context) {
        const ctx = context;
        let trieRoot = null;
        let currentTrieNode;
        let reducersCount = 0;
        const stringRecoder = new StringRecoder();

        const newNode = function(value) { return { value: value, map: {} }; };
        const recode = function(val) {
            if(val == undefined || val == null) return val;
            if(val.constructor == NodeReference || val.constructor == RelationshipReference) return val.id();
            else if(val.constructor == Array || val.constructor == Object) return JSON.stringify(val);
            return stringRecoder.recode(val);
        };
        this.getTrieRoot = function() { return trieRoot; };
        this.beginMap = function() {
            if(trieRoot == null) trieRoot = newNode();
            currentTrieNode = trieRoot;
        };
        this.beginMap();
        this.map = function(element) {
            if(element.non_deterministic()) element.precalculate();
            const groupByKey = recode(element.groupByKey());
            const groupByValue = element.groupByValue();
            if(!currentTrieNode.map[groupByKey]) currentTrieNode.map[groupByKey] = newNode(groupByValue);
            currentTrieNode = currentTrieNode.map[groupByKey];
        };
        this.getReducer = function(reducerIdx) {
            if(!currentTrieNode.reducers) currentTrieNode.reducers = new Array(reducersCount);
            if(!currentTrieNode.reducers[reducerIdx]) currentTrieNode.reducers[reducerIdx] = {};
            return currentTrieNode.reducers[reducerIdx];
        };
        this.addReducer = function() { return reducersCount++; };
        this.print = function() { printTrie(trieRoot); };
        const printTrie = function(trieNode) {
            let key;
            for(key in trieNode.map) {
                ctx.setNextMapValue(trieNode.map[key].value);
                printTrie(trieNode.map[key]);
                ctx.moveToPreviousMapValue();
            }
            if(!key) {
                currentTrieNode = trieNode;
                ctx.addAggregateOutputRecord();
            }
        };
    }

    function ReturnValue(_expression, _statement, _parent, isHidden) {
        const expression = _expression;
        const statement = _statement;
        let alias = expression.getAlias();
        let id = 0;
        let groupByValue;
        const me = this;
        const hidden = isHidden;
        const parent = _parent;

        this.getAlias = function() { return alias; };
        this.setAlias = function(_alias) {
            alias = _alias;
            statement.addVariable(alias, this);
        };
        this.hasKey = function() { return expression.hasKey(); };
        this.setId = function(_id) { id = _id; };
        this.getId = function() { return id; };
        this.value = function() {
            if(groupByValue != undefined) return groupByValue;
            return expression.value();
        };
        this.groupByKey = function() { return this.value(); };
        this.groupByValue = function() { return this.value(); };
        this.get = function() { return me.value(); };
        this.getData = function() { return me; };
        this.getExpression = function() { return expression; };
        this.setGroupByValue = function(_groupByValue) {
            if(expression.isArray() && expression.hasAggregateFunctions()) return;
            groupByValue = _groupByValue;
        };
        this.nextAction = function() { ; };
        this.setNextAction = function(f) { this.nextAction = f; };
        this.hidden = function() { return hidden; };
        this.parent = function() { return parent; };
        this.type = function() { return this.constructor.name; };
    }

    function Return(_statement) {
        const statement = _statement;
        const returnValues = [];
        let groupBy;
        let mapReturnValues;
        let mapReturnValuesIterator = 0;
        let reduceExpressions;
        let previousOperation;
        let nextOperation;
        let isIntermediary = false, hasReferredVariables = false, hasConstants = false;
        const me = this;
        let whereCondition;
        let limitExpression;
        let recordCount = 0;
        let doItCount = 0;

        this.where = function(expression) { whereCondition = new Where(expression); };
        this.limit = function(expression) { limitExpression = expression; };
        this.expression = function(expression) { addReturnValue(expression); };
        this.getLast = function() { return returnValues[lastIndex()]; };
        this.getGroupBy = function() {
            if(groupBy == undefined) groupBy = new GroupBy(this);
            return groupBy;
        };
        this.hasGroupBy = function() { return groupBy != undefined; };
        this.hasMapKeys = function() { return mapReturnValues && (mapReturnValues.length > 0); };
        this.doItCount = function() { return doItCount; };

        const hasLimit = function() { return limitExpression != undefined; };
        const limitReached = function() { return (hasLimit() && recordCount >= limitExpression.value()); };
        const whereConditionMet = function() { return !whereCondition || whereCondition.evaluate(); };

        this.addReduceExpression = function(reduceExpression) {
            if(!reduceExpressions) reduceExpressions = [];
            reduceExpressions.push(reduceExpression);
        };
        this.setNextMapValue = function(mapValue) {
            mapReturnValues[mapReturnValuesIterator++].setGroupByValue(mapValue);
        };
        this.moveToPreviousMapValue = function() { mapReturnValuesIterator--; };
        this.addAggregateOutputRecord = function() {
            if(!whereConditionMet()) return;
            if(this.doItCount() == 0 && this.hasMapKeys()) return;
            if(limitReached()) return;
            for(let i=0; i<returnValues.length; i++) { returnValues[i].nextAction(); }
            recordCount++;
            if(nextOperation) nextOperation.doIt();
        };

        this.setReturnValueNextAction = function(returnValue) {
            returnValue.setNextAction(function() {
                if(returnValue.getId() == 0) statement.addOutputRecord();
                if(returnValue.hidden()) return;
                statement.addOutputEntry(returnValue.getAlias(), returnValue.value(), returnValue.getId());
            });
        };

        const addReturnValue = function(expression, isHidden) {
            let hasHiddenReturnValues = false;
            if(expression.isArray()) {
                const array = expression.root().element();
                for(let i=0; i<array.getElements().length; i++) {
                    const hiddenReturnValue = addReturnValue(array.getElements()[i], true);
                    array.setElement(i, hiddenReturnValue);
                    hasHiddenReturnValues = true;
                }
            } else if(expression.isAssociativeArray()) {
                const associativeArray = expression.root().element();
                const values = associativeArray.getValues();
                for(let i=0; i<values.length; i++) {
                    const hiddenReturnValue = addReturnValue(values[i], true);
                    associativeArray.setValue(i, hiddenReturnValue);
                    hasHiddenReturnValues = true;
                }
            }
            const returnValue = new ReturnValue(expression, statement, me, isHidden);
            returnValues.push(returnValue);
            returnValues[lastIndex()].setId(lastIndex());
            if(!returnValue.getExpression().isReduceExpression() &&
                !hasHiddenReturnValues && returnValue.getExpression().mappable()) {
                if(!mapReturnValues) mapReturnValues = [];
                mapReturnValues.push(returnValue);
            }
            me.setReturnValueNextAction(returnValue);
            hasReferredVariables = hasReferredVariables || expression.hasReferredVariables();
            hasConstants = !hasReferredVariables;
            return returnValue;
        };

        this.setIsIntermediary = function() { isIntermediary = true; };
        this.conveyorBeltEnd = function() {
            return !hasReferredVariables && isIntermediary && !reduceExpressions && !hasConstants;
        };
        const lastIndex = function() { return returnValues.length-1; };

        this.setPreviousOperation = function(_previousOperation) { previousOperation = _previousOperation; };
        this.setNextOperation = function(_nextOperation) {
            nextOperation = _nextOperation;
            nextOperation.setPreviousOperation(this);
        };
        this.previousOperation = function() { return previousOperation; };
        this.nextOperation = function() { return nextOperation; };

        this.variables = function() {
            if(!nextOperation && previousOperation) return previousOperation.variables();
            const variableList = [];
            for(let i=0; i<returnValues.length; i++) {
                if(returnValues[i].hidden()) continue;
                variableList.push(statement.getVariable(returnValues[i].getAlias()));
            }
            return variableList;
        };
        this.type = function() { return this.constructor.name; };

        const internalDoIt = function() {
            doItCount++;
            if(!me.hasGroupBy()) {
                if(!whereConditionMet()) return;
                if(limitReached()) return;
                for(let i=0; i<returnValues.length; i++) { returnValues[i].nextAction(); }
                recordCount++;
                if(nextOperation) {
                    const result = nextOperation.doIt();
                    if(result instanceof Promise) result.then();
                }
            } else {
                groupBy.beginMap();
                if(mapReturnValues) {
                    for(let i=0; i<mapReturnValues.length; i++) {
                        mapReturnValues[i].getExpression().aggregate();
                    }
                }
                for(let i=0; i<reduceExpressions.length; i++) { reduceExpressions[i].aggregate(); }
            }
        };

        this.doIt = function() { if(!this.conveyorBeltEnd()) internalDoIt(); };
        this.finish = function() {
            if(this.conveyorBeltEnd()) internalDoIt();
            if(this.hasGroupBy()) groupBy.print();
            if(nextOperation) nextOperation.finish();
            else statement.success();
        };
        this.run = function() {
            internalDoIt();
            if(nextOperation) nextOperation.finish();
            else this.finish();
        };
    }

    // With: extends Return by delegation.
    // Overrides setReturnValueNextAction to set variable overrides
    // instead of writing to output. Marks itself as intermediary.
    function With(_statement) {
        const extendedObject = new Return(_statement);
        const descendentClassName = this.constructor.name; // "With"

        extendedObject.setReturnValueNextAction = function(returnValue) {
            if(returnValue.hidden()) return;
            returnValue.setNextAction(function() {
                if(extendedObject.hasGroupBy()) {
                    _statement.getVariable(returnValue.getAlias()).setOverriddenValue(returnValue.value());
                }
            });
        };
        extendedObject.type = function() { return descendentClassName; };
        extendedObject.setIsIntermediary();
        return extendedObject;
    }

    function Unwind(_statement) {
        const statement = _statement;
        let previousOperation;
        let nextOperation;
        let expressionToUnwind;
        let collectionToUnwind;
        let unwindedVariableKey;
        let index = 0;

        this.doIt = function() {
            if(nextOperation) {
                collectionToUnwind = expressionToUnwind.value();
                if(!collectionToUnwind) return;
                if(!Array.isArray(collectionToUnwind)) throw "Unwind expects list expression.";
                for(index=0; index<collectionToUnwind.length; index++) {
                    const result = nextOperation.doIt();
                    if(result instanceof Promise) result.then();
                }
            }
        };
        this.finish = function() { if(nextOperation) nextOperation.finish(); };
        this.run = function() {
            this.doIt();
            if(nextOperation) nextOperation.finish();
        };
        this.variable = function(key) {
            unwindedVariableKey = key;
            statement.addVariable(key, this);
        };
        this.variables = function() { return [statement.getVariable(unwindedVariableKey)]; };
        this.expression = function(expression) { expressionToUnwind = expression; };
        this.setPreviousOperation = function(_previousOperation) { previousOperation = _previousOperation; };
        this.setNextOperation = function(_nextOperation) {
            nextOperation = _nextOperation;
            nextOperation.setPreviousOperation(this);
        };
        this.previousOperation = function() { return previousOperation; };
        this.nextOperation = function() { return nextOperation; };
        this.value = function() { return collectionToUnwind[index]; };
        this.groupByKey = this.value;
        this.groupByValue = this.value;
        this.get = function() { return this.value(); };
        this.getData = function() { return this; };
        this.type = function() { return this.constructor.name; };
        this.id = function() { return this.value().id(); };
        this.collection = function() { return collectionToUnwind; };
        this.index = function() { return index; };
    }

    function Load(_statement) {
        const statement = _statement;
        let loadType = null;
        let requestType = "GET";
        let payload = null;
        let withHeaders = false;
        let httpHeaders = null;
        let fieldTerminator = ",";
        let from = null;
        let csvData = null;
        let data;
        let previousOperation;
        let nextOperation = null;
        const intermediateVariables = new Map();
        const HTTP_PROXY = statement.engine().getDataDownloadProxy();

        this.csv = function() { loadType = "CSV"; };
        this.json = function() { loadType = "JSON"; };
        this.text = function() { loadType = "TEXT"; };
        this.post = function() { requestType = "POST"; };
        this.loadType = function() { return loadType; };
        this.getRequestType = function() { return requestType; };
        this.getPayload = function() { return payload ? payload.value() : null; };
        this.headers = function() { withHeaders = true; };
        this.setHTTPHeaders = function(_httpHeaders) { httpHeaders = _httpHeaders; };
        this.getHTTPHeaders = function() { return httpHeaders; };
        this.setFieldTerminator = function(_fieldTerminator) {
            if(_fieldTerminator.length > 1 || _fieldTerminator.length == 0) throw "Field terminator must be one char.";
            fieldTerminator = _fieldTerminator;
        };
        this.fieldTerminator = function() { return fieldTerminator; };
        this.expression = function(expression) {
            if(from == null) from = expression;
            else if(payload == null) payload = expression;
        };
        this.getLast = function() { return from; };
        this.variable = function(key) { statement.addVariable(key, this); };
        this.getProperty = function(key) { return data[key]; };
        this.from = function() {
            if(HTTP_PROXY) return HTTP_PROXY + from.value();
            return from.value();
        };
        this.get = function() { return data; };
        this.value = function() { return this.get(); };
        this.groupByKey = function() { return data; };
        this.groupByValue = function() { return this.get(); };
        this.getData = function() { return this; };
        this.statement = function() { return statement; };
        this.setPreviousOperation = function(_previousOperation) { previousOperation = _previousOperation; };
        this.setNextOperation = function(_nextOperation) {
            nextOperation = _nextOperation;
            nextOperation.setPreviousOperation(this);
        };
        this.previousOperation = function() { return previousOperation; };
        this.variables = function() { return statement.variables(); };

        const parseCSV = function(_fieldSeparator, nextOperationCb) {
            const fieldNames = [];
            let fieldNumber = 0;
            let record = {};
            let lineNumber = 0;
            let c = '', i = 0, pc = '';
            let inDoubleQuotes = false;
            const fieldSeparator = _fieldSeparator || ',';

            const next = function() {
                pc = c;
                c = csvData.charAt(i++);
                if(doubleQuote()) { inDoubleQuotes = !inDoubleQuotes; next(); }
            };
            const consume = function() {
                if(isQuoteInQuote()) { c = csvData.charAt(++i); return '""'; }
                return c;
            };
            const nextChar = function() { return eof() ? '\0' : csvData.charAt(i); };
            const isQuoteInQuote = function() {
                if(doubleQuoted()) { if(c == '"' && nextChar() == '"') return true; }
                return false;
            };
            const doubleQuote = function() { return !isQuoteInQuote() && c == '"'; };
            const doubleQuoted = function() { return inDoubleQuotes; };
            const isFieldSeparator = function() { return c == fieldSeparator; };
            const newLine = function() {
                if(c == '\r' && nextChar() == '\n') next();
                return c == '\n';
            };
            const eof = function() { return i >= csvData.length; };
            const more = function() { return !(isFieldSeparator() || newLine() || eof()); };

            const addRecord = function() {
                if(lineNumber++ > 0) {
                    data = record;
                    record = {};
                    fieldNumber = 0;
                    const result = nextOperationCb();
                    if(result instanceof Promise) result.then();
                }
            };
            const field = function() {
                let f = "";
                while(more() || doubleQuoted()) { f += consume(); next(); }
                if(lineNumber == 0) {
                    if(withHeaders) fieldNames.push(f);
                    else fieldNames.push(fieldNames.length);
                }
                if((lineNumber > 0 && withHeaders) || !withHeaders) {
                    record[fieldNames[fieldNumber++]] = f;
                }
                if(isFieldSeparator()) next();
            };
            while(!eof()) {
                while(!newLine() && !eof()) { field(); }
                addRecord();
                next();
            }
        };

        const processJSON = function(jsonData, nextOperationCb) {
            if(jsonData.constructor == Array) {
                for(let i=0; i<jsonData.length; i++) {
                    data = addAssociativeArrayFunctions(jsonData[i]);
                    nextOperationCb();
                }
            } else if(jsonData.constructor == Object) {
                data = addAssociativeArrayFunctions(jsonData);
                nextOperationCb();
            }
        };

        this.doIt = function() { return this.run(); };
        this.finish = function() { ; };

        this.saveVariables = function() {
            const vars = Object.fromEntries(
                statement.variables().map(function(v) { return [v.getObjectKey(), v.value()]; })
            );
            const key = intermediateVariables.size;
            intermediateVariables.set(key, vars);
            return key;
        };
        this.setVariables = function(key) {
            const vars = intermediateVariables.get(key);
            for(const variableKey in vars) {
                const variable = statement.getVariable(variableKey);
                if(variable) variable.setOverriddenValue(vars[variableKey]);
            }
        };
        this.removeVariables = function(key) {
            const vars = intermediateVariables.get(key);
            for(const variableKey in vars) {
                const variable = statement.getVariable(variableKey);
                if(variable) variable.setOverriddenValue(null);
            }
            intermediateVariables.delete(key);
        };
        this.isVariablesEmpty = function() { return intermediateVariables.size == 0; };

        this.run = function() {
            const me = this;
            const fromVal = me.from();
            const variablesKey = me.saveVariables();
            const handleResponse = function(responseText) {
                me.setVariables(variablesKey);
                if(me.loadType() == "CSV") {
                    csvData = responseText;
                    parseCSV(me.fieldTerminator(), function() { nextOperation.doIt(); });
                } else if(me.loadType() == "JSON") {
                    processJSON(JSON.parse(responseText), function() { nextOperation.doIt(); });
                } else if(me.loadType() == "TEXT") {
                    data = responseText;
                    nextOperation.doIt();
                }
                me.removeVariables(variablesKey);
                if(me.isVariablesEmpty()) nextOperation.finish();
            };
            const handleError = function(statusText) {
                const error = "Error loading data from " + fromVal + ": " + statusText;
                try { self.onerror(error); } catch(e) { throw error; }
            };
            if(fromVal.constructor == String) {
                if(me.getRequestType() == "GET") {
                    try {
                        http.get(fromVal, me.getHTTPHeaders() ? me.getHTTPHeaders().value(false) : null, handleResponse, handleError);
                    } catch(e) { handleError(e); }
                } else if(me.getRequestType() == "POST") {
                    try {
                        http.post(me.from(), me.getPayload(), me.getHTTPHeaders() ? me.getHTTPHeaders().value(false) : null, handleResponse, handleError);
                    } catch(e) { handleError(e); }
                }
            } else if(fromVal.constructor != String) {
                if(me.loadType() == "JSON") {
                    processJSON(fromVal, function() { nextOperation.doIt(); });
                }
            }
        };
        this.type = function() { return this.constructor.name; };
    }

// ── Section 5: Parse Layer ────────────────────────────
// Trie, KeyWord, Operator, _Function, AggregateFunction,
// PredicateFunctionLookup, Parser (with ExpressionTreeBuilder,
// VariableReference, ExpressionElement, AggregateExpressionElement)

    // Trie: builds and searches prefix tries for keywords, operators, functions.
    // isF() returns {length, matched} — no longer sets static .latestParsed.
    const Trie = {
        buildTrie: function(f) {
            const trie = {};
            for(const key in f) {
                const displayValue = f[key].displayValue();
                let trieNode = trie;
                for(let i=0; i<displayValue.length; i++) {
                    const char = displayValue.charAt(i).toUpperCase();
                    if(!trieNode[char]) trieNode[char] = {};
                    trieNode = trieNode[char];
                }
                trieNode.isF = true;
                trieNode.f = f[key];
            }
            return trie;
        },
        // Returns {length: N, matched: obj} or {length: 0, matched: null}
        isF: function(trie, expression, position, noEndOfKeyWordCheck) {
            let trieNode = trie;
            let i = position;
            const get = function(ix) { return expression.charAt(ix).toUpperCase(); };
            const endOfKeyWord = function(ix) {
                if(noEndOfKeyWordCheck) return true;
                const c = get(ix);
                return c === " " || c === "(" || c === ")" || c === "," || c === "" ||
                    c === "}" || c === "\t" || c === "\n" || c === "\r" ||
                    (c === "/" && get(ix+1) === "/");
            };
            for(;;) {
                if(trieNode[get(i)]) {
                    trieNode = trieNode[get(i)];
                    if(trieNode.isF && !trieNode[get(i+1)] && endOfKeyWord(i+1)) {
                        return { length: (i-position)+1, matched: trieNode.f };
                    }
                    i++;
                } else {
                    return { length: 0, matched: null };
                }
            }
        }
    };

    // KeyWord definitions
    function KeyWord(displayValue, actionFunction) {
        const dv = displayValue;
        this.action = actionFunction;
        this.displayValue = function() { return dv; };
    }
    KeyWord.f = {};
    KeyWord.f.CREATE = new KeyWord("CREATE", function(e) { e.create(); });
    KeyWord.f.MATCH = new KeyWord("MATCH", function(e) { e.match(); });
    KeyWord.f.MERGE = new KeyWord("MERGE", function(e) { e.merge(); });
    KeyWord.f.WITH = new KeyWord("WITH", function(e) { e._with(); });
    KeyWord.f.RETURN = new KeyWord("RETURN", function(e) { e._return(); });
    KeyWord.f.INTO = new KeyWord("INTO", function(e) { e.into(); });
    KeyWord.f.LIMIT = new KeyWord("LIMIT", function(e) { ; });
    KeyWord.f.UNWIND = new KeyWord("UNWIND", function(e) { e.unwind(); });
    KeyWord.f.WHERE = new KeyWord("WHERE", function(e) { ; });
    KeyWord.f.LOAD = new KeyWord("LOAD", function(e) { e.load(); });
    KeyWord.f.CSV = new KeyWord("CSV", function(e) { e.csv(); });
    KeyWord.f.JSON = new KeyWord("JSON", function(e) { e.json(); });
    KeyWord.f.TEXT = new KeyWord("TEXT", function(e) { e.text(); });
    KeyWord.f.HEADERS = new KeyWord("HEADERS", function(e) { ; });
    KeyWord.f.FROM = new KeyWord("FROM", function(e) { ; });
    KeyWord.f.POST = new KeyWord("POST", function(e) { e.post(); });
    KeyWord.f.AS = new KeyWord("AS", function(e) { ; });
    KeyWord.f.FIELDTERMINATOR = new KeyWord("FIELDTERMINATOR", function(e) { ; });
    KeyWord.f.SET = new KeyWord("SET", function(e) { ; });
    KeyWord.f.DISTINCT = new KeyWord("DISTINCT", function(e) { ; });
    KeyWord.f.TRUE = new KeyWord("TRUE", function(e) { ; });
    KeyWord.f.FALSE = new KeyWord("FALSE", function(e) { ; });
    KeyWord.f.NULL = new KeyWord("NULL", function(e) { ; });
    KeyWord.f.CASE = new KeyWord("CASE", function(e) { ; });
    KeyWord.f.WHEN = new KeyWord("WHEN", function(e) { ; });
    KeyWord.f.THEN = new KeyWord("THEN", function(e) { ; });
    KeyWord.f.ELSE = new KeyWord("ELSE", function(e) { ; });
    KeyWord.f.END = new KeyWord("END", function(e) { ; });
    KeyWord.f.SHORTESTPATH = new KeyWord("SHORTESTPATH", function(e) { ; });
    KeyWord.f.IN = new KeyWord("IN", function(e) { ; });
    KeyWord.trie = Trie.buildTrie(KeyWord.f);

    // Operator definitions
    function Operator(displayValue, precedence, leftAssociativity, valueFunction) {
        const dv = displayValue;
        const prec = precedence;
        const leftAssoc = leftAssociativity;
        this.value = valueFunction;
        this.isOperator = true;
        this.displayValue = function() { return dv; };
        this.precedence = function() { return prec; };
        this.leftAssociativity = function() { return leftAssoc; };
        this.rightAssociativity = function() { return !leftAssoc; };
    }
    Operator.f = {};
    Operator.f.POWER = new Operator("^", 11, false, function() { return Math.pow(this.lhs.value(), this.rhs.value()); });
    Operator.f.MULTIPLY = new Operator("*", 10, true, function() { return this.lhs.value()*this.rhs.value(); });
    Operator.f.DIVIDE = new Operator("/", 10, true, function() { return this.lhs.value()/this.rhs.value(); });
    Operator.f.MODULO = new Operator("%", 10, true, function() { return this.lhs.value()%this.rhs.value(); });
    Operator.f.SET_UNION = new Operator("|", 10, true, function() {
        try { return Array.from(new Set(this.lhs.value().concat(this.rhs.value()))); }
        catch(error) { console.log(error); return null; }
    });
    Operator.f.SET_INTERSECT = new Operator("&", 10, true, function() {
        try {
            const A = new Set(this.lhs.value()), B = new Set(this.rhs.value()), intersect = new Set();
            for(const e of B) { if(A.has(e)) intersect.add(e); }
            return Array.from(intersect);
        } catch(error) { console.log(error); return null; }
    });
    Operator.f.PLUS = new Operator("+", 9, true, function() {
        if(this.lhs.value().constructor == Array) return this.lhs.value().concat(this.rhs.value());
        if(this.rhs.value().constructor == Array) return [this.lhs.value()].concat(this.rhs.value());
        return this.lhs.value()+this.rhs.value();
    });
    Operator.f.MINUS = new Operator("-", 9, true, function() {
        const lhs = this.lhs.value(), rhs = this.rhs.value();
        if(lhs.constructor == Array && rhs.constructor == Array) {
            const _difference = new Set(lhs), rhs_set = new Set(rhs);
            for(const e of rhs_set) { _difference.delete(e); }
            return Array.from(_difference);
        }
        return lhs - rhs;
    });
    Operator.f.GREATER_THAN = new Operator(">", 8, true, function() { return this.lhs.value()>this.rhs.value(); });
    Operator.f.LESS_THAN = new Operator("<", 8, true, function() { return this.lhs.value()<this.rhs.value(); });
    Operator.f.GREATER_THAN_OR_EQUALS = new Operator(">=", 8, true, function() { return this.lhs.value()>=this.rhs.value(); });
    Operator.f.LESS_THAN_OR_EQUALS = new Operator("<=", 8, true, function() { return this.lhs.value()<=this.rhs.value(); });
    Operator.f.EQUALS = new Operator("=", 7, true, function() { return this.lhs.value()==this.rhs.value(); });
    Operator.f.NOT_EQUALS = new Operator("<>", 7, true, function() { return this.lhs.value()!=this.rhs.value(); });
    Operator.f.IN = new Operator("IN", 7, true, function() {
        (this.rhs.value().constructor != Array && (function() { throw "Not a list expression."; })());
        return this.rhs.value().indexOf(this.lhs.value()) > -1;
    });
    Operator.f.IS = new Operator("IS", 7, true, function() { return this.lhs.value()==this.rhs.value(); });
    Operator.f.AND = new Operator("AND", 6, true, function() { return this.lhs.value()&&this.rhs.value(); });
    Operator.f.OR = new Operator("OR", 5, true, function() { return this.lhs.value()||this.rhs.value(); });
    Operator.f.NONE = new Operator("NONE", -1, true, null);
    Operator.trie = Trie.buildTrie(Operator.f);

    // _Function: scalar and utility function definitions
    function _Function(_displayValue, _minParams, _maxParams, _valueFunction, _returnType) {
        const displayValue = _displayValue;
        const minimumExpectedParameterCount = _minParams;
        const maximumExpectedParameterCount = _maxParams;
        const returnType = _returnType;
        this.value = _valueFunction;
        this.getObject = _valueFunction;
        this.groupByKey = _valueFunction;
        this.groupByValue = _valueFunction;
        this.isFunction = true;
        this.displayValue = function() { return displayValue; };
        this.parametric = function() { return minimumExpectedParameterCount > 0; };
        this.precedence = function() { return 12; };
        this.leftAssociativity = function() { return true; };
        this.rightAssociativity = function() { return !this.leftAssociativity(); };
        this.verifyParsedParameterCount = function(n) {
            if(n < minimumExpectedParameterCount) throw "Too few parameters for function \"" + displayValue + "\".";
            else if(n > maximumExpectedParameterCount) throw "Too many parameters for function \"" + displayValue + "\".";
        };
        this.returnType = function() { return returnType; };
    }
    _Function.f = {};
    _Function.f.PI = new _Function("PI", 0, 0, function() { return Math.PI; });
    _Function.f.E = new _Function("E", 0, 0, function() { return Math.E; });
    _Function.f.exp = new _Function("exp", 1, 1, function() { return Math.pow(Math.E, this.p[0].value()); });
    _Function.f.sqrt = new _Function("sqrt", 1, 1, function() { return Math.sqrt(this.p[0].value()); });
    _Function.f.log = new _Function("log", 2, 2, function() {
        return Math.log(this.p[0].value())/(this.p[1].value() ? Math.log(this.p[1].value()) : 1);
    });
    _Function.f.ln = new _Function("ln", 1, 1, function() { return Math.log(this.p[0].value()); });
    _Function.f.sin = new _Function("sin", 1, 1, function() { return Math.sin(this.p[0].value()); });
    _Function.f.cos = new _Function("cos", 1, 1, function() { return Math.cos(this.p[0].value()); });
    _Function.f.id = new _Function("id", 1, 1, function() { return this.p[0].value().id(); });
    _Function.f.labels = new _Function("labels", 1, 1, function() { return this.p[0].value().getLabels(); });
    _Function.f.type = new _Function("type", 1, 1, function() { return this.p[0].value().getType(); });
    _Function.f.startnode = new _Function("startnode", 1, 1, function() { return this.p[0].value().startNode(); });
    _Function.f.endnode = new _Function("endnode", 1, 1, function() { return this.p[0].value().endNode(); });
    _Function.f.properties = new _Function("properties", 1, 1, function() { return this.p[0].value().getProperties(); });
    _Function.f.exists = new _Function("exists", 1, 1, function() { return (this.p[0].value() != undefined); });
    _Function.f.keys = new _Function("keys", 1, 1, function() {
        try { return this.p[0].value().getKeys(); } catch(e) { ; }
        return Object.keys(this.p[0].value());
    });
    _Function.f.nodes = new _Function("nodes", 1, 1, function() { return this.p[0].value().getNodes(); });
    _Function.f.relationships = new _Function("relationships", 1, 1, function() { return this.p[0].value().getRelationships(); });
    _Function.f.head = new _Function("head", 1, 1, function() { return (this.p[0].value().shift ? this.p[0].value().shift() : null); });
    _Function.f.last = new _Function("last", 1, 1, function() {
        const a = this.p[0].value();
        return (a.length > 0 ? a[a.length-1] : null);
    });
    _Function.f.size = new _Function("size", 1, 1, function() { return this.p[0].value().length; });
    _Function.f.object_lookup = new _Function("object_lookup", 2, 2, function() {
        if(this.p[0].value() && this.p[0].value().getProperty) return this.p[0].value().getProperty(this.p[1].value());
        try { return this.p[0].value()[this.p[1].value()]; } catch(e) { ; }
        return null;
    });
    _Function.f.array_lookup = new _Function("array_lookup", 2, 2, function() {
        try {
            const lookup = this.p[1].value();
            if(lookup.constructor == Number || lookup.constructor == String) return this.p[0].value()[lookup];
            else if(lookup.constructor == Array) {
                const a = [];
                for(let i=0; i<lookup.length; i++) a.push(this.p[0].value()[lookup[i]]);
                return a;
            }
        } catch(e) { ; }
        return null;
    });
    _Function.f.split = new _Function("split", 2, 2, function() {
        return addArrayFunctions(this.p[0].value().split(this.p[1].value()));
    }, List);
    _Function.f.join = new _Function("join", 1, 2, function() {
        const joinBy = ((this.p[1] != undefined) && this.p[1].value()) || ",";
        return this.p[0].value().join(joinBy);
    });
    _Function.f.trim = new _Function("trim", 1, 1, function() { return this.p[0].value().trim(); });
    _Function.f.range = new _Function("range", 2, 3, function() {
        const start = parseInt(this.p[0].value()), end = parseInt(this.p[1].value());
        const step = ((this.p[2] != undefined) && parseInt(this.p[2].value())) || 1;
        if(step == 0) throw "Zero step-size not allowed";
        else if(step < 0 && end > 0 && end > start) throw "Negative step-size and positive end of range not allowed.";
        else if(step > 0 && end < 0) throw "Positive step-size and negative end of range not allowed.";
        else if(end < start && step > 0) throw "End of range smaller than start of range and positive step-size not allowed.";
        const a = [];
        for(let i=start; i != end; i += step) a.push(i);
        return addArrayFunctions(a);
    }, List);
    _Function.f.lower = new _Function("lower", 1, 1, function() { return this.p[0].value().toLowerCase(); });
    _Function.f.upper = new _Function("upper", 1, 1, function() { return this.p[0].value().toUpperCase(); });
    _Function.f.replace = new _Function("replace", 3, 3, function() {
        const s = this.p[0].value();
        if(s.replace) return s.replace(new RegExp(this.p[1].value(), "g"), this.p[2].value());
        return s;
    });
    _Function.f.toint = new _Function("toint", 1, 1, function() { return parseInt(this.p[0].value()); });
    _Function.f.tofloat = new _Function("tofloat", 1, 1, function() { return parseFloat(this.p[0].value()); });
    _Function.f.tostring = new _Function("tostring", 1, 1, function() {
        try { return this.p[0].value().toString(); } catch(e) { ; }
        return this.p[0].value() + "";
    });
    _Function.f.stringify = new _Function("stringify", 2, 2, function() {
        try { return JSON.stringify(this.p[0].value(), null, this.p[1].value()); } catch(e) { ; }
        return null;
    });
    _Function.f.todate = new _Function("todate", 1, 1, function() { return new Date(this.p[0].value()); });
    _Function.f.tojson = new _Function("tojson", 1, 1, function() { return JSON.parse(this.p[0].value()); });
    _Function.f.coalesce = new _Function("coalesce", 2, 2, function() {
        return (this.p[0].value() == null ? this.p[1].value() : this.p[0].value());
    });
    _Function.f.round = new _Function("round", 1, 1, function() { return Math.round(this.p[0].value()); });
    _Function.f.rand = new _Function("rand", 0, 0, function() { return Math.random(); });
    _Function.f.rand.non_deterministic = true;
    _Function.f.timestamp = new _Function("timestamp", 0, 0, function() { return new Date(); });
    _Function.f.not = new _Function("not", 1, 1, function() { return !this.p[0].value(); });
    _Function.trie = Trie.buildTrie(_Function.f);

    // AggregateFunction: aggregation function definitions (count, sum, collect, etc.)
    function AggregateFunction(_displayValue, _minParams, _maxParams, _initFunction, _valueFunction, _aggregateFunction, _returnType) {
        const displayValue = _displayValue;
        let parsedParameterCount = 0;
        const minimumExpectedParameterCount = _minParams;
        const maximumExpectedParameterCount = _maxParams;
        const returnType = _returnType;
        this.initialize = _initFunction;
        this.value = _valueFunction;
        this.getObject = _valueFunction;
        this.aggregate = _aggregateFunction;
        this.isFunction = true;
        this.initializeIfNecessary = function() { this.initialize(); };
        this.displayValue = function() { return displayValue; };
        this.precedence = function() { return 12; };
        this.leftAssociativity = function() { return true; };
        this.rightAssociativity = function() { return !this.leftAssociativity(); };
        this.parametric = function() { return minimumExpectedParameterCount > 0; };
        this.parsedParameterCount = function() { return parsedParameterCount; };
        this.verifyParsedParameterCount = function(n) {
            parsedParameterCount = n;
            if(parsedParameterCount < minimumExpectedParameterCount) throw "Too few parameters for function \"" + displayValue + "\".";
            else if(parsedParameterCount > maximumExpectedParameterCount) throw "Too many parameters for function \"" + displayValue + "\".";
        };
        this.returnType = function() { return returnType; };
    }
    AggregateFunction.f = {};
    AggregateFunction.f.sum = new AggregateFunction("sum", 1, 1,
        function() {
            if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = 0;
            }
        },
        function() {
            return this.getGroupBy().getReducer(this.getReducerId()).result || (new Number(0));
        },
        function() {
            this.initializeIfNecessary();
            this.getGroupBy().getReducer(this.getReducerId()).result += this.p[0].value();
        }
    );
    AggregateFunction.f.barchart = new AggregateFunction("barchart", 1, 1,
        function() {
            if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = {};
            }
        },
        function() {
            return addAssociativeArrayFunctions(this.getGroupBy().getReducer(this.getReducerId()).result);
        },
        function() {
            this.initializeIfNecessary();
            const key = (this.p[0].value().groupByKey && this.p[0].value().groupByKey()) || this.p[0].value();
            if(this.getGroupBy().getReducer(this.getReducerId()).result[key] == undefined) {
                this.getGroupBy().getReducer(this.getReducerId()).result[key] = 0;
            }
            this.getGroupBy().getReducer(this.getReducerId()).result[key]++;
        }
    );
    AggregateFunction.f.histogram = new AggregateFunction("histogram", 1, 2,
        function() {
            if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = { values: [], histogram: null };
            }
        },
        function() {
            const r = this.getGroupBy().getReducer(this.getReducerId()).result;
            if(r.histogram == null) {
                const bins = (this.p[1] && this.p[1].value()) || 10;
                let min = r.values[0], max = r.values[0];
                const histogram = new Array(bins).fill(0);
                for(let i=0; i<r.values.length; i++) {
                    if(r.values[i] < min) min = r.values[i];
                    if(r.values[i] > max) max = r.values[i];
                }
                const step = (max-min)/bins;
                for(let i=0; i<r.values.length; i++) { histogram[Math.floor(r.values[i]/step)]++; }
                r.histogram = new Array(bins);
                let from = min;
                for(let i=0; i<bins; i++) {
                    r.histogram[i] = { label: "[" + from + ", " + (from+step) + ">", value: histogram[i], from: from, to: from+step };
                    from += step;
                }
            }
            return addArrayFunctions(r.histogram);
        },
        function() {
            this.initializeIfNecessary();
            this.getGroupBy().getReducer(this.getReducerId()).result.values.push(this.p[0].value());
        }
    );
    AggregateFunction.f.min = new AggregateFunction("min", 1, 1,
        function() { ; },
        function() { return this.getGroupBy().getReducer(this.getReducerId()).result; },
        function() {
            if((this.getGroupBy().getReducer(this.getReducerId()).result == undefined) ||
                this.p[0].value() < this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = this.p[0].value();
            }
        }
    );
    AggregateFunction.f.max = new AggregateFunction("max", 1, 1,
        function() { ; },
        function() { return this.getGroupBy().getReducer(this.getReducerId()).result; },
        function() {
            if((this.getGroupBy().getReducer(this.getReducerId()).result == undefined) ||
                this.p[0].value() > this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = this.p[0].value();
            }
        }
    );
    AggregateFunction.f.count = new AggregateFunction("count", 1, 1,
        function() {
            if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
                if(!this.distinct()) this.getGroupBy().getReducer(this.getReducerId()).result = 0;
                else this.getGroupBy().getReducer(this.getReducerId()).result = {};
            }
        },
        function() {
            if(!this.distinct()) return this.getGroupBy().getReducer(this.getReducerId()).result || (new Number(0));
            else return Object.keys(this.getGroupBy().getReducer(this.getReducerId()).result).length;
        },
        function() {
            this.initializeIfNecessary();
            if(!this.distinct()) {
                this.getGroupBy().getReducer(this.getReducerId()).result += 1;
            } else {
                const key = JSON.stringify((this.p[0].value().groupByKey && this.p[0].value().groupByKey()) || this.p[0].value());
                if(this.getGroupBy().getReducer(this.getReducerId()).result[key] == undefined) {
                    this.getGroupBy().getReducer(this.getReducerId()).result[key] = true;
                }
            }
        }
    );
    AggregateFunction.f.stdev = new AggregateFunction("stdev", 1, 1,
        function() {
            if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = [];
            }
        },
        function() {
            let sum = 0;
            const values = this.getGroupBy().getReducer(this.getReducerId()).result;
            for(let i=0; i<values.length; i++) sum += values[i];
            const avg = sum/values.length;
            sum = 0;
            for(let i=0; i<values.length; i++) sum += Math.pow(values[i]-avg, 2);
            return Math.sqrt(sum/(values.length-1));
        },
        function() {
            this.initializeIfNecessary();
            this.getGroupBy().getReducer(this.getReducerId()).result.push(this.p[0].value());
        }
    );
    AggregateFunction.f.collect = new AggregateFunction("collect", 1, 1,
        function() {
            if(!this.getGroupBy().getReducer(this.getReducerId()).result) {
                if(!this.distinct()) this.getGroupBy().getReducer(this.getReducerId()).result = addArrayFunctions([]);
                else this.getGroupBy().getReducer(this.getReducerId()).result = {};
            }
        },
        function() {
            if(!this.distinct()) return this.getGroupBy().getReducer(this.getReducerId()).result || addArrayFunctions([]);
            else return addArrayFunctions(Object.values(this.getGroupBy().getReducer(this.getReducerId()).result));
        },
        function() {
            this.initializeIfNecessary();
            const val = this.p[0].value();
            if(val == null && val == undefined) return;
            if(!this.distinct()) {
                this.getGroupBy().getReducer(this.getReducerId()).result.push(this.p[0].value());
            } else {
                const key = JSON.stringify((this.p[0].value().groupByKey && this.p[0].value().groupByKey()) || this.p[0].value());
                if(this.getGroupBy().getReducer(this.getReducerId()).result[key] == undefined) {
                    this.getGroupBy().getReducer(this.getReducerId()).result[key] = this.p[0].value();
                }
            }
        },
        List
    );
    AggregateFunction.trie = Trie.buildTrie(AggregateFunction.f);

    // PredicateFunctionLookup: for all(), any(), sum() predicate forms
    function PredicateFunctionLookup(_displayValue) {
        const displayValue = _displayValue;
        this.displayValue = function() { return displayValue; };
    }
    PredicateFunctionLookup.f = {};
    PredicateFunctionLookup.f.sum = new PredicateFunctionLookup("sum");
    PredicateFunctionLookup.f.all = new PredicateFunctionLookup("all");
    PredicateFunctionLookup.f.any = new PredicateFunctionLookup("any");
    PredicateFunctionLookup.trie = Trie.buildTrie(PredicateFunctionLookup.f);

    function Parser(_engine) {
        const engine = _engine;
        let statementText;
        let rollbackPosition = undefined;
        let position = 0;
        let token = '';
        let inQuotes = false;
        const forbiddenCharsList = '(): {}"\',.\n\r\t+-/*^[]=<>!';
        const forbiddenChars = {};
        let optional = false;

        // Parser-instance state for latest parsed items (replaces static .latestParsed)
        let latestKeyWord = null;
        let latestOperator = null;
        let latestFunction = null;
        let latestAggregateFunction = null;
        let latestPredicateFunction = null;

        let aggregationFunctionLevel = 0;
        const nestedAggregationFunction = function() { return aggregationFunctionLevel > 0; };
        const increaseAggregationFunctionLevel = function() { aggregationFunctionLevel++; };
        const decreaseAggregationFunctionLevel = function() { aggregationFunctionLevel--; };

        const setOptional = function() { optional = true; };
        const isOptional = function() { const o = optional; optional = false; return o; };

        const setupForbiddenChars = function() {
            for(let i=0; i<forbiddenCharsList.length; i++) {
                forbiddenChars[forbiddenCharsList[i]] = true;
            }
        };
        setupForbiddenChars();

        this.statementText = function() { return statementText; };
        this.position = function() { return position; };

        this.parse = function(_statementText) {
            statementText = _statementText;
            position = 0;
            token = '';
            optional = false;
            aggregationFunctionLevel = 0;
            latestKeyWord = null;
            latestOperator = null;
            latestFunction = null;
            latestAggregateFunction = null;
            latestPredicateFunction = null;
            parseToken();
        };

        const parseToken = function() {
            ignoreWhiteSpaceAndComments();
            if(parseLoad() || parseCreate() || parseMerge() || parseMatch() || parseWith() || parseReturn() || parseUnwind()) {
                parseToken();
            }
            if(more()) throw exception("Expected keyword.");
        };

        const parseUnwind = function() {
            ignoreWhiteSpaceAndComments();
            if(unwind()) {
                parseExpression();
                engine.expression();
                parseUnwindAlias();
                parseSetter();
                return true;
            }
            return false;
        };

        const parseLoad = function() {
            ignoreWhiteSpaceAndComments();
            if(load()) {
                ignoreWhiteSpaceAndComments();
                if(csv()) {
                    ignoreWhiteSpaceAndComments();
                    if(_with(true)) {
                        ignoreWhiteSpaceAndComments();
                        if(!headers()) throw exception("Expected HEADERS-keyword.");
                        engine.statement().context().headers();
                    }
                    ignoreWhiteSpaceAndComments();
                    if(from()) {
                        parseLoadFrom();
                        parseFieldTerminator();
                        ignoreWhiteSpaceAndComments();
                        if(!parseLoadAlias()) throw exception("Expected alias.");
                    } else {
                        throw exception("Expected FROM-keyword.");
                    }
                } else if(json() || text()) {
                    ignoreWhiteSpaceAndComments();
                    if(from()) { parseLoadFrom(); }
                    else throw exception("Expected FROM-keyword.");
                    ignoreWhiteSpaceAndComments();
                    let headersParsed = false;
                    if(headers()) { parseHeaders(); headersParsed = true; }
                    ignoreWhiteSpaceAndComments();
                    if(post()) { parsePost(); }
                    ignoreWhiteSpaceAndComments();
                    if(!headersParsed && headers()) { parseHeaders(); }
                    ignoreWhiteSpaceAndComments();
                    if(!parseLoadAlias()) throw exception("Expected alias.");
                } else {
                    throw exception("Expected CSV-, JSON-, or TEXT-keyword.");
                }
                return true;
            }
            return false;
        };

        const parseLoadFrom = function() { parseExpression(); engine.expression(); };
        const parsePost = function() { parseExpression(); engine.expression(); };
        const parseHeaders = function() {
            const array = parseAssociativeArray();
            if(array) engine.statement().context().setHTTPHeaders(array);
            else throw exception("Expected associative array.");
        };
        const parseFieldTerminator = function() {
            ignoreWhiteSpaceAndComments();
            if(fieldterminator()) {
                ignoreWhiteSpaceAndComments();
                if(parseString()) {
                    engine.statement().context().setFieldTerminator(getAndResetToken());
                } else {
                    throw exception("Expected single- or doublequoted string.");
                }
            }
        };

        const parseWith = function() {
            ignoreWhiteSpaceAndComments();
            if(_with()) {
                if(parseWithOrReturnBody(true)) {
                    parseSetter();
                    return true;
                }
            }
            return false;
        };
        const parseReturn = function() {
            ignoreWhiteSpaceAndComments();
            if(_return()) return parseWithOrReturnBody();
            return false;
        };
        const parseWithOrReturnBody = function(expressionMustHaveAlias) {
            do {
                ignoreWhiteSpaceAndComments();
                if(star()) {
                    addAllVariables();
                } else {
                    parseExpression();
                    engine.expression();
                    if(!parseAlias() && expressionMustHaveAlias && !engine.lastObject().hasKey()) {
                        throw exception("Expression in WITH must be aliased (use AS).");
                    }
                }
            } while(comma());
            parseWhere();
            ignoreWhiteSpaceAndComments();
            parseLimit();
            ignoreWhiteSpaceAndComments();
            if(into()) {
                ignoreWhiteSpaceAndComments();
                if(!parseTableName()) throw exception("Expected table name.");
                engine.insertInto(getAndResetToken());
            }
            return true;
        };

        const parseNodePattern = function(addPatternFlag) {
            if(openingParentheses()) {
                if(addPatternFlag) engine.pattern();
                engine.node();
                if(parseVariable(true)) {
                    const variableKey = getAndResetToken();
                    const parsedLabel = parseLabel();
                    const parsedProperties = parseProperties();
                    if(parsedLabel || parsedProperties) {
                        if(engine.variableExists(variableKey)) throw "It is not allowed to create a new node in this context.";
                        engine.variable(variableKey);
                    } else {
                        if(engine.variableExists(variableKey)) {
                            const referredObject = engine.getVariable(variableKey).getObject();
                            if(referredObject.constructor != Unwind && !referredObject.isNode()) {
                                throw "Variable `" + variableKey + "` is bound to a " + referredObject.type() + ".";
                            }
                            engine.lastObject().setReferredNode(referredObject);
                        } else {
                            engine.variable(variableKey);
                        }
                    }
                } else {
                    parseLabel();
                    parseProperties();
                }
                if(!closingParentheses()) throw exception('Expecting closing parentheses.');
                return true;
            }
            return false;
        };

        const parsePathLengthConstraints = function() {
            if(star()) {
                if(engine.operation() == "Merge" || engine.operation() == "Create") {
                    throw 'Variable path length not supported in this context.';
                }
                engine.context().setHasVariablePathLength();
                if(parsePositiveInteger()) {
                    engine.context().setPathLengthFrom(parseInt(getAndResetToken()));
                }
                if(dot()) {
                    if(dot()) {
                        if(parsePositiveInteger()) {
                            engine.context().setPathLengthTo(parseInt(getAndResetToken()));
                        }
                    } else {
                        throw exception('Expected "."');
                    }
                }
                return true;
            }
            return false;
        };

        const parseRelationshipPattern = function() {
            const _relationshipLeftDirection = relationshipLeftDirection();
            if(relationshipLine()) {
                engine.relationship();
                if(_relationshipLeftDirection) engine.leftDirection();
                if(openingSquareBracket()) {
                    if(parseVariable(true)) {
                        const variableKey = getAndResetToken();
                        const parsedType = parseType();
                        const parsedProperties = parseProperties();
                        const parsedPathLengthConstraints = parsePathLengthConstraints();
                        if(parsedType || parsedProperties || parsedPathLengthConstraints) {
                            if(engine.variableExists(variableKey)) throw "It is not allowed to create a new relationship in this context.";
                            engine.variable(variableKey);
                        } else {
                            if(engine.variableExists(variableKey)) {
                                const referredObject = engine.getVariable(variableKey).getObject();
                                if(!referredObject.isRelationship()) throw "Variable `" + variableKey + "` is bound to a " + referredObject.type() + ".";
                                engine.lastObject().setReferredRelationship(referredObject);
                            } else {
                                engine.variable(variableKey);
                            }
                        }
                    } else {
                        parseType();
                        parseProperties();
                        parsePathLengthConstraints();
                    }
                    if(!closingSquareBracket()) throw exception("Expected closing square bracket.");
                    if(!relationshipLine()) throw exception("Expected relationship line.");
                    if(relationshipRightDirection()) engine.rightDirection();
                    return true;
                } else {
                    throw exception("Expected opening square bracket.");
                }
            }
            return false;
        };

        const parseGraphPatternExpression = function() {
            setRollbackPosition();
            if(!openingParentheses()) return false;
            else position--;
            let resetContext = false;
            try {
                const patternExpressionElement = parseNodePatternExpression();
                if(patternExpressionElement) {
                    while(parseRelationshipPatternExpression(patternExpressionElement)) {
                        if(!parseNodePatternExpression(patternExpressionElement)) throw exception("Expecting node pattern.");
                    }
                    patternExpressionElement.element().useAsCondition();
                    statement.resetContext();
                    return patternExpressionElement;
                }
            } catch(e) {
                resetContext = true;
                statement.resetContext();
                throw e;
            }
            if(!resetContext) statement.resetContext();
            return false;
        };

        const parseNodePatternExpression = function(_patternExpressionElement) {
            let patternExpressionElement = _patternExpressionElement;
            let parsedPattern = false;
            setRollbackPosition();
            if(openingParentheses()) {
                setOptional();
                const referredObject = parseExpressionLayer();
                if(!patternExpressionElement) {
                    patternExpressionElement = addPattern(new Pattern());
                    statement.setContext(patternExpressionElement.element());
                }
                patternExpressionElement.element().addNode(new PatternNode(db));
                if(referredObject && isNodeExpression_check(referredObject)) {
                    patternExpressionElement.element().lastObject().setReferredNode(referredObject);
                    parsedPattern = true;
                }
                if(parseLabel()) parsedPattern = true;
                if(parseProperties()) parsedPattern = true;
                if(!closingParentheses()) {
                    if(parsedPattern) throw exception('Expecting closing parentheses.');
                    rollback();
                    removeLastPattern();
                    return false;
                }
                if(!isNodeExpression(patternExpressionElement.element().lastObject())) {
                    rollback();
                    removeLastPattern();
                    return false;
                }
                return patternExpressionElement;
            }
            return false;
        };

        const isNodeExpression_check = function(o) {
            return o.rootObject && o.rootObject().constructor == PatternNode;
        };
        const isNodeExpression = function(node) {
            if(node.getLabels().length > 0) return true;
            if(node.getProperties && node.getProperties().length > 0) return true;
            if(node.getReferredNode && node.getReferredNode()) return true;
            return true; // Empty node pattern is valid
        };

        const parseRelationshipPatternExpression = function(patternExpressionElement) {
            const _relationshipLeftDirection = relationshipLeftDirection();
            if(relationshipLine()) {
                patternExpressionElement.element().addRelationship(new PatternRelationship(db));
                if(_relationshipLeftDirection) patternExpressionElement.element().lastObject().setLeftDirection(true);
                if(openingSquareBracket()) {
                    let referredObject;
                    if(parseVariable(true)) {
                        const variableKey = getAndResetToken();
                        if(!engine.variableExists(variableKey)) throw "Variable \"" + variableKey + "\" does not exist.";
                        referredObject = engine.getVariable(variableKey).getObject();
                        if(!referredObject.isRelationship()) throw "Variable `" + variableKey + "` is bound to a " + referredObject.type() + ".";
                        patternExpressionElement.element().lastObject().setReferredRelationship(engine.getVariable(variableKey).getObject());
                    }
                    parseType();
                    parseProperties();
                    if(parsePathLengthConstraints() && referredObject) throw "Path expansion not allowed for referred relationship.";
                    if(!closingSquareBracket()) throw exception("Expected closing square bracket.");
                    if(!relationshipLine()) throw exception("Expected relationship line.");
                    if(relationshipRightDirection()) patternExpressionElement.element().lastObject().setRightDirection(true);
                    return true;
                } else {
                    throw exception("Expected opening square bracket.");
                }
            }
            return false;
        };

        const parseGraphPattern = function(pathVariableNotAllowed) {
            let pathVariableName = undefined;
            if(parseVariable(true)) {
                ignoreWhiteSpaceAndComments();
                if(pathVariableNotAllowed && equals()) throw exception("Path variable not allowed in this context.");
                pathVariableName = getAndResetToken();
                if(!equals()) throw exception("Expected variable assignment.");
                ignoreWhiteSpaceAndComments();
            }
            let shortestPath = false;
            let nodeCount = 0, relationshipCount = 0;
            if(shortestpath()) {
                shortestPath = true;
                getAndResetToken();
                if(!openingParentheses()) throw exception("Expected opening parentheses.");
            }
            if(parseNodePattern(true)) {
                nodeCount++;
                if(pathVariableName) {
                    statement.addVariable(pathVariableName, statement.context().getLast().getPattern());
                }
                while(parseRelationshipPattern()) {
                    if(!parseNodePattern()) throw exception("Expecting node pattern.");
                    nodeCount++;
                    relationshipCount++;
                }
            }
            if(shortestPath && (relationshipCount == 0 || relationshipCount > 1)) throw "Expected single relationship pattern.";
            if(shortestPath && !closingParentheses()) throw exception("Expected closing parentheses.");
            if(shortestPath) statement.context().getPattern().shortestpath();
            if(nodeCount > 0) return true;
            return false;
        };

        const parseMerge = function() {
            ignoreWhiteSpaceAndComments();
            if(merge()) {
                ignoreWhiteSpaceAndComments();
                if(!parseGraphPattern()) throw exception('Expecting graph pattern.');
                parseWhere();
                parseSetter();
                return true;
            }
            return false;
        };

        const parseCreate = function() {
            ignoreWhiteSpaceAndComments();
            if(create()) {
                do {
                    ignoreWhiteSpaceAndComments();
                    if(!parseGraphPattern()) throw exception('Expecting graph pattern.');
                } while(comma());
                parseWhere();
                parseSetter();
                return true;
            }
            return false;
        };

        const parseMatch = function() {
            ignoreWhiteSpaceAndComments();
            if(match()) {
                do {
                    ignoreWhiteSpaceAndComments();
                    if(!parseGraphPattern()) throw exception('Expecting graph pattern.');
                } while(comma());
                parseWhere();
                parseSetter();
                return true;
            }
            return false;
        };

        const parseWhere = function() {
            if(where()) {
                parseExpression();
                engine.where(parser.getExpression());
            }
        };

        const parseSetter = function() {
            ignoreWhiteSpaceAndComments();
            if(set()) {
                engine.setter();
                do {
                    if(!parseVariable(true)) throw exception('Expected variable.');
                    const variable = engine.getVariable(getAndResetToken());
                    if(dot()) {
                        let propertyKey;
                        if(parsePropertyKey()) { propertyKey = getAndResetToken(); }
                        else throw exception("Expected property key.");
                        ignoreWhiteSpaceAndComments();
                        if(!equals()) throw exception('Expected equals character (=).');
                        ignoreWhiteSpaceAndComments();
                        parseExpression();
                        const expression = parser.getExpression();
                        engine.operationContext().addSetter(variable, propertyKey, expression);
                    } else {
                        const variableType = variable.getObject().constructor;
                        if(variableType != PatternNode && variableType != PatternRelationship) {
                            throw "Can't assign a label/type to a non-node/relationship variable.";
                        }
                        if(colon()) {
                            if(!parseExpression()) throw "Expected expression.";
                            const expression = parser.getExpression();
                            if(variableType == PatternNode) engine.operationContext().addLabelSetter(variable, expression);
                            else if(variableType == PatternRelationship) engine.operationContext().addTypeSetter(variable, expression);
                        } else if(plus_equals()) {
                            if(!parseExpression()) throw "Expected expression.";
                            const expression = parser.getExpression();
                            if(variableType == PatternNode || variableType == PatternRelationship) {
                                engine.operationContext().addMapSetter(variable, expression);
                            }
                        }
                    }
                } while(comma());
            }
        };

        const parseLimit = function() {
            if(limit()) {
                parseExpression(true);
                engine.limit(parser.getExpression());
            }
        };

        const parseExpression = function(variablesNotAllowed) {
            let parsedConstruct;
            let allowLookup = true, element;

            if((element = parseGraphPatternExpression())) {
                allowLookup = false;
            } else if(openingParentheses()) {
                addOpeningParentheses();
                element = parseExpression(variablesNotAllowed);
                if(!closingParentheses()) throw exception("Expected closing parentheses.");
                addClosingParentheses();
            } else if((parsedConstruct = parsePredicateFunction())) {
                element = addPredicateFunction(parsedConstruct);
                allowLookup = false;
            } else if(_function()) {
                element = parseFunction();
            } else if(aggregateFunction()) {
                element = parseAggregateFunction();
            } else if(parseConstant()) {
                element = addConstant(getAndResetToken());
            } else if((parsedConstruct = parseCase())) {
                addCase(parsedConstruct);
                allowLookup = false;
            } else if((parsedConstruct = parseFString())) {
                addFString(parsedConstruct);
            } else if(parseVariable(true)) {
                if(variablesNotAllowed) throw exception("Variables not allowed within this context.");
                element = addVariable(getAndResetToken());
            } else if((parsedConstruct = parseList())) {
                element = addList(parsedConstruct);
            } else if((parsedConstruct = parseAssociativeArray())) {
                element = addAssociativeArray(parsedConstruct);
            } else {
                if(!isOptional()) throw exception("Expected expression");
            }
            if(element && allowLookup) parseLookup(element);
            ignoreWhiteSpaceAndComments();
            if(operator()) {
                addOperator(latestOperator);
                ignoreWhiteSpaceAndComments();
                parseExpression();
            }
            return element;
        };

        const parseExpressionLayer = function() {
            parser.addLayer();
            parseExpression();
            const expression = parser.getExpression();
            parser.finishLayer();
            return expression;
        };

        const parseLookup = function(element) {
            while(1) {
                if(dot()) {
                    if(parsePropertyKey()) addObjectLookup(element, getAndResetToken());
                    else throw exception("Expected property key.");
                } else if(parseListIndex(element)) {
                    ;
                } else {
                    noLookup();
                    break;
                }
            }
        };

        const parseListIndex = function(element) {
            if(openingSquareBracket()) {
                addListLookup(element, parseExpressionLayer());
                if(!closingSquareBracket()) throw exception("Expected closing square bracket.");
                return true;
            }
            return false;
        };

        const parseCase = function() {
            if(_case()) {
                ignoreWhiteSpaceAndComments();
                const caseStatement = new Case();
                while(when()) {
                    caseStatement.when(parseExpressionLayer());
                    ignoreWhiteSpaceAndComments();
                    if(_then()) caseStatement.then(parseExpressionLayer());
                    else throw exception("Expected THEN keyword");
                    ignoreWhiteSpaceAndComments();
                }
                if(caseStatement.whenCount() == 0) throw exception("Expected WHEN keyword");
                ignoreWhiteSpaceAndComments();
                if(_else()) caseStatement.else(parseExpressionLayer());
                ignoreWhiteSpaceAndComments();
                if(!end()) throw exception("Expected END keyword");
                return caseStatement;
            }
            return false;
        };

        const parseAssociativeArray = function() {
            if(openingCurlyBrackets()) {
                const associativeArray = new AssociativeArray();
                do {
                    if(parsePropertyKey()) {
                        const key = getAndResetToken();
                        if(!colon()) throw exception("Expected colon.");
                        associativeArray.addEntry(key, parseExpressionLayer());
                    }
                } while(comma());
                if(!closingCurlyBrackets()) throw exception("Expected closing curly bracket.");
                return associativeArray;
            }
            return false;
        };

        const parseList = function() {
            if(openingSquareBracket()) {
                const list = new List();
                do {
                    setOptional();
                    list.add(parseExpressionLayer());
                } while(comma());
                if(!closingSquareBracket()) throw exception("Expected closing bracket.");
                return list;
            }
            return false;
        };

        const parseAggregateFunction = function() {
            if(nestedAggregationFunction()) throw exception("Not allowed to nest aggregation functions.");
            if(openingParentheses()) {
                const aggregateExpressionElement = addAggregateFunction(latestAggregateFunction);
                addOpeningParentheses();
                increaseAggregationFunctionLevel();
                ignoreWhiteSpaceAndComments();
                if(distinct()) aggregateExpressionElement.setDistinct();
                ignoreWhiteSpaceAndComments();
                if(latestAggregateFunction.parametric()) {
                    let parameterCount = 0;
                    do { parseFunctionParameter(); parameterCount++; } while(comma());
                    try { aggregateExpressionElement.verifyParsedParameterCount(parameterCount); }
                    catch(e) { throw exception(e); }
                }
                if(closingParentheses()) {
                    addClosingParentheses();
                    decreaseAggregationFunctionLevel();
                } else {
                    throw exception("Expected closing parentheses.");
                }
                return aggregateExpressionElement;
            } else {
                throw exception("Expected opening parentheses.");
            }
        };

        const parseFunction = function() {
            if(openingParentheses()) {
                const functionElement = addFunction(latestFunction);
                addOpeningParentheses();
                if(latestFunction.parametric()) {
                    let parameterCount = 0;
                    do { parseFunctionParameter(); parameterCount++; } while(comma());
                    try { functionElement.verifyParsedParameterCount(parameterCount); }
                    catch(e) { throw exception(e); }
                }
                if(closingParentheses()) addClosingParentheses();
                else throw exception("Expected closing parentheses.");
                return functionElement;
            } else {
                throw exception("Expected opening parentheses.");
            }
        };

        const parseFunctionParameter = function() { addExpression(parseExpressionLayer()); };

        const parsePredicateFunction = function() {
            const initialPosition = position;
            const result = Trie.isF(PredicateFunctionLookup.trie, statementText, position);
            if(result.length > 0) {
                position += result.length;
                latestPredicateFunction = result.matched;
                if(openingParentheses(false, true)) {
                    const predicate = new Predicate();
                    predicate.setPredicateFunctionName(latestPredicateFunction.displayValue());
                    ignoreWhiteSpaceAndComments();
                    if(parseVariable(true)) {
                        const variableKey = getAndResetToken();
                        predicate.variable(variableKey);
                        ignoreWhiteSpaceAndComments();
                        if(_in()) {
                            ignoreWhiteSpaceAndComments();
                            const listExpression = parseExpressionLayer();
                            if(!listExpression) throw exception("Expected list.");
                            predicate.list(listExpression);
                            ignoreWhiteSpaceAndComments();
                            if(!where()) throw exception("Expected WHERE-keyword.");
                            ignoreWhiteSpaceAndComments();
                            const expression = parseExpressionLayer();
                            predicate.where(expression);
                            ignoreWhiteSpaceAndComments();
                            if(!closingParentheses()) throw exception("Expected closing parentheses.");
                            return predicate;
                        }
                    }
                }
            }
            position = initialPosition;
            return false;
        };

        const parseVariable = function(dontAddToEngine) {
            const addToEngine = !dontAddToEngine;
            ignoreWhiteSpaceAndComments();
            if(isNumeric(currentChar())) return false;
            if(backTickQuote()) {
                while(more() && !backTickQuote()) { token += currentChar(); position++; }
            } else {
                while(more() && !forbiddenChars[currentChar()]) { token += currentChar(); position++; }
            }
            if(token.length > 0 && validVariableName()) {
                if(addToEngine) engine.variable(getAndResetToken());
                return true;
            }
            return false;
        };

        const parseAliasLabel = function() { return parseVariable(true); };
        const parseLoadAliasLabel = function() { return parseVariable(false); };
        const parseUnwindAliasLabel = function() { return parseVariable(false); };
        const parseTableName = function() { return parseVariable(true); };

        const parseLabel = function() {
            ignoreWhiteSpaceAndComments();
            if(!colon()) return false;
            let labelName = '';
            if(backTickQuote()) {
                while(more() && !backTickQuote()) { labelName += currentChar(); position++; }
            } else {
                while(more() && !forbiddenChars[currentChar()]) { labelName += currentChar(); position++; }
            }
            if(labelName == '') throw exception('Expecting label name.');
            engine.label(labelName);
            parseLabel();
            return true;
        };

        const parseType = function() {
            ignoreWhiteSpaceAndComments();
            if(!colon()) return false;
            let typeName = '';
            if(backTickQuote()) {
                while(more() && !backTickQuote()) { typeName += currentChar(); position++; }
            } else {
                while(more() && !forbiddenChars[currentChar()]) { typeName += currentChar(); position++; }
            }
            if(typeName == '') throw exception('Expecting type name.');
            engine.type(typeName);
            return true;
        };

        const parseProperties = function() {
            ignoreWhiteSpaceAndComments();
            if(openingCurlyBrackets()) {
                if(!parseProperty()) throw exception('Expecting at least one property.');
                if(!closingCurlyBrackets()) throw exception('Expecting closing curly brackets.');
                return true;
            }
            return false;
        };

        const parseProperty = function() {
            if(parsePropertyKey()) engine.propertyKey(getAndResetToken());
            else return false;
            if(!colon()) throw exception("Expected colon.");
            engine.propertyValue(parseExpressionLayer());
            if(comma()) return parseProperty();
            return true;
        };

        const parsePropertyKey = function() {
            ignoreWhiteSpaceAndComments();
            if(isNumeric(currentChar())) return false;
            if(backTickQuote()) {
                while(more() && !backTickQuote()) { token += currentChar(); position++; }
            } else {
                while(more() && !forbiddenChars[currentChar()]) { token += currentChar(); position++; }
            }
            if(token.length == 0) return false;
            return true;
        };

        const parseString = function() {
            let quoteFunction = null;
            if(singleQuote()) quoteFunction = singleQuote;
            else if(doubleQuote()) quoteFunction = doubleQuote;
            else if(backTickQuote()) quoteFunction = backTickQuote;
            else return false;
            inQuotes = true;
            while(!quoteFunction()) {
                if(!more()) throw exception("Expected closing quote.");
                escape();
                token += currentChar();
                position++;
            }
            inQuotes = false;
            return true;
        };

        const parseFString = function() {
            if(currentChar() != 'f') return false;
            position++;
            let quoteFunction = null;
            if(singleQuote()) quoteFunction = singleQuote;
            else if(doubleQuote()) quoteFunction = doubleQuote;
            else if(backTickQuote()) quoteFunction = backTickQuote;
            else { position--; return false; }
            const fstring = new FString();
            inQuotes = true;
            while(!quoteFunction()) {
                if(!more()) throw exception("Expected closing quote.");
                escape();
                if(openingDoubleCurlyBrackets()) {
                    token += "{";
                    while(more() && !closingDoubleCurlyBrackets()) { escape(); token += currentChar(); position++; }
                    if(!more()) throw exception("Expected closing double curly bracket.");
                    token += "}";
                }
                if(openingCurlyBrackets(true)) {
                    const substring = getAndResetToken();
                    const expression = parseExpressionLayer();
                    if(!expression) throw exception("Expected expression.");
                    if(!closingCurlyBrackets(true)) throw exception("Expected closing curly bracket.");
                    if(substring.length > 0) fstring.string(substring);
                    fstring.expression(expression);
                }
                if(quoteFunction()) break;
                token += currentChar();
                position++;
            }
            inQuotes = false;
            if(token.length > 0) fstring.string(getAndResetToken());
            return fstring;
        };

        const parseConstant = function() {
            if(parseString()) { ; }
            else if(parseNumber()) { token = parseFloat(token); }
            else if(_true()) { token = true; }
            else if(_false()) { token = false; }
            else if(_null()) { token = null; }
            else return false;
            return true;
        };

        const parseAlias = function() {
            ignoreWhiteSpaceAndComments();
            if(as()) {
                if(!parseAliasLabel()) throw exception("Expected alias variable key.");
                engine.as(getAndResetToken());
                return true;
            }
            return false;
        };
        const parseLoadAlias = function() {
            ignoreWhiteSpaceAndComments();
            if(as()) {
                if(!parseLoadAliasLabel()) throw exception("Expected alias variable key.");
                engine.as(getAndResetToken());
                return true;
            }
            return false;
        };
        const parseUnwindAlias = function() {
            ignoreWhiteSpaceAndComments();
            if(as()) {
                if(!parseUnwindAliasLabel()) throw exception("Unwinded collection must be aliased.");
                return true;
            }
            return false;
        };

        // ── ExpressionTreeBuilder (Shunting Yard Algorithm) ──

        function VariableReference(eng, variableKey) {
            const _engine = eng;
            const _variableKey = variableKey;
            const me = this;

            const getVariable = function() {
                if(me.parent && me.parent.getLocalVariable) {
                    const value = me.parent.getLocalVariable(_variableKey);
                    if(value) return value;
                }
                return _engine.statement().getVariable(_variableKey);
            };
            this.getObject = function() { return getVariable().getObject(); };
            this.value = function(asKey) { return getVariable().value(asKey); };
            this.getKey = function() { return _variableKey; };
            this.type = function() { return getVariable().getObject().type(); };
            this.groupByKey = function() {
                const o = getVariable().getObject();
                return (o.groupByKey && o.groupByKey()) || o;
            };
            this.groupByValue = function() {
                const o = getVariable().getObject();
                return (o.groupByValue && o.groupByValue()) || o;
            };
        }

        function ExpressionElement(_element) {
            const element = _element;
            let precalculatedReadCount = 0;
            let precalculatedValue = undefined;
            let originalValueFunction = undefined;
            const me = this;
            const elementValueContext = this;
            let parsedParameterCount = 0;
            let expression = undefined;

            element.parent = me;

            this.element = function() { return element; };
            this.precalculate = function() {
                precalculatedReadCount = 0;
                precalculatedValue = this.value();
                originalValueFunction = this.value;
                setValueFunction(consumePrepalculatedValue);
            };
            const consumePrepalculatedValue = function() {
                if(precalculatedValue && precalculatedReadCount == 0) {
                    precalculatedReadCount++;
                    return precalculatedValue;
                } else if(precalculatedValue && precalculatedReadCount == 1) {
                    const tmp = precalculatedValue;
                    precalculatedValue = undefined;
                    precalculatedReadCount = 0;
                    setValueFunction(originalValueFunction);
                    return tmp;
                }
                return undefined;
            };
            const setValueFunction = function(valueFunction) {
                me.value = valueFunction;
                me.groupByKey = me.value;
                me.groupByValue = me.value;
            };
            this.elementValueContext = function() { return elementValueContext; };
            this.elementValue = function() { return element.value.call(elementValueContext); };
            this.type = element.type;
            this.value = this.elementValue;
            this.groupByKey = element.groupByKey || this.elementValue;
            this.groupByValue = element.groupByValue || this.elementValue;
            this.hasKey = function() { return element.getKey && element.getKey(); };
            this.parsedParameterCount = function() { return parsedParameterCount; };
            this.verifyParsedParameterCount = function(_parsedParameterCount) {
                if(element.constructor == _Function || element.constructor == AggregateFunction) {
                    parsedParameterCount = _parsedParameterCount;
                    element.verifyParsedParameterCount(parsedParameterCount);
                }
            };
            this.non_deterministic = function() { return element.non_deterministic(); };
            this.mappable = function() {
                if(element.mappable && !element.mappable()) return false;
                if(this.p) {
                    for(let i=0; i<this.p.length; i++) {
                        if(this.p[i].mappable && !this.p[i].mappable()) return false;
                    }
                }
                return true;
            };
            this.setExpression = function(_expression) { expression = _expression; };
            this.getLocalVariable = function(key) {
                if(expression) return expression.getLocalVariable(key);
                return undefined;
            };
        }

        function AggregateExpressionElement(_element) {
            ExpressionElement.call(this, _element);
            let distinct = false;
            let groupBy;
            let reducerId;
            this.setReducer = function(_reducerId) { reducerId = _reducerId; };
            this.setGroupBy = function(_groupBy) { groupBy = _groupBy; };
            this.getGroupBy = function() { return groupBy; };
            this.getReducerId = function() { return reducerId; };
            this.initializeIfNecessary = function() { this.initialize(); };
            this.initialize = function() { return this.element().initialize.call(this.elementValueContext()); };
            this.aggregate = function() { return this.element().aggregate.call(this.elementValueContext()); };
            this.value = function() { return this.element().value.call(this.elementValueContext()); };
            this.groupByKey = function() { return this.element().groupByKey.call(this.elementValueContext()); };
            this.groupByValue = function() { return this.element().groupByValue.call(this.elementValueContext()); };
            this.hasKey = function() { return this.element().getKey && this.element().getKey(); };
            this.distinct = function() { return distinct; };
            this.setDistinct = function() { distinct = true; };
            this.mappable = function() { return false; };
        }
        AggregateExpressionElement.prototype = Object.create(ExpressionElement.prototype);
        AggregateExpressionElement.prototype.constructor = AggregateExpressionElement;

        // Shunting Yard data structures
        let layers = [];
        let output = [];
        let operators = [];
        let expressionElements = [];

        const recordExpressionElement = function(element) {
            expressionElements.push(element);
            return element;
        };
        const reset = function() { output = []; operators = []; expressionElements = []; };
        const lastOutput = function() {
            if(output.length == 0) return null;
            return output[output.length-1];
        };
        const lastOperator = function() {
            if(operators.length == 0) return null;
            return operators[operators.length-1];
        };

        this.addLayer = function() {
            layers.push({ output: output, operators: operators, expressionElements: expressionElements, rollbackPosition: rollbackPosition });
            reset();
        };
        this.finishLayer = function() {
            const layer = layers.pop();
            output = layer.output;
            operators = layer.operators;
            expressionElements = layer.expressionElements;
            rollbackPosition = layer.rollbackPosition;
        };

        const addOutput = function(o) { output.push(o); return lastOutput(); };
        const addToOperators = function(o) { operators.push(o); return lastOperator(); };

        const precedenceConditionIsMet = function(op1, op2) {
            if(op1.leftAssociativity() && op1.precedence() <= op2.precedence()) return true;
            else if(op1.rightAssociativity() && op1.precedence() < op2.precedence()) return true;
            return false;
        };
        const addObjectLookup = function(element, key) {
            if(!element.lookups) element.lookups = [];
            element.lookups.push({
                function: _Function.f.object_lookup,
                index: recordExpressionElement(new ExpressionElement(new Constant(key)))
            });
        };
        const addListLookup = function(element, expression) {
            if(!element.lookups) element.lookups = [];
            element.lookups.push({
                function: _Function.f.array_lookup,
                index: recordExpressionElement(new ExpressionElement(expression))
            });
        };
        const noLookup = function() { ; };
        const addConstant = function(value) {
            return addOutput({ isAtom: true, v: recordExpressionElement(new ExpressionElement(new Constant(value))) }).v;
        };
        const addAllVariables = function() {
            const vars = engine.statement().context().variables();
            for(let i=0; i<vars.length; i++) {
                addVariable(vars[i].getObjectKey());
                engine.expression();
            }
        };
        const addVariable = function(key) {
            return addOutput({
                isAtom: true, isVariable: true,
                v: recordExpressionElement(new ExpressionElement(new VariableReference(engine, key)))
            }).v;
        };
        const addPattern = function(pattern) {
            return addOutput({ isAtom: true, v: recordExpressionElement(new ExpressionElement(pattern)) }).v;
        };
        const removeLastPattern = function() {
            if(lastOutput() && lastOutput().v.element().constructor == Pattern) output.pop();
        };
        const addExpression = function(expression) {
            return addOutput({ isAtom: true, v: recordExpressionElement(new ExpressionElement(expression)) }).v;
        };
        const addList = function(list) {
            return addOutput({ isAtom: true, v: recordExpressionElement(new ExpressionElement(list)) }).v;
        };
        const addAssociativeArray = function(associativeArray) {
            return addOutput({ isAtom: true, v: recordExpressionElement(new ExpressionElement(associativeArray)) }).v;
        };
        const addCase = function(_case) {
            return addOutput({ isAtom: true, v: recordExpressionElement(new ExpressionElement(_case)) }).v;
        };
        const addPredicateFunction = function(predicateFunction) {
            return addOutput({ isAtom: true, v: recordExpressionElement(new ExpressionElement(predicateFunction)) }).v;
        };
        const addFString = function(fstring) {
            return addOutput({ isAtom: true, v: recordExpressionElement(new ExpressionElement(fstring)) }).v;
        };
        const addFunction = function(__function) {
            return addToOperators({ isFunction: true, v: recordExpressionElement(new ExpressionElement(__function)) }).v;
        };
        const addAggregateFunction = function(_aggregateFunction) {
            return addToOperators({ isAggregateFunction: true, isFunction: true, v: recordExpressionElement(new AggregateExpressionElement(_aggregateFunction)) }).v;
        };
        const addOperator = function(operator) {
            while(operators.length > 0 && ((operators.slice(-1)[0].isOperator || operators.slice(-1)[0].isFunction) &&
                precedenceConditionIsMet(operator, operators.slice(-1)[0].v.element()))) {
                output.push(operators.pop());
            }
            return addToOperators({ isOperator: true, v: recordExpressionElement(new ExpressionElement(operator)) }).v;
        };
        const addOpeningParentheses = function() { addToOperators({leftParentheses: true}); };
        const addClosingParentheses = function() {
            while(operators.length > 0 && !operators.slice(-1)[0].leftParentheses) { output.push(operators.pop()); }
            operators.pop();
        };

        const finish = function() {
            while(operators.length > 0) { output.push(operators.pop()); }
            const expressionTreeNodes = addArrayFunctions([]);
            let aggregationFunctions, variableReferences = [];
            let non_deterministic = false;
            let currentOutput;
            while(output.length > 0) {
                currentOutput = output.shift();
                if(currentOutput.isOperator) {
                    currentOutput.v.rhs = expressionTreeNodes.pop().v;
                    currentOutput.v.lhs = expressionTreeNodes.pop().v;
                } else if(currentOutput.isFunction) {
                    currentOutput.v.p = [];
                    for(let j=0; j<currentOutput.v.parsedParameterCount(); j++) {
                        currentOutput.v.p.unshift(expressionTreeNodes.pop().v);
                    }
                    if(currentOutput.isAggregateFunction) {
                        if(!aggregationFunctions) aggregationFunctions = [];
                        aggregationFunctions.push(currentOutput.v);
                    }
                    if(currentOutput.v.element().non_deterministic) non_deterministic = true;
                }
                if(currentOutput.isVariable) {
                    variableReferences.push(currentOutput.v.element().getKey());
                }
                if(currentOutput.v.lookups) {
                    const lookups = currentOutput.v.lookups;
                    let tmpElement;
                    while(lookups && lookups.length > 0) {
                        tmpElement = currentOutput.v;
                        const lookup = lookups.shift();
                        currentOutput.v = new ExpressionElement(lookup.function);
                        currentOutput.v.p = [tmpElement, lookup.index];
                    }
                }
                expressionTreeNodes.push(currentOutput);
            }
            if(expressionTreeNodes.length == 0) return null;
            const expression = new Expression(
                expressionTreeNodes.pop().v,
                "expr",
                aggregationFunctions,
                engine.statement().context(),
                variableReferences,
                non_deterministic
            );
            for(let i=0; i<expressionElements.length; i++) { expressionElements[i].setExpression(expression); }
            reset();
            return expression;
        };

        this.getExpression = function() { return finish(); };

        // ── Lexer utility functions ───────────────────────

        const create = function() { return keyword(KeyWord.f.CREATE); };
        const match = function() { return keyword(KeyWord.f.MATCH); };
        const merge = function() { return keyword(KeyWord.f.MERGE); };
        const shortestpath = function() { return keyword(KeyWord.f.SHORTESTPATH); };

        const _function = function() {
            const result = Trie.isF(_Function.trie, statementText, position);
            if(result.length > 0) {
                position += result.length;
                if(openingParentheses(true, true)) {
                    latestFunction = result.matched;
                    return true;
                }
                position -= result.length;
            }
            return false;
        };

        const aggregateFunction = function() {
            const result = Trie.isF(AggregateFunction.trie, statementText, position);
            if(result.length > 0) {
                position += result.length;
                latestAggregateFunction = result.matched;
                return true;
            }
            return false;
        };

        const _with = function(noAction) { return keyword(KeyWord.f.WITH, noAction); };
        const _return = function() { return keyword(KeyWord.f.RETURN); };
        const into = function() { return keyword(KeyWord.f.INTO); };
        const limit = function() { return keyword(KeyWord.f.LIMIT); };
        const where = function() { return keyword(KeyWord.f.WHERE); };
        const load = function() { return keyword(KeyWord.f.LOAD); };
        const unwind = function() { return keyword(KeyWord.f.UNWIND); };
        const csv = function() { return keyword(KeyWord.f.CSV); };
        const json = function() { return keyword(KeyWord.f.JSON); };
        const text = function() { return keyword(KeyWord.f.TEXT); };
        const headers = function() { return keyword(KeyWord.f.HEADERS); };
        const from = function() { return keyword(KeyWord.f.FROM); };
        const post = function() { return keyword(KeyWord.f.POST); };
        const as = function() { return keyword(KeyWord.f.AS); };
        const fieldterminator = function() { return keyword(KeyWord.f.FIELDTERMINATOR); };
        const set = function() { return keyword(KeyWord.f.SET); };
        const distinct = function() { return keyword(KeyWord.f.DISTINCT); };
        const _true = function() { return keyword(KeyWord.f.TRUE); };
        const _false = function() { return keyword(KeyWord.f.FALSE); };
        const _null = function() { return keyword(KeyWord.f.NULL); };
        const _case = function() { return keyword(KeyWord.f.CASE); };
        const when = function() { return keyword(KeyWord.f.WHEN); };
        const _then = function() { return keyword(KeyWord.f.THEN); };
        const _else = function() { return keyword(KeyWord.f.ELSE); };
        const end = function() { return keyword(KeyWord.f.END); };
        const _in = function() { return keyword(KeyWord.f.IN); };

        const operator = function() {
            const result = Trie.isF(Operator.trie, statementText, position, true);
            if(result.length > 0) {
                latestOperator = result.matched;
                position += result.length;
                return true;
            }
            return false;
        };

        const keyword = function(which, noAction) {
            const result = Trie.isF(KeyWord.trie, statementText, position);
            if(result.length > 0 && result.matched === which) {
                latestKeyWord = result.matched;
                if(!noAction) latestKeyWord.action(engine);
                position += result.length;
                return true;
            }
            return false;
        };

        const parseNumber = function() {
            ignoreWhiteSpaceAndComments();
            let negated = false;
            if(negation()) { accumulatePreviousChar(); negated = true; }
            if(numeric()) {
                accumulatePreviousChar();
                while(numeric()) accumulatePreviousChar();
                if(dot()) {
                    accumulatePreviousChar();
                    if(numeric()) {
                        accumulatePreviousChar();
                        while(numeric()) accumulatePreviousChar();
                    } else {
                        throw exception('Expected one or more integers after decimal point.');
                    }
                }
                ignoreWhiteSpaceAndComments();
            } else {
                if(negated) throw exception('Expected number.');
                return false;
            }
            return true;
        };

        const parsePositiveInteger = function() {
            ignoreWhiteSpaceAndComments();
            if(numeric()) {
                accumulatePreviousChar();
                while(numeric()) accumulatePreviousChar();
                ignoreWhiteSpaceAndComments();
            } else {
                return false;
            }
            return true;
        };

        const accumulatePreviousChar = function() { token += previousChar(); };
        const setRollbackPosition = function() { rollbackPosition = position; };
        const rollback = function() {
            if(rollbackPosition == undefined || rollbackPosition > position) return;
            position -= (position - rollbackPosition);
            token = "";
            rollbackPosition = undefined;
        };

        const validVariableName = function() {
            const fpResult = Trie.isF(_Function.trie, token, 0);
            const afResult = Trie.isF(AggregateFunction.trie, token, 0);
            const kwResult = Trie.isF(KeyWord.trie, token, 0);
            if((fpResult.length > 0 && openingParentheses(true)) ||
                (afResult.length > 0 && openingParentheses(true)) ||
                kwResult.length > 0) {
                position -= token.length;
                return false;
            }
            return true;
        };

        const getAndResetToken = function() { const r = token; token = ""; return r; };
        const more = function() { return position < statementText.length; };

        const check = function(c, dontIgnoreWhiteSpace, dontIncrementPosition) {
            const incrementPosition = !dontIncrementPosition;
            if(!dontIgnoreWhiteSpace) ignoreWhiteSpaceAndComments();
            if(currentChar() == c) { if(incrementPosition) position++; return true; }
            return false;
        };

        const relationshipLeftDirection = function() { return check('<'); };
        const relationshipRightDirection = function() { return check('>'); };
        const relationshipLine = function() { return check('-'); };
        const negation = function() { return check('-'); };
        const isNumeric = function(c) { return !isNaN(parseInt(c)); };
        const numeric = function() { const r = isNumeric(currentChar()); if(r) position++; return r; };
        const star = function() { return check('*'); };
        const dot = function() { return check('.'); };
        const singleQuote = function() {
            if(previousChar() == '\\' && currentChar() == '\'' && inQuotes) return false;
            return check('\'', true);
        };
        const doubleQuote = function() {
            if(previousChar() == '\\' && currentChar() == '\"' && inQuotes) return false;
            return check('"', true);
        };
        const backTickQuote = function() {
            if(previousChar() == '\\' && currentChar() == '`' && inQuotes) return false;
            return check('`', true);
        };
        const colon = function() { return check(':'); };
        const equals = function() { return check('='); };
        const plus_equals = function() { return check('+') && check('='); };
        const comma = function() { return check(','); };
        const escape = function() { return check('\\', true); };
        const openingParentheses = function(dontIncrementPosition, dontIgnoreWhiteSpace) {
            return check('(', dontIgnoreWhiteSpace, dontIncrementPosition);
        };
        const closingParentheses = function() { return check(')'); };
        const openingCurlyBrackets = function(dontIgnoreWhiteSpace, dontIncrementPosition) {
            return check('{', dontIgnoreWhiteSpace, dontIncrementPosition);
        };
        const closingCurlyBrackets = function(dontIgnoreWhiteSpace, dontIncrementPosition) {
            return check('}', dontIgnoreWhiteSpace, dontIncrementPosition);
        };
        const openingDoubleCurlyBrackets = function() {
            const present = currentChar() == '{' && nextChar() == '{';
            if(present) position += 2;
            return present;
        };
        const closingDoubleCurlyBrackets = function() {
            const present = currentChar() == '}' && nextChar() == '}';
            if(present) position += 2;
            return present;
        };
        const openingSquareBracket = function() { return check('['); };
        const closingSquareBracket = function() { return check(']'); };

        const ignoreWhiteSpaceAndComments = function() {
            if(!more()) return;
            while(currentChar() == ' ' || currentChar() == '\n' || currentChar() == '\t' || currentChar() == '\r') {
                position++;
            }
            if(currentChar() == '/' && nextChar() == '/') {
                while(currentChar() != '\n' && more()) position++;
                ignoreWhiteSpaceAndComments();
            }
        };
        const previousChar = function() { return statementText.charAt(position-1); };
        const currentChar = function() { return statementText.charAt(position); };
        const nextChar = function() { return statementText.charAt(position+1); };
        const got = function() {
            return " Parsed \"" + statementText.substring(0,position) + "\". Got \"" + currentChar() + "\"";
        };
        const exception = function(message) { reset(); return message + got(); };
    }

// ── Section 6: Engine ─────────────────────────────────
// CypherNG internal engine — wires all layers together

    // DB is wired with a statsCallback that updates the current statement's counters.
    // This decouples DB from engine; DB simply calls the callback on node/rel add.
    const statement = new Statement(this);
    let db = new DB({
        onNodeAdded: function() { statement.setNodesAdded(statement.getNodesAdded() + 1); },
        onRelationshipAdded: function() { statement.setRelationshipsAdded(statement.getRelationshipsAdded() + 1); }
    });
    const parser = new Parser(this);

    let dataDownloadProxy;

    this.execute = function(statementText, successCallback, errorCallback) {
        statement.clear();
        const callee = arguments.callee;
        try {
            self.onerror = function(message) {
                console.log(message);
                errorCallback(message);
                printStackTrace(callee);
            };
        } catch(e) { ; }

        try {
            parser.parse(statementText);
            statement.setSuccessCallback(successCallback);
            this.run();
        } catch(e) {
            errorCallback(e);
            printStackTrace(callee);
            try { console.log(e); } catch(e) { ; }
        }
    };

    this.addGraph = function(nodes, edges) {
        for(let i=0; i<nodes.length; i++) { db.addNode(nodes[i]); }
        for(let i=0; i<edges.length; i++) { db.addRelationship(edges[i]); }
    };

    this.resetDataBase = function() {
        db = new DB({
            onNodeAdded: function() { statement.setNodesAdded(statement.getNodesAdded() + 1); },
            onRelationshipAdded: function() { statement.setRelationshipsAdded(statement.getRelationshipsAdded() + 1); }
        });
    };

    this.setDataDownloadProxy = function(_dataDownloadProxy) { dataDownloadProxy = _dataDownloadProxy; };
    this.getDataDownloadProxy = function() { return dataDownloadProxy; };
    this.db = function() { return db; };

    this.optional = function() { return this; };
    this.create = function() { statement.addOperation(new Create(statement)); return this; };
    this.match = function() { statement.addOperation(new Match(statement)); return this; };

    this.pattern = function() { statement.context().addPattern(); return this; };
    this.node = function() {
        statement.context().addNode(new PatternNode(db));
        return this;
    };
    this.relationship = function() {
        statement.context().addRelationship(new PatternRelationship(db));
        return this;
    };
    this.expression = function() {
        statement.context().expression(parser.getExpression());
        return this;
    };
    this.variable = function(key) { statement.context().variable(key); return this; };
    this.variableExists = function(key) { return statement.hasVariable(key); };
    this.getVariable = function(key) { return statement.getVariable(key); };
    this.lastObject = function() { return statement.context().getLast(); };
    this.label = function(labelName) {
        statement.context().getLast().setLabel(labelName);
        return this;
    };
    this.type = function(typeName) {
        statement.context().getLast().setType(typeName);
        return this;
    };
    this.readProperty = function(key) { statement.context().getLast().readProperty(key); return this; };
    this.propertyValue = function(expression) {
        statement.context().getLast().setProperty(statement.getPropertyKey(), expression);
        return this;
    };
    this.propertyKey = function(key) { statement.setPropertyKey(key); return this; };
    this.as = function(alias) { statement.context().getLast().setAlias(alias); return this; };
    this.leftDirection = function() {
        statement.context().getLast().setLeftDirection(true);
        return this;
    };
    this.setter = function() { statement.addOperation(new Setter()); return this; };
    this.relStart = function() { return this; };
    this.relMiddle = function() { return this; };
    this.relEnd = function() { return this; };
    this.rightDirection = function() {
        statement.context().getLast().setRightDirection(true);
        return this;
    };
    this.variableProperty = function(key) { return this; };
    this.equals = function() { return this; };
    this.constant = function(value) { statement.context().constant(value); return this; };
    this.load = function() { statement.addOperation(new Load(statement)); return this; };
    this.csv = function() { statement.context().csv(); return this; };
    this.json = function() { statement.context().json(); return this; };
    this.text = function() { statement.context().text(); return this; };
    this.post = function() { statement.context().post(); return this; };
    this._with = function() { statement.addOperation(new With(statement)); return this; };
    this._return = function() { statement.addOperation(new Return(statement)); return this; };
    this.into = function() { return this; };
    this.insertInto = function(tableName) {
        statement.addOperation(new Inserter(statement.engine().db(), tableName));
    };
    this.merge = function() { statement.addOperation(new Merge(statement)); return this; };
    this.unwind = function() { statement.addOperation(new Unwind(statement)); return this; };
    this.limit = function(expression) { statement.context().limit(expression); return this; };
    this.where = function(expression) { statement.context().where(expression); return this; };

    this.statement = function() { return statement; };
    this.operation = function() { return statement.context().type(); };
    this.context = function() { return statement.context().getLast(); };
    this.operationContext = function() { return statement.context(); };

    this.run = function() {
        switch(statement.context().type()) {
            case 'Match':
            case 'With':
                throw "A " + statement.context().type() + "-statement cannot conclude the query.";
        }
        statement.operations()[0].run();
    };

} // end CypherNG

// ── Section 7: Public Facade ──────────────────────────
// Environment detection, Web Worker bridging

const Cypher_context_is_worker = (this.document == undefined);
let isStandaloneJSEngine = false;
const Cypher_script_path = (function() {
    if(Cypher_context_is_worker) return "";
    const scripts = this.document.getElementsByTagName('script');
    return scripts[scripts.length-1].src;
})();

try {
    if(module) isStandaloneJSEngine = true;
} catch(e) {
    isStandaloneJSEngine = false;
}

/*
 * Create new Cypher instance
 *   options: {
 *     runInWebWorker: true/false,
 *     dataDownloadProxy: "http://proxy_url?u="
 *   }
 */
function Cypher(options) {
    const singleThreaded = !options || !options.runInWebWorker;

    if(Cypher_context_is_worker && !isStandaloneJSEngine) {
        // Running inside a Web Worker — set up the worker-side message handler
        try {
            const db = new CypherNG();
            if(options && options.dataDownloadProxy) {
                db.setDataDownloadProxy(options.dataDownloadProxy);
            }
            self.onmessage = function(e) {
                const request = e.data;
                const action = request.action;
                switch(action) {
                    case "query":
                        db.execute(
                            request.statementText,
                            function(results) {
                                self.postMessage({ action: action, success: true, results: results });
                            },
                            function(error) {
                                self.postMessage({ action: action, error: true, message: error });
                            }
                        );
                        return;
                    case "addGraph":
                        try { db.addGraph(request.nodes, request.edges); }
                        catch(e) {
                            self.postMessage({ action: action, error: true, message: e });
                            return;
                        }
                        self.postMessage({ action: action, success: true });
                        return;
                    case "resetDataBase":
                        db.resetDataBase();
                        self.postMessage({ action: action });
                        return;
                }
            };
        } catch(e) { ; }

    } else if(!Cypher_context_is_worker && !singleThreaded && !isStandaloneJSEngine) {
        // Running in browser main thread with Web Worker mode
        let successCallback, errorCallback;
        const worker = new Worker(Cypher_script_path);

        worker.onmessage = function(e) {
            const response = e.data;
            const action = response.action;
            switch(action) {
                case "query":
                    if(response.success) successCallback(response.results);
                    else if(response.error) errorCallback(response.message);
                    return;
                case "addGraph":
                    if(response.success) successCallback(response.results);
                    else if(response.error) errorCallback(response.message);
                    return;
                case "resetDataBase":
                    if(successCallback) successCallback();
                    return;
            }
        };

        this.execute = function(statementText, _successCallback, _errorCallback) {
            successCallback = _successCallback;
            errorCallback = _errorCallback;
            worker.postMessage({ action: "query", statementText: statementText });
        };
        this.addGraph = function(nodes, edges, _successCallback, _errorCallback) {
            successCallback = _successCallback;
            errorCallback = _errorCallback;
            worker.postMessage({ action: "addGraph", nodes: nodes, edges: edges });
        };
        this.resetDataBase = function(_successCallBack) {
            if(_successCallBack) successCallback = _successCallBack;
            else successCallback = (function() { ; });
            worker.postMessage({ action: "resetDataBase" });
        };

    } else if(isStandaloneJSEngine || (!isStandaloneJSEngine && !Cypher_context_is_worker && singleThreaded)) {
        // Single-threaded mode (Node.js or browser without Web Worker)
        const db = new CypherNG();
        if(options && options.dataDownloadProxy) {
            db.setDataDownloadProxy(options.dataDownloadProxy);
        }
        this.execute = function(statementText, _successCallback, _errorCallback) {
            db.execute(statementText, _successCallback, _errorCallback);
        };
        this.addGraph = function(nodes, edges, _successCallback, _errorCallback) {
            db.addGraph(nodes, edges);
            if(_successCallback) _successCallback();
        };
        this.resetDataBase = function(_successCallback) {
            db.resetDataBase();
            if(_successCallback) _successCallback();
        };
    }
}

// Auto-launch worker if this script is loaded as a Web Worker
if(Cypher_context_is_worker) {
    (new Cypher());
}

// ── Section 8: Export ─────────────────────────────────
// CommonJS export with browser fallback

try {
    module.exports = Cypher;
} catch(e) {
    ;
}
