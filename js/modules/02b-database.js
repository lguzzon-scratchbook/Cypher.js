/**
 * @fileoverview Section 2b: Database Module for CypherNG
 * @description Contains the DB class for in-memory graph storage with indexes.
 * @module cypher-ng/database
 * @version 1.0.0
 * @license GPL-3.0-or-later
 */

import { StringRecoder, StoredNode, StoredRelationship, Matcher } from './02-data.js';

/**
 * DB: in-memory graph store.
 * Uses statsCallback pattern to decouple from engine.
 * Provides exportData()/importData() for persistence readiness.
 * @class DB
 * @param {Object} statsCallback - Callbacks for stats tracking {onNodeAdded, onRelationshipAdded}
 */
export class DB {
    constructor(statsCallback) {
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

        const recode = function (val) { return stringRecoder.recode(val); };

        // ── Index management ──────────────────────────────
        const initializeRelationshipLookup = function (fromNodeId, toNodeId) {
            if (fromNodeId != undefined) {
                if (!relationshipLookup[fromNodeId]) relationshipLookup[fromNodeId] = {};
                if (toNodeId != undefined && !relationshipLookup[fromNodeId][toNodeId]) {
                    relationshipLookup[fromNodeId][toNodeId] = [];
                }
            }
        };
        const lookupRelationships = function (fromNodeId, toNodeId) {
            initializeRelationshipLookup(fromNodeId, toNodeId);
            if (fromNodeId != undefined) {
                if (toNodeId != undefined) return relationshipLookup[fromNodeId][toNodeId];
                else {
                    let ids = [];
                    for (const nodeId in relationshipLookup[fromNodeId]) {
                        ids = ids.concat(relationshipLookup[fromNodeId][nodeId]);
                    }
                    return ids;
                }
            }
            return [];
        };
        const addLookupRelationship = function (fromNodeId, toNodeId, relationshipId) {
            initializeRelationshipLookup(fromNodeId, toNodeId);
            relationshipLookup[fromNodeId][toNodeId].push(relationshipId);
            addLookupRelationshipIdsByNodeId(fromNodeId, relationshipId);
            addLookupRelationshipIdsByNodeIdIncoming(toNodeId, relationshipId);
        };
        const initializeRelationshipIdsByNodeIdLookup = function (nodeId) {
            if (!relationshipIdsByNodeIdLookup[nodeId]) relationshipIdsByNodeIdLookup[nodeId] = [];
        };
        const lookupRelationshipIdsByNodeId = function (nodeId) {
            initializeRelationshipIdsByNodeIdLookup(nodeId);
            return relationshipIdsByNodeIdLookup[nodeId];
        };
        const addLookupRelationshipIdsByNodeId = function (nodeId, relationshipId) {
            initializeRelationshipIdsByNodeIdLookup(nodeId);
            relationshipIdsByNodeIdLookup[nodeId].push(relationshipId);
        };
        const initializeRelationshipIdsByNodeIdLookupIncoming = function (nodeId) {
            if (!relationshipIdsByNodeIdLookupIncoming[nodeId]) relationshipIdsByNodeIdLookupIncoming[nodeId] = [];
        };
        const lookupRelationshipIdsByNodeIdIncoming = function (nodeId) {
            initializeRelationshipIdsByNodeIdLookupIncoming(nodeId);
            return relationshipIdsByNodeIdLookupIncoming[nodeId];
        };
        const addLookupRelationshipIdsByNodeIdIncoming = function (nodeId, relationshipId) {
            initializeRelationshipIdsByNodeIdLookupIncoming(nodeId);
            relationshipIdsByNodeIdLookupIncoming[nodeId].push(relationshipId);
        };
        const initializeNodeIdLookup = function (key, value) {
            if (!nodeIdLookup[key]) nodeIdLookup[key] = {};
            if (!nodeIdLookup[key][value]) nodeIdLookup[key][value] = [];
        };
        const lookupNodeIds = function (_key, _value) {
            const key = recode(_key), value = recode(_value);
            initializeNodeIdLookup(key, value);
            return nodeIdLookup[key][value];
        };
        const initializeRelationshipIdLookup = function (key, value) {
            if (!relationshipIdLookup[key]) relationshipIdLookup[key] = {};
            if (!relationshipIdLookup[key][value]) relationshipIdLookup[key][value] = [];
        };
        const addLookupNodeId = function (_key, _value, nodeId) {
            const key = recode(_key), value = recode(_value);
            initializeNodeIdLookup(key, value);
            nodeIdLookup[key][value].push(nodeId);
        };
        const addLookupRelationshipId = function (_key, _value, relationshipId) {
            const key = recode(_key), value = recode(_value);
            initializeRelationshipIdLookup(key, value);
            relationshipIdLookup[key][value].push(relationshipId);
        };
        const initializeLabelNodeIdLookup = function (label) {
            if (!labelNodeIdLookup[label]) labelNodeIdLookup[label] = [];
        };
        const lookupLabelNodeIds = function (_label) {
            const label = recode(_label);
            initializeLabelNodeIdLookup(label);
            return labelNodeIdLookup[label];
        };
        const initializeTypeRelationshipIdLookup = function (type) {
            if (!typeRelationshipIdLookup[type]) {
                typeRelationshipIdLookup[type] = [];
                return false;
            }
        };
        const addLabelNodeIdLookup = function (_label, nodeId) {
            const label = recode(_label);
            initializeLabelNodeIdLookup(label);
            const equalsCheck = function (el) { return el == nodeId; };
            if (nodeId != undefined && !labelNodeIdLookup[label].find(equalsCheck)) {
                labelNodeIdLookup[label].push(nodeId);
            }
        };
        this._addLabelNodeIdLookup = function (_label, nodeId) { addLabelNodeIdLookup(_label, nodeId); };

        const addTypeRelationshipIdLookup = function (_type, relationshipId) {
            if (relationshipId == undefined) return;
            const type = recode(_type);
            initializeTypeRelationshipIdLookup(type);
            const equalsCheck = function (el) { return el == relationshipId; };
            if (!typeRelationshipIdLookup[type].find(equalsCheck)) {
                typeRelationshipIdLookup[type].push(relationshipId);
                relationships[relationshipId].setStoredType(_type);
            }
        };
        this._addTypeRelationshipIdLookup = function (_type, relationshipId) {
            addTypeRelationshipIdLookup(_type, relationshipId);
        };

        // ── Internal add operations ───────────────────────
        const getFreeNodeId = function () {
            while (nodes[NODE_ID_FACTORY]) NODE_ID_FACTORY++;
            return NODE_ID_FACTORY;
        };
        const addNode = function (node, givenId) {
            if (!givenId) {
                node.setId(getFreeNodeId());
                nodes[node.id()] = node;
            } else {
                if (nodes[givenId]) throw 'Node with ID ' + givenId + ' already exists in the database.';
                node.setId(givenId);
                nodes[givenId] = node;
            }
            for (const key in node.getRawProperties()) {
                addLookupNodeId(key, node.getLocalProperty(key), node.id());
            }
            for (const label in node.labels()) {
                addLabelNodeIdLookup(label, node.id());
            }
            if (statsCallback && statsCallback.onNodeAdded) statsCallback.onNodeAdded();
        };
        const getFreeRelationshipId = function () {
            while (relationships[RELATIONSHIP_ID_FACTORY]) RELATIONSHIP_ID_FACTORY++;
            return RELATIONSHIP_ID_FACTORY;
        };
        const addRelationship = function (relationship, givenId) {
            let relationshipId = null;
            if (!givenId) {
                relationshipId = getFreeRelationshipId();
            } else {
                if (nodes[givenId]) throw 'Relationship with ID ' + givenId + ' already exists in the database.';
                relationshipId = givenId;
            }
            relationship.setId(relationshipId);
            relationships[relationshipId] = relationship;
            addLookupRelationship(
                relationship.getFromNode().id(),
                relationship.getToNode().id(),
                relationship.id()
            );
            if (relationship.getToNode().id() != relationship.getFromNode().id()) {
                addLookupRelationship(
                    relationship.getToNode().id(),
                    relationship.getFromNode().id(),
                    relationship.id()
                );
            }
            for (const key in relationship.getProperties()) {
                addLookupRelationshipId(key, relationship.getProperty(key), relationship.id());
            }
            addTypeRelationshipIdLookup(relationship.getType(), relationship.id());
            relationship.setIsAdded();
            if (statsCallback && statsCallback.onRelationshipAdded) statsCallback.onRelationshipAdded();
        };

        // ── Relationship matching ─────────────────────────
        const relationshipMatch = function (relationship, fromNode, toNode) {
            let relationshipIds = [];
            let relationshipIdsFromLookup;

            if (!relationship.isReferred()) {
                if (fromNode && toNode) {
                    relationshipIdsFromLookup = lookupRelationships(fromNode.id(), toNode.id());
                    relationshipIds = relationshipIds.concat(relationshipIdsFromLookup);
                } else if (fromNode && !toNode) {
                    relationshipIdsFromLookup = lookupRelationshipIdsByNodeId(fromNode.id());
                    if (relationship.uniDirectional()) {
                        relationshipIdsFromLookup.concat(lookupRelationshipIdsByNodeIdIncoming(fromNode.id()));
                    }
                    relationshipIds = relationshipIds.concat(relationshipIdsFromLookup);
                }
            } else {
                const referredRelationship = relationship.getReferredRelationship().getData();
                if (referredRelationship) {
                    if (!(referredRelationship.constructor == StoredRelationship ||
                        referredRelationship.constructor == RelationshipReference)) {
                        throw 'Expected relationship.';
                    }
                } else {
                    throw 'Expected relationship.';
                }
                relationshipIds.push(referredRelationship.id());
            }

            if (relationshipIds.length == 0) return false;

            const matcher = new Matcher();
            matcher.setMatchingSet(relationshipIds, 0);

            if (relationship.leftDirection() || relationship.rightDirection()) matcher.incrementToMatchCount();
            if (relationship.getType()) matcher.incrementToMatchCount();
            for (const key in relationship.getProperties()) matcher.incrementToMatchCount();

            if (matcher.toMatchCount() > 0) {
                let dbRelationship;
                for (let i = 0; i < relationshipIds.length; i++) {
                    dbRelationship = relationships[relationshipIds[i]];
                    if (relationship.leftDirection() || relationship.rightDirection()) {
                        if (relationship.leftDirection() == dbRelationship.leftDirection(fromNode.id()) ||
                            relationship.rightDirection() == dbRelationship.rightDirection(fromNode.id())) {
                            matcher.keepMatchTally(relationshipIds[i]);
                        }
                    }
                    if (relationship.getType()) {
                        if (dbRelationship.getType() && dbRelationship.getType() == relationship.getType()) {
                            matcher.keepMatchTally(relationshipIds[i]);
                        }
                    }
                    for (const key in relationship.getProperties()) {
                        if (relationship.getLocalProperty(key) == dbRelationship.getLocalProperty(key)) {
                            matcher.keepMatchTally(relationshipIds[i]);
                        }
                    }
                }
                matcher.updateMatchingSet();
            }

            if (matcher.matchingSetSize() == 0) return false;
            return matcher.matchingSet();
        };

        // ── Node creation ─────────────────────────────────
        // Import RelationshipReference for the createNode method
        let RelationshipReference;
        const getRelationshipReference = function() {
            if (!RelationshipReference) RelationshipReference = require('./01-utilities.js').RelationshipReference;
            return RelationshipReference;
        };

        this.createNode = function (node) {
            let nodeInstance;
            if (node.isReferred()) {
                nodeInstance = node.getReferredNode().getData();
                const Unwind = require('./03-query.js').Unwind;
                if (nodeInstance.constructor == Unwind) nodeInstance = nodeInstance.value();
                if (nodeInstance.constructor == getRelationshipReference()) nodeInstance = self.getNodeById(nodeInstance.nodeId());
            } else {
                node.bindProperties();
                nodeInstance = node.copy(); // Returns StoredNode
                addNode(nodeInstance);
                node.addMatchedNode(nodeInstance);
            }
            if (node.outgoingRelationship()) node.outgoingRelationship().setFromNode(nodeInstance);
            if (node.incomingRelationship()) {
                node.incomingRelationship().bindProperties();
                node.incomingRelationship().setToNode(nodeInstance);
                const relationshipToAdd = node.incomingRelationship().copy(); // Returns StoredRelationship
                addRelationship(relationshipToAdd);
                node.incomingRelationship().addMatchedRelationship(relationshipToAdd);
            }
            if (node.nextNode()) { node.nextNode().create(); }
            else { node.nextAction(); }
        };

        // ── Node matching ─────────────────────────────────
        const matchNodeProperties = function (node, matcher) {
            for (const key in node.getProperties()) {
                node.bindProperty(key);
                if (matcher.toMatchCount() == 0 && matcher.matchingSetSize() == 0) {
                    const nodeIds = lookupNodeIds(key, node.getLocalProperty(key));
                    if (nodeIds) matcher.setMatchingSet(nodeIds);
                } else if (matcher.matchingSetSize() > 0) {
                    for (let i = 0; i < matcher.matchingSetSize(); i++) {
                        if (node.getLocalProperty(key) == nodes[matcher.matchingSet()[i]].getLocalProperty(key)) {
                            matcher.keepMatchTally(matcher.matchingSet()[i]);
                        }
                    }
                }
                matcher.incrementToMatchCount();
                matcher.updateMatchingSet();
            }
        };

        const matchNodeLabels = function (node, matcher) {
            for (const label in node.labels()) {
                if (matcher.toMatchCount() == 0 && matcher.matchingSetSize() == 0) {
                    const nodeIds = lookupLabelNodeIds(label);
                    if (nodeIds) matcher.setMatchingSet(nodeIds);
                } else if (matcher.matchingSetSize() > 0) {
                    for (let i = 0; i < matcher.matchingSetSize(); i++) {
                        if (nodes[matcher.matchingSet()[i]].hasLabel(label)) {
                            matcher.keepMatchTally(matcher.matchingSet()[i]);
                        }
                    }
                }
                matcher.incrementToMatchCount();
                matcher.updateMatchingSet();
            }
        };

        const conveyorBelt = function (node, merge, _pathExpansionDepth) {
            if (node.nextNode()) {
                if (node.getPattern().usedAsCondition()) return node.nextNode().convey(merge, _pathExpansionDepth);
                else node.nextNode().convey(merge, _pathExpansionDepth);
            } else {
                if (node.getPattern().usedAsCondition()) return node.nextAction();
                else node.nextAction();
            }
        };

        const processNodeMatcher = function (matcher) {
            let nodeIdsForConveyorBelt = [];
            if (matcher.matchingSetSize() > 0) {
                nodeIdsForConveyorBelt = matcher.matchingSet();
            } else if (matcher.toMatchCount() == 0) {
                nodeIdsForConveyorBelt = new Array(nodes.length);
                for (let i = 0; i < nodes.length; i++) {
                    nodeIdsForConveyorBelt[i] = nodes[i].id();
                }
            }
            return nodeIdsForConveyorBelt;
        };

        const getMatchingNodeIds = function (node, merge) {
            let nodeIdsForConveyorBelt = [];
            if (!node.isExpanded()) {
                const matcher = new Matcher();
                if (node.isReferred()) {
                    let referredNode = node.getReferredNode().getData();
                    const Unwind = require('./03-query.js').Unwind;
                    if (referredNode.constructor == Unwind) referredNode = referredNode.value();
                    if (referredNode) {
                        if (!(referredNode.constructor == StoredNode ||
                            referredNode.constructor == getRelationshipReference())) {
                            throw 'Expected node.';
                        }
                    } else {
                        throw 'Expected node.';
                    }
                    matcher.addToMatchingSet(referredNode.id());
                }
                if (node.incomingRelationship()) {
                    if (node.incomingRelationship().hasExpandedEndNode() && !node.isReferred()) {
                        matcher.addToMatchingSet(node.incomingRelationship().getExpandedEndNode().id());
                    }
                }
                matchNodeProperties(node, matcher);
                matchNodeLabels(node, matcher);
                nodeIdsForConveyorBelt = processNodeMatcher(matcher);

                if (nodeIdsForConveyorBelt.length == 0 && merge) {
                    if (node.getPattern().usedAsCondition()) return false;
                    else { node.getPattern().create(); return; }
                }
            } else {
                nodeIdsForConveyorBelt = [node.getExpandedNode().id()];
            }
            return nodeIdsForConveyorBelt;
        };

        const processNodeWithoutRelationships = function (node, nodeId, merge, pathExpansionDepth) {
            if (!node.incomingRelationship() && !node.outgoingRelationship()) {
                node.addMatchedNode(nodes[nodeId]);
                if (node.getPattern().usedAsCondition()) return conveyorBelt(node, merge, pathExpansionDepth);
                else conveyorBelt(node, merge, pathExpansionDepth);
            }
        };

        const processNodeWithOutgoingRelationship = function (node, nodeIdIndex, nodeId, merge, pathExpansionDepth) {
            let returnValue;
            if (node.outgoingRelationship()) {
                const matchingRelationshipIds = getMatchingRelationshipIds(node, nodeIdIndex, nodeId, pathExpansionDepth);
                if (!matchingRelationshipIds && merge) {
                    node.getPattern().create();
                    returnValue = -1;
                } else if (matchingRelationshipIds.length > 0) {
                    returnValue = processMatchingRelationships(node, nodeId, merge, pathExpansionDepth, matchingRelationshipIds);
                    if (returnValue != undefined) return returnValue;
                    returnValue = pathExpansion(node, nodeId, pathExpansionDepth, matchingRelationshipIds);
                    if (returnValue != undefined) return returnValue;
                }
            }
            return returnValue;
        };

        const processNodeWithIncomingRelationship = function (node, nodeId, merge, pathExpansionDepth) {
            let returnValue;
            if (node.incomingRelationship()) {
                node.addMatchedNode(nodes[nodeId]);
                if (node.incomingRelationship().hasExpandedEndNode()) {
                    let convey = true;
                    if (node.isReferred()) {
                        if (node.getReferredNode().getData().id() != node.incomingRelationship().getExpandedEndNode().id()) {
                            convey = false;
                        }
                    }
                    if (convey) {
                        if (node.getPattern().usedAsCondition()) {
                            returnValue = conveyorBelt(node, merge, pathExpansionDepth);
                            if (returnValue != undefined) return returnValue;
                        } else {
                            conveyorBelt(node, merge, pathExpansionDepth);
                        }
                    }
                }
            }
        };

        const getMatchingRelationshipIds = function (node, nodeIdIndex, nodeId, pathExpansionDepth) {
            if (!pathExpansionDepth && node.outgoingRelationship().expandPath() && nodeIdIndex > 0) {
                node.outgoingRelationship().resetExpandedPath();
            }
            if (!node.isExpanded()) {
                node.addMatchedNode(nodes[nodeId]);
                node.outgoingRelationship().setFromNode(nodes[nodeId]);
            }
            let toNode = null;
            if (node.outgoingRelationship().getNextObject().isReferred() &&
                !node.outgoingRelationship().hasVariablePathLength()) {
                toNode = node.outgoingRelationship().getNextObject().getReferredNode().getData();
            }
            node.outgoingRelationship().bindProperties();
            return relationshipMatch(node.outgoingRelationship(), nodes[nodeId], toNode);
        };

        const processMatchingRelationships = function (node, nodeId, merge, pathExpansionDepth, matchingRelationshipIds) {
            let returnValue;
            for (let relationshipIdIdx = 0; relationshipIdIdx < matchingRelationshipIds.length; relationshipIdIdx++) {
                const relationship = relationships[matchingRelationshipIds[relationshipIdIdx]];
                if (node.outgoingRelationship().pathLengthSatisfied()) {
                    node.outgoingRelationship().setExpandedEndNode(relationship.getToNode(nodeId));
                    node.outgoingRelationship().setMatchedRelationship(relationship);
                    node.outgoingRelationship().addMatchedRelationship(relationship,
                        { fromNodeId: nodeId, toNodeId: relationship.getToNode(nodeId).id() });
                    if (node.getPattern().usedAsCondition()) {
                        returnValue = conveyorBelt(node, merge, pathExpansionDepth);
                        if (returnValue != undefined) return returnValue;
                    } else {
                        conveyorBelt(node, merge, pathExpansionDepth);
                    }
                    node.outgoingRelationship().setExpandedEndNode(null);
                }
            }
        };

        const pathExpansion = function (node, nodeId, pathExpansionDepth, matchingRelationshipIds) {
            if (node.outgoingRelationship().expandPath()) {
                for (let relationshipIdIdx = 0; relationshipIdIdx < matchingRelationshipIds.length; relationshipIdIdx++) {
                    const relationship = relationships[matchingRelationshipIds[relationshipIdIdx]];
                    if (node.outgoingRelationship().visitedBefore(relationship.getToNode(nodeId).id())) {
                        node.outgoingRelationship().backTrackExpandedPath();
                        continue;
                    }
                    if (node.outgoingRelationship().pathLengthSatisfied()) {
                        node.setExpandedNode(relationship.getToNode(nodeId));
                        self.matchNode(node, false, (pathExpansionDepth || 0) + 1);
                        node.setExpandedNode(null);
                    }
                    if (node.outgoingRelationship().expandPath() && !pathExpansionDepth) {
                        node.outgoingRelationship().backTrackExpandedPath();
                    }
                }
            }
        };

        this.matchNode = function (node, merge, pathExpansionDepth) {
            let returnValue;
            const nodeIdsForConveyorBelt = getMatchingNodeIds(node, merge);
            if (nodeIdsForConveyorBelt && nodeIdsForConveyorBelt.length) {
                for (let nodeIdIndex = 0; nodeIdIndex < nodeIdsForConveyorBelt.length; nodeIdIndex++) {
                    const nodeId = nodeIdsForConveyorBelt[nodeIdIndex];
                    returnValue = processNodeWithoutRelationships(node, nodeId, merge, pathExpansionDepth);
                    if (returnValue != undefined) return returnValue;
                    returnValue = processNodeWithOutgoingRelationship(node, nodeIdIndex, nodeId, merge, pathExpansionDepth);
                    if (returnValue != undefined) return returnValue;
                    returnValue = processNodeWithIncomingRelationship(node, nodeId, merge, pathExpansionDepth);
                    if (returnValue != undefined) return returnValue;
                }
            }
            if (node.getPattern().usedAsCondition()) return false;
        };

        this.getNodeById = function (id) { return nodes[id]; };
        this.getRelationshipById = function (id) { return relationships[id]; };

        // Public addNode/addRelationship (used by addGraph)
        this.addNode = function (node) {
            const n = new StoredNode(this);
            n.setProperties(node.properties);
            n.setLabels(node.labels);
            addNode(n, node.id);
        };
        this.addRelationship = function (relationship) {
            const r = new StoredRelationship(this);
            r.setFromNode(this.getNodeById(relationship.from));
            r.setToNode(this.getNodeById(relationship.to));
            r.setProperties(relationship.properties);
            r.setStoredType(relationship.type);
            addRelationship(r, relationship.id);
        };

        this.addTable = function (table) { tables[table.name()] = table; };
        this.getTable = function (tableName) {
            if (!(tableName in tables)) throw 'Table "' + tableName + '" does not exist.';
            return tables[tableName];
        };

        // ── Index rebuild (for importData) ────────────────
        const rebuildIndexes = function () {
            nodeIdLookup = {};
            labelNodeIdLookup = {};
            relationshipLookup = {};
            relationshipIdsByNodeIdLookup = {};
            relationshipIdsByNodeIdLookupIncoming = {};
            relationshipIdLookup = {};
            typeRelationshipIdLookup = {};
            stringRecoder = new StringRecoder();

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (!node) continue;
                for (const key in node.getRawProperties()) {
                    addLookupNodeId(key, node.getLocalProperty(key), node.id());
                }
                for (const label in node.labels()) {
                    addLabelNodeIdLookup(label, node.id());
                }
            }
            for (let i = 0; i < relationships.length; i++) {
                const rel = relationships[i];
                if (!rel) continue;
                addLookupRelationship(rel.fromNodeId, rel.toNodeId, rel.id());
                if (rel.toNodeId != rel.fromNodeId) {
                    addLookupRelationship(rel.toNodeId, rel.fromNodeId, rel.id());
                }
                for (const key in rel.getProperties()) {
                    addLookupRelationshipId(key, rel.getProperty(key), rel.id());
                }
                const type = recode(rel.getType());
                initializeTypeRelationshipIdLookup(type);
                const equalsCheck = function (rel_id) { return rel_id == rel.id(); };
                if (!typeRelationshipIdLookup[type].find(equalsCheck)) {
                    typeRelationshipIdLookup[type].push(rel.id());
                }
            }
        };

        // ── Persistence interface ─────────────────────────

        // exportData(): serialize current DB state to plain JSON-safe object
        this.exportData = function () {
            return {
                nodes: nodes
                    .filter(function (n) { return n != null && n != undefined; })
                    .map(function (n) { return n.toSerializable(); }),
                relationships: relationships
                    .filter(function (r) { return r != null && r != undefined; })
                    .map(function (r) { return r.toSerializable(); }),
                meta: {
                    nodeIdFactory: NODE_ID_FACTORY,
                    relationshipIdFactory: RELATIONSHIP_ID_FACTORY
                }
            };
        };

        // importData(): restore DB from a previously exported snapshot
        this.importData = function (snapshot) {
            nodes = [];
            relationships = [];
            NODE_ID_FACTORY = snapshot.meta.nodeIdFactory;
            RELATIONSHIP_ID_FACTORY = snapshot.meta.relationshipIdFactory;

            for (let i = 0; i < snapshot.nodes.length; i++) {
                const nd = snapshot.nodes[i];
                const n = new StoredNode(self);
                n.setId(nd.id);
                n.setProperties(nd.properties);
                n.setLabelsFromObject(nd.labels);
                nodes[nd.id] = n;
            }
            for (let i = 0; i < snapshot.relationships.length; i++) {
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
}