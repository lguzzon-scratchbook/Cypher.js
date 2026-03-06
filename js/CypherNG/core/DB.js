/**
 * @fileoverview DB class for CypherNG.
 * Main database class managing nodes, relationships, and indexes.
 */

/**
 * DB - Database class managing graph storage and pattern matching.
 *
 * @class
 * @memberof CypherNG.core
 * @param {CypherNG} engine - The CypherNG engine instance
 */
function DB(engine) {
    var self = this;
    var nodes = [];
    var NODE_ID_FACTORY = 0;
    var nodeIdLookup = {};
    var labelNodeIdLookup = {};

    var relationships = [];
    var RELATIONSHIP_ID_FACTORY = 0;
    var relationshipLookup = {};
    var relationshipIdsByNodeIdLookup = {};
    var relationshipIdsByNodeIdLookupIncoming = {};
    var relationshipIdLookup = {};
    var typeRelationshipIdLookup = {};

    var tables = {};

    var stringRecoder = new (typeof module !== 'undefined' && module.exports ?
        require('../structures/utils.js').StringRecoder :
        CypherNG.structures.StringRecoder)();

    // Persistence Design Note: All storage is isolated in this class.
    // For persistence, implement serialization of:
    // - nodes array (with id, labels, properties)
    // - relationships array (with id, type, fromNode, toNode, properties)
    // - indexes (nodeIdLookup, labelNodeIdLookup, relationshipIdLookup, typeRelationshipIdLookup)

    /**
     * Recode a string value using the string recoder.
     * @param {*} val - The value to recode
     * @returns {*} The recoded value (number for strings, original otherwise)
     */
    var recode = function(val) {
        return stringRecoder.recode(val);
    };

    /**
     * Initialize relationship lookup structures.
     * @param {number} fromNodeId - The from node ID
     * @param {number} [toNodeId] - The to node ID (optional)
     */
    var initializeRelationshipLookup = function(fromNodeId, toNodeId) {
        if (fromNodeId != undefined) {
            if (!relationshipLookup[fromNodeId]) {
                relationshipLookup[fromNodeId] = {};
            }
            if (toNodeId != undefined) {
                if (!relationshipLookup[fromNodeId][toNodeId]) {
                    relationshipLookup[fromNodeId][toNodeId] = [];
                }
            }
        }
    };

    /**
     * Look up relationships between nodes.
     * @param {number} fromNodeId - The from node ID
     * @param {number} [toNodeId] - The to node ID (optional)
     * @returns {number[]} Array of relationship IDs
     */
    var lookupRelationships = function(fromNodeId, toNodeId) {
        initializeRelationshipLookup(fromNodeId, toNodeId);
        if (fromNodeId != undefined) {
            if (toNodeId != undefined) {
                return relationshipLookup[fromNodeId][toNodeId];
            } else if (toNodeId == undefined) {
                var relationshipIds = [];
                for (var nodeId in relationshipLookup[fromNodeId]) {
                    relationshipIds = relationshipIds.concat(
                        relationshipLookup[fromNodeId][nodeId]
                    );
                }
                return relationshipIds;
            }
        }
        return [];
    };

    /**
     * Add a relationship to the lookup structures.
     * @param {number} fromNodeId - The from node ID
     * @param {number} toNodeId - The to node ID
     * @param {number} relationshipId - The relationship ID
     */
    var addLookupRelationship = function(fromNodeId, toNodeId, relationshipId) {
        initializeRelationshipLookup(fromNodeId, toNodeId);
        relationshipLookup[fromNodeId][toNodeId].push(relationshipId);
        addLookupRelationshipIdsByNodeId(fromNodeId, relationshipId);
        addLookupRelationshipIdsByNodeIdIncoming(toNodeId, relationshipId);
    };

    /**
     * Initialize relationship IDs by node ID lookup.
     * @param {number} nodeId - The node ID
     */
    var initializeRelationshipIdsByNodeIdLookup = function(nodeId) {
        if (!relationshipIdsByNodeIdLookup[nodeId]) {
            relationshipIdsByNodeIdLookup[nodeId] = [];
        }
    };

    /**
     * Look up relationship IDs by node ID.
     * @param {number} nodeId - The node ID
     * @returns {number[]} Array of relationship IDs
     */
    var lookupRelationshipIdsByNodeId = function(nodeId) {
        initializeRelationshipIdsByNodeIdLookup(nodeId);
        return relationshipIdsByNodeIdLookup[nodeId];
    };

    /**
     * Add a relationship ID to the node's outgoing lookup.
     * @param {number} nodeId - The node ID
     * @param {number} relationshipId - The relationship ID
     */
    var addLookupRelationshipIdsByNodeId = function(nodeId, relationshipId) {
        initializeRelationshipIdsByNodeIdLookup(nodeId);
        relationshipIdsByNodeIdLookup[nodeId].push(relationshipId);
    };

    /**
     * Initialize incoming relationship IDs by node ID lookup.
     * @param {number} nodeId - The node ID
     */
    var initializeRelationshipIdsByNodeIdLookupIncoming = function(nodeId) {
        if (!relationshipIdsByNodeIdLookupIncoming[nodeId]) {
            relationshipIdsByNodeIdLookupIncoming[nodeId] = [];
        }
    };

    /**
     * Look up incoming relationship IDs by node ID.
     * @param {number} nodeId - The node ID
     * @returns {number[]} Array of relationship IDs
     */
    var lookupRelationshipIdsByNodeIdIncoming = function(nodeId) {
        initializeRelationshipIdsByNodeIdLookupIncoming(nodeId);
        return relationshipIdsByNodeIdLookupIncoming[nodeId];
    };

    /**
     * Add a relationship ID to the node's incoming lookup.
     * @param {number} nodeId - The node ID
     * @param {number} relationshipId - The relationship ID
     */
    var addLookupRelationshipIdsByNodeIdIncoming = function(nodeId, relationshipId) {
        initializeRelationshipIdsByNodeIdLookupIncoming(nodeId);
        relationshipIdsByNodeIdLookupIncoming[nodeId].push(relationshipId);
    };

    /**
     * Initialize node ID lookup structures.
     * @param {*} key - The property key
     * @param {*} value - The property value
     */
    var initializeNodeIdLookup = function(key, value) {
        if (!nodeIdLookup[key]) {
            nodeIdLookup[key] = {};
        }
        if (!nodeIdLookup[key][value]) {
            nodeIdLookup[key][value] = [];
        }
    };

    /**
     * Look up node IDs by property key and value.
     * @param {*} _key - The property key
     * @param {*} _value - The property value
     * @returns {number[]} Array of node IDs
     */
    var lookupNodeIds = function(_key, _value) {
        var key = recode(_key),
            value = recode(_value);
        initializeNodeIdLookup(key, value);
        return nodeIdLookup[key][value];
    };

    /**
     * Initialize relationship ID lookup structures.
     * @param {*} key - The property key
     * @param {*} value - The property value
     */
    var initializeRelationshipIdLookup = function(key, value) {
        if (!relationshipIdLookup[key]) {
            relationshipIdLookup[key] = {};
        }
        if (!relationshipIdLookup[key][value]) {
            relationshipIdLookup[key][value] = [];
        }
    };

    /**
     * Add a node ID to the lookup structures.
     * @param {*} _key - The property key
     * @param {*} _value - The property value
     * @param {number} nodeId - The node ID
     */
    var addLookupNodeId = function(_key, _value, nodeId) {
        var key = recode(_key),
            value = recode(_value);
        initializeNodeIdLookup(key, value);
        nodeIdLookup[key][value].push(nodeId);
    };

    /**
     * Add a relationship ID to the lookup structures.
     * @param {*} _key - The property key
     * @param {*} _value - The property value
     * @param {number} relationshipId - The relationship ID
     */
    var addLookupRelationshipId = function(_key, _value, relationshipId) {
        var key = recode(_key),
            value = recode(_value);
        initializeRelationshipIdLookup(key, value);
        relationshipIdLookup[key][value].push(relationshipId);
    };

    /**
     * Initialize label to node ID lookup.
     * @param {string} label - The label name
     */
    var initializeLabelNodeIdLookup = function(label) {
        if (!labelNodeIdLookup[label]) {
            labelNodeIdLookup[label] = [];
        }
    };

    /**
     * Look up node IDs by label.
     * @param {string} _label - The label name
     * @returns {number[]} Array of node IDs
     */
    var lookupLabelNodeIds = function(_label) {
        var label = recode(_label);
        initializeLabelNodeIdLookup(label);
        return labelNodeIdLookup[label];
    };

    /**
     * Initialize type to relationship ID lookup.
     * @param {string} type - The relationship type
     * @returns {boolean} Always returns false
     */
    var initializeTypeRelationshipIdLookup = function(type) {
        if (!typeRelationshipIdLookup[type]) {
            typeRelationshipIdLookup[type] = [];
            return false;
        }
    };

    /**
     * Add a label-node ID pair to the lookup.
     * @param {string} _label - The label name
     * @param {number} nodeId - The node ID
     */
    var addLabelNodeIdLookup = function(_label, nodeId) {
        var label = recode(_label);
        initializeLabelNodeIdLookup(label);
        var equalsNodeIdCheck = function(el) {
            return el == nodeId;
        };
        if (nodeId != undefined && !labelNodeIdLookup[label].find(equalsNodeIdCheck)) {
            labelNodeIdLookup[label].push(nodeId);
        }
    };

    /**
     * Public method to add label-node ID lookup entry.
     * @param {string} _label - The label name
     * @param {number} nodeId - The node ID
     */
    this._addLabelNodeIdLookup = function(_label, nodeId) {
        addLabelNodeIdLookup(_label, nodeId);
    };

    /**
     * Add a type-relationship ID pair to the lookup.
     * @param {string} _type - The relationship type
     * @param {number} relationshipId - The relationship ID
     */
    var addTypeRelationshipIdLookup = function(_type, relationshipId) {
        if (relationshipId == undefined) {
            return;
        }
        var type = recode(_type);
        initializeTypeRelationshipIdLookup(type);
        var equalsRelationshipIdCheck = function(el) {
            return el == relationshipId;
        };
        if (!typeRelationshipIdLookup[type].find(equalsRelationshipIdCheck)) {
            typeRelationshipIdLookup[type].push(relationshipId);
            relationships[relationshipId].setStoredType(_type);
        }
    };

    /**
     * Public method to add type-relationship ID lookup entry.
     * @param {string} _type - The relationship type
     * @param {number} relationshipId - The relationship ID
     */
    this._addTypeRelationshipIdLookup = function(_type, relationshipId) {
        addTypeRelationshipIdLookup(_type, relationshipId);
    };

    /**
     * Get a free node ID.
     * @returns {number} A new node ID
     */
    var getFreeNodeId = function() {
        while (nodes[NODE_ID_FACTORY]) {
            NODE_ID_FACTORY++;
        }
        return NODE_ID_FACTORY;
    };

    /**
     * Add a node to the database.
     * @param {Node} node - The node to add
     * @param {number} [givenId] - Optional specific ID to use
     */
    var addNode = function(node, givenId) {
        if (!givenId) {
            node.setId(getFreeNodeId());
            nodes[node.id()] = node;
        } else if (givenId) {
            if (nodes[givenId]) {
                throw "Node with ID " + givenId + " already exists in the database.";
            }
            node.setId(givenId);
            nodes[givenId] = node;
        }
        for (var key in node.getRawProperties()) {
            addLookupNodeId(
                key,
                node.getLocalProperty(key),
                node.id()
            );
        }
        for (var label in node.labels()) {
            addLabelNodeIdLookup(
                label,
                node.id()
            );
        }
        engine.statement().setNodesAdded(
            engine.statement().getNodesAdded() + 1
        );
    };

    /**
     * Get a free relationship ID.
     * @returns {number} A new relationship ID
     */
    var getFreeRelationshipId = function() {
        while (relationships[RELATIONSHIP_ID_FACTORY]) {
            RELATIONSHIP_ID_FACTORY++;
        }
        return RELATIONSHIP_ID_FACTORY;
    };

    /**
     * Add a relationship to the database.
     * @param {Relationship} relationship - The relationship to add
     * @param {number} [givenId] - Optional specific ID to use
     */
    var addRelationship = function(relationship, givenId) {
        var relationshipId = null;
        if (!givenId) {
            relationshipId = getFreeRelationshipId();
        } else if (givenId) {
            if (nodes[givenId]) {
                throw "Relationship with ID " + givenId + " already exists in the database.";
            }
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

        for (var key in relationship.getProperties()) {
            addLookupRelationshipId(
                key,
                relationship.getProperty(key),
                relationship.id()
            );
        }
        addTypeRelationshipIdLookup(
            relationship.getType(),
            relationship.id()
        );
        relationship.setIsAdded();
        engine.statement().setRelationshipsAdded(
            engine.statement().getRelationshipsAdded() + 1
        );
    };

    /**
     * Match a relationship pattern against the database.
     * @param {Relationship} relationship - The relationship pattern
     * @param {Node} fromNode - The from node
     * @param {Node} toNode - The to node
     * @returns {number[]|boolean} Array of matching relationship IDs or false
     */
    var relationshipMatch = function(relationship, fromNode, toNode) {
        var relationshipIds = [];
        var relationshipIdsFromLookup;
        var Matcher = (typeof module !== 'undefined' && module.exports ?
            require('./Matchers.js').Matcher :
            CypherNG.core.Matcher);

        if (!relationship.isReferred()) {
            if (fromNode && toNode) {
                relationshipIdsFromLookup = lookupRelationships(
                    fromNode.id(),
                    toNode.id()
                );
                relationshipIds = relationshipIds.concat(
                    relationshipIdsFromLookup
                );
            } else if (fromNode && !toNode) {
                relationshipIdsFromLookup =
                    lookupRelationshipIdsByNodeId(fromNode.id());
                if (relationship.uniDirectional()) {
                    relationshipIdsFromLookup.concat(
                        lookupRelationshipIdsByNodeIdIncoming(fromNode.id())
                    );
                }
                relationshipIds = relationshipIds.concat(
                    relationshipIdsFromLookup
                );
            }
        } else if (relationship.isReferred()) {
            var referredRelationship = relationship.getReferredRelationship().getData();
            if (referredRelationship) {
                if (!(referredRelationship.constructor == (typeof module !== 'undefined' && module.exports ?
                        require('./References.js').RelationshipReference :
                        CypherNG.core.RelationshipReference) ||
                    referredRelationship.constructor == Relationship)) {
                    throw "Expected relationship.";
                }
            } else {
                throw "Expected relationship.";
            }
            relationshipIds.push(
                referredRelationship.id()
            );
        }

        if (relationshipIds.length == 0) {
            return false;
        }

        var matcher = new Matcher();
        matcher.setMatchingSet(relationshipIds, 0);

        // Does the relationship have a direction
        if (relationship.leftDirection() || relationship.rightDirection()) {
            matcher.incrementToMatchCount(); // Match direction
        }
        // Does the pattern have a type?
        if (relationship.getType()) {
            matcher.incrementToMatchCount(); // Match type
        }
        for (var key in relationship.getProperties()) {
            matcher.incrementToMatchCount();
        }

        if (matcher.toMatchCount() > 0) {
            var dbRelationship;
            for (var i = 0; i < relationshipIds.length; i++) {
                dbRelationship = relationships[relationshipIds[i]];

                // Match direction if any
                if (relationship.leftDirection() || relationship.rightDirection()) {
                    if (relationship.leftDirection() == dbRelationship.leftDirection(fromNode.id()) ||
                        relationship.rightDirection() == dbRelationship.rightDirection(fromNode.id())) {
                        matcher.keepMatchTally(relationshipIds[i]);
                    }
                }

                // Match type if any
                if (relationship.getType()) {
                    if (dbRelationship.getType() &&
                        dbRelationship.getType() == relationship.getType()) {
                        matcher.keepMatchTally(relationshipIds[i]);
                    }
                }

                // Match relationship properties
                for (var key in relationship.getProperties()) {
                    if (relationship.getLocalProperty(key) == dbRelationship.getLocalProperty(key)) {
                        matcher.keepMatchTally(relationshipIds[i]);
                    }
                }
            }
            matcher.updateMatchingSet();
        }

        if (matcher.matchingSetSize() == 0) {
            return false;
        }
        return matcher.matchingSet();
    };

    /**
     * Create a node in the database.
     * @param {Node} node - The node pattern to create
     */
    this.createNode = function(node) {
        var NodeReference = (typeof module !== 'undefined' && module.exports ?
            require('./References.js').NodeReference :
            CypherNG.core.NodeReference);
        var Unwind = (typeof module !== 'undefined' && module.exports ?
            require('../query/operations/Unwind.js').Unwind :
            CypherNG.query.operations.Unwind);

        var nodeInstance;

        if (node.isReferred()) {
            nodeInstance = node.getReferredNode().getData();
            if (nodeInstance.constructor == Unwind) {
                nodeInstance = nodeInstance.value();
            }
            if (nodeInstance.constructor == NodeReference) {
                nodeInstance = self.getNodeById(nodeInstance.nodeId());
            }
        } else {
            node.bindProperties();
            nodeInstance = node.copy();
            addNode(nodeInstance);
            node.addMatchedNode(nodeInstance);
        }

        if (node.outgoingRelationship()) {
            node.outgoingRelationship().setFromNode(nodeInstance);
        }

        if (node.incomingRelationship()) {
            node.incomingRelationship().bindProperties();
            node.incomingRelationship().setToNode(nodeInstance);
            var relationshipToAdd = node.incomingRelationship().copy();
            addRelationship(relationshipToAdd);
            node.incomingRelationship().addMatchedRelationship(
                relationshipToAdd
            );
        }

        if (node.nextNode()) {
            node.nextNode().create();
        } else if (!node.nextNode()) {
            node.nextAction();
        }
    };

    /**
     * Match a node pattern against the database.
     * @param {Node} node - The node pattern to match
     * @param {boolean} merge - True for merge, false for match
     * @param {number} [pathExpansionDepth] - Current path expansion depth
     */
    this.matchNode = function(node, merge, pathExpansionDepth) {
        var returnValue;
        var nodeIdsForConveyorBelt = getMatchingNodeIds(node, merge);

        if (nodeIdsForConveyorBelt && nodeIdsForConveyorBelt.length) {
            for (var nodeIdIndex = 0; nodeIdIndex < nodeIdsForConveyorBelt.length; nodeIdIndex++) {
                var nodeId = nodeIdsForConveyorBelt[nodeIdIndex];

                returnValue = processNodeWithoutRelationships(node, nodeId, merge, pathExpansionDepth);
                if (returnValue != undefined) return returnValue;
                returnValue = processNodeWithOutgoingRelationship(node, nodeIdIndex, nodeId, merge, pathExpansionDepth);
                if (returnValue != undefined) return returnValue;
                returnValue = processNodeWithIncomingRelationship(node, nodeId, merge, pathExpansionDepth);
                if (returnValue != undefined) return returnValue;
            }
        }

        if (node.getPattern().usedAsCondition()) {
            return false;
        }
    };

    /**
     * Process node matching (internal function).
     * @param {Node} node - The node pattern
     * @param {boolean} merge - True for merge, false for match
     * @param {number} pathExpansionDepth - Current path expansion depth
     * @returns {number[]|undefined} Array of matching node IDs
     */
    var getMatchingNodeIds = function(node, merge) {
        var nodeIdsForConveyorBelt = [];
        var Matcher = (typeof module !== 'undefined' && module.exports ?
            require('./Matchers.js').Matcher :
            CypherNG.core.Matcher);
        var Unwind = (typeof module !== 'undefined' && module.exports ?
            require('../query/operations/Unwind.js').Unwind :
            CypherNG.query.operations.Unwind);
        var Node = (typeof module !== 'undefined' && module.exports ?
            require('./Node.js').Node :
            CypherNG.core.Node);
        var NodeReference = (typeof module !== 'undefined' && module.exports ?
            require('./References.js').NodeReference :
            CypherNG.core.NodeReference);

        if (!node.isExpanded()) {
            var matcher = new Matcher();

            if (node.isReferred()) {
                var referredNode = node.getReferredNode().getData();
                if (referredNode.constructor == Unwind) {
                    referredNode = referredNode.value();
                }
                if (referredNode) {
                    if (!(referredNode.constructor == Node ||
                            referredNode.constructor == NodeReference)) {
                        throw "Expected node.";
                    }
                } else {
                    throw "Expected node.";
                }
                matcher.addToMatchingSet(
                    referredNode.id()
                );
            }

            // Check for incoming relationship pattern
            if (node.incomingRelationship()) {
                if (node.incomingRelationship().hasExpandedEndNode() && !node.isReferred()) {
                    matcher.addToMatchingSet(
                        node.incomingRelationship().getExpandedEndNode().id()
                    );
                }
            }

            matchNodeProperties(node, matcher);
            matchNodeLabels(node, matcher);

            nodeIdsForConveyorBelt = processNodeMatcher(matcher);

            if (nodeIdsForConveyorBelt.length == 0 && merge) {
                if (node.getPattern().usedAsCondition()) {
                    return false;
                } else {
                    node.getPattern().create();
                    return;
                }
            }

        } else if (node.isExpanded()) {
            nodeIdsForConveyorBelt = [node.getExpandedNode().id()];
        }
        return nodeIdsForConveyorBelt;
    };

    /**
     * Match node properties (internal function).
     * @param {Node} node - The node pattern
     * @param {Matcher} matcher - The matcher instance
     */
    var matchNodeProperties = function(node, matcher) {
        for (var key in node.getProperties()) {
            node.bindProperty(key);

            // First pattern criteria to match
            if (matcher.toMatchCount() == 0 && matcher.matchingSetSize() == 0) {
                var nodeIds = lookupNodeIds(
                    key,
                    node.getLocalProperty(key)
                );
                if (nodeIds) {
                    matcher.setMatchingSet(nodeIds);
                }
                // There are matching node ids
            } else if (matcher.matchingSetSize() > 0) {
                for (var i = 0; i < matcher.matchingSetSize(); i++) {
                    if (node.getLocalProperty(key) == nodes[matcher.matchingSet()[i]].getLocalProperty(key)) {
                        matcher.keepMatchTally(matcher.matchingSet()[i]);
                    }
                }
            }

            matcher.incrementToMatchCount();
            matcher.updateMatchingSet();
        }
    };

    /**
     * Match node labels (internal function).
     * @param {Node} node - The node pattern
     * @param {Matcher} matcher - The matcher instance
     */
    var matchNodeLabels = function(node, matcher) {
        for (var label in node.labels()) {
            // First pattern criteria to match
            if (matcher.toMatchCount() == 0 && matcher.matchingSetSize() == 0) {
                var nodeIds = lookupLabelNodeIds(label);
                if (nodeIds) {
                    matcher.setMatchingSet(nodeIds);
                }
                // There are matching node ids
            } else if (matcher.matchingSetSize() > 0) {
                for (var i = 0; i < matcher.matchingSetSize(); i++) {
                    if (nodes[matcher.matchingSet()[i]].hasLabel(label)) {
                        matcher.keepMatchTally(matcher.matchingSet()[i]);
                    }
                }
            }

            matcher.incrementToMatchCount();
            matcher.updateMatchingSet();
        }
    };

    /**
     * Process node matcher results (internal function).
     * @param {Matcher} matcher - The matcher instance
     * @returns {number[]} Array of matching node IDs
     */
    var processNodeMatcher = function(matcher) {
        var nodeIdsForConveyorBelt = [];
        if (matcher.matchingSetSize() > 0) {
            nodeIdsForConveyorBelt = matcher.matchingSet();
        } else if (matcher.toMatchCount() == 0) {
            // Match any node
            nodeIdsForConveyorBelt = new Array(nodes.length);
            for (var i = 0; i < nodes.length; i++) {
                nodeIdsForConveyorBelt[i] = nodes[i].id();
            }
        }
        return nodeIdsForConveyorBelt;
    };

    /**
     * Process node without relationships (internal function).
     * @param {Node} node - The node pattern
     * @param {number} nodeId - The matched node ID
     * @param {boolean} merge - True for merge, false for match
     * @param {number} pathExpansionDepth - Current path expansion depth
     */
    var processNodeWithoutRelationships = function(node, nodeId, merge, pathExpansionDepth) {
        if (!node.incomingRelationship() && !node.outgoingRelationship()) {
            node.addMatchedNode(nodes[nodeId]);
            if (node.getPattern().usedAsCondition()) {
                return conveyorBelt(node, merge, pathExpansionDepth);
            } else {
                conveyorBelt(node, merge, pathExpansionDepth);
            }
        }
    };

    /**
     * Process node with outgoing relationship (internal function).
     * @param {Node} node - The node pattern
     * @param {number} nodeIdIndex - The node ID index
     * @param {number} nodeId - The matched node ID
     * @param {boolean} merge - True for merge, false for match
     * @param {number} pathExpansionDepth - Current path expansion depth
     * @returns {*} Processing result
     */
    var processNodeWithOutgoingRelationship = function(node, nodeIdIndex, nodeId, merge, pathExpansionDepth) {
        var returnValue;
        if (node.outgoingRelationship()) {
            var matchingRelationshipIds = getMatchingRelationshipIds(node, nodeIdIndex, nodeId, pathExpansionDepth);
            if (!matchingRelationshipIds && merge) {
                node.getPattern().create();
                returnValue = -1;
            } else if (matchingRelationshipIds && matchingRelationshipIds.length > 0) {
                returnValue = processMatchingRelationships(node, nodeId, merge, pathExpansionDepth, matchingRelationshipIds);
                if (returnValue != undefined) return returnValue;
                returnValue = pathExpansion(node, nodeId, pathExpansionDepth, matchingRelationshipIds);
                if (returnValue != undefined) return returnValue;
            }
        }
        return returnValue;
    };

    /**
     * Process node with incoming relationship (internal function).
     * @param {Node} node - The node pattern
     * @param {number} nodeId - The matched node ID
     * @param {boolean} merge - True for merge, false for match
     * @param {number} pathExpansionDepth - Current path expansion depth
     * @returns {*} Processing result
     */
    var processNodeWithIncomingRelationship = function(node, nodeId, merge, pathExpansionDepth) {
        var returnValue;
        if (node.incomingRelationship()) {
            node.addMatchedNode(nodes[nodeId]);

            if (node.incomingRelationship().hasExpandedEndNode()) {
                var convey = true;

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

    /**
     * Get matching relationship IDs (internal function).
     * @param {Node} node - The node pattern
     * @param {number} nodeIdIndex - The node ID index
     * @param {number} nodeId - The matched node ID
     * @param {number} pathExpansionDepth - Current path expansion depth
     * @returns {number[]|boolean} Array of relationship IDs or false
     */
    var getMatchingRelationshipIds = function(node, nodeIdIndex, nodeId, pathExpansionDepth) {
        if (!pathExpansionDepth && node.outgoingRelationship().expandPath() && nodeIdIndex > 0) {
            node.outgoingRelationship().resetExpandedPath();
        }

        if (!node.isExpanded()) {
            node.addMatchedNode(nodes[nodeId]);
            node.outgoingRelationship().setFromNode(nodes[nodeId]);
        }

        var toNode = null;

        if (node.outgoingRelationship().getNextObject().isReferred() &&
            !node.outgoingRelationship().hasVariablePathLength()) {
            toNode = node.outgoingRelationship().getNextObject().getReferredNode().getData();
        }

        node.outgoingRelationship().bindProperties();

        return relationshipMatch(
            node.outgoingRelationship(),
            nodes[nodeId],
            toNode
        );
    };

    /**
     * Process matching relationships (internal function).
     * @param {Node} node - The node pattern
     * @param {number} nodeId - The matched node ID
     * @param {boolean} merge - True for merge, false for match
     * @param {number} pathExpansionDepth - Current path expansion depth
     * @param {number[]} matchingRelationshipIds - Array of relationship IDs
     * @returns {*} Processing result
     */
    var processMatchingRelationships = function(node, nodeId, merge, pathExpansionDepth, matchingRelationshipIds) {
        var returnValue;
        var relationship;
        for (var relationshipIdIdx = 0; relationshipIdIdx < matchingRelationshipIds.length; relationshipIdIdx++) {
            relationship = relationships[matchingRelationshipIds[relationshipIdIdx]];

            if (node.outgoingRelationship().pathLengthSatisfied()) {
                node.outgoingRelationship().setExpandedEndNode(
                    relationship.getToNode(nodeId)
                );

                node.outgoingRelationship().setMatchedRelationship(relationship);
                node.outgoingRelationship().addMatchedRelationship(
                    relationship, {
                        fromNodeId: nodeId,
                        toNodeId: relationship.getToNode(nodeId).id()
                    }
                );

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

    /**
     * Handle path expansion (internal function).
     * @param {Node} node - The node pattern
     * @param {number} nodeId - The matched node ID
     * @param {number} pathExpansionDepth - Current path expansion depth
     * @param {number[]} matchingRelationshipIds - Array of relationship IDs
     * @returns {*} Processing result
     */
    var pathExpansion = function(node, nodeId, pathExpansionDepth, matchingRelationshipIds) {
        if (node.outgoingRelationship().expandPath()) {
            for (var relationshipIdIdx = 0; relationshipIdIdx < matchingRelationshipIds.length; relationshipIdIdx++) {
                relationship = relationships[matchingRelationshipIds[relationshipIdIdx]];

                if (node.outgoingRelationship().visitedBefore(relationship.getToNode(nodeId).id())) {
                    node.outgoingRelationship().backTrackExpandedPath();
                    continue;
                }

                if (node.outgoingRelationship().pathLengthSatisfied()) {
                    node.setExpandedNode(
                        relationship.getToNode(nodeId)
                    );

                    self.matchNode(
                        node,
                        false,
                        (pathExpansionDepth || 0) + 1
                    );

                    node.setExpandedNode(null);
                }

                if (node.outgoingRelationship().expandPath() && !pathExpansionDepth) {
                    node.outgoingRelationship().backTrackExpandedPath();
                }
            }
        }
    };

    /**
     * Conveyor belt for pattern processing (internal function).
     * @param {Node} node - The node pattern
     * @param {boolean} merge - True for merge, false for match
     * @param {number} pathExpansionDepth - Current path expansion depth
     * @returns {*} Processing result
     */
    var conveyorBelt = function(node, merge, pathExpansionDepth) {
        if (node.nextNode()) {
            if (node.getPattern().usedAsCondition()) {
                return node.nextNode().convey(merge, pathExpansionDepth);
            } else {
                node.nextNode().convey(merge, pathExpansionDepth);
            }
        } else if (!node.nextNode()) {
            if (node.getPattern().usedAsCondition()) {
                return node.nextAction();
            } else {
                node.nextAction();
            }
        }
    };

    /**
     * Get a node by ID.
     * @param {number} id - The node ID
     * @returns {Node} The node instance
     */
    this.getNodeById = function(id) {
        return nodes[id];
    };

    /**
     * Get a relationship by ID.
     * @param {number} id - The relationship ID
     * @returns {Relationship} The relationship instance
     */
    this.getRelationshipById = function(id) {
        return relationships[id];
    };

    /**
     * Add a node from a plain object.
     * @param {Object} node - The node object with id, properties, and labels
     */
    this.addNode = function(node) {
        var NodeClass = (typeof module !== 'undefined' && module.exports ?
            require('./Node.js').Node :
            CypherNG.core.Node);
        var n = new NodeClass(this);
        n.setProperties(node.properties);
        n.setLabels(node.labels);
        addNode(n, node.id);
    };

    /**
     * Add a relationship from a plain object.
     * @param {Object} relationship - The relationship object with id, from, to, properties, type
     */
    this.addRelationship = function(relationship) {
        var RelationshipClass = (typeof module !== 'undefined' && module.exports ?
            require('./Relationship.js').Relationship :
            CypherNG.core.Relationship);
        var r = new RelationshipClass(self);
        r.setFromNode(this.getNodeById(relationship.from));
        r.setToNode(this.getNodeById(relationship.to));
        r.setProperties(relationship.properties);
        r.setType(relationship.type);
        addRelationship(r, relationship.id);
    };

    /**
     * Add a table to the database.
     * @param {Table} table - The table to add
     */
    this.addTable = function(table) {
        tables[table.name()] = table;
    };

    /**
     * Get a table by name.
     * @param {string} tableName - The table name
     * @returns {Table} The table instance
     * @throws {Error} If table doesn't exist
     */
    this.getTable = function(tableName) {
        if (!(tableName in tables)) {
            throw "Table \"" + tableName + "\" does not exist.";
        }
        return tables[tableName];
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.DB = DB;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).core = (this.CypherNG = this.CypherNG || {}).core || {});
