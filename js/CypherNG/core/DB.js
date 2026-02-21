/**
 * DB - In-memory graph database
 * 
 * Core storage engine for nodes, relationships, and indexes.
 * Provides CRUD operations and pattern matching capabilities.
 */
const { StringRecoder } = require('./StringRecoder.js');
const { Node } = require('./Node.js');
const { Relationship } = require('./Relationship.js');

class DB {
  /**
   * @param {CypherJS} engine - Engine instance
   */
  constructor(engine) {
    /** @private */
    this._engine = engine;
    /** @private @type {Array<Node>} */
    this._nodes = [];
    /** @private */
    this._nodeIdFactory = 0;
    /** @private @type {Object<number, Array<number>>} */
    this._nodeIdLookup = {};
    /** @private @type {Object<number, Array<number>>} */
    this._labelNodeIdLookup = {};
    /** @private @type {Array<Relationship>} */
    this._relationships = [];
    /** @private */
    this._relationshipIdFactory = 0;
    /** @private @type {Object<number, Object<number, Array<number>>>} */
    this._relationshipLookup = {};
    /** @private @type {Object<number, Array<number>>} */
    this._relationshipIdsByNodeIdLookup = {};
    /** @private @type {Object<number, Array<number>>} */
    this._relationshipIdsByNodeIdLookupIncoming = {};
    /** @private @type {Object<number, Object<number, Array<number>>>} */
    this._relationshipIdLookup = {};
    /** @private @type {Object<number, Array<number>>} */
    this._typeRelationshipIdLookup = {};
    /** @private @type {Object<string, Table>} */
    this._tables = {};
    /** @private */
    this._stringRecoder = new StringRecoder();
  }

  /**
   * Recodes a string value
   * @private
   * @param {*} val - Value to recode
   * @returns {number}
   */
  _recode(val) {
    return this._stringRecoder.recode(val);
  }

  // Node lookup methods

  _initializeNodeIdLookup(key, value) {
    if (!this._nodeIdLookup[key]) {
      this._nodeIdLookup[key] = {};
    }
    if (!this._nodeIdLookup[key][value]) {
      this._nodeIdLookup[key][value] = [];
    }
  }

  lookupNodeIds(key, value) {
    const recodedKey = this._recode(key);
    const recodedValue = this._recode(value);
    this._initializeNodeIdLookup(recodedKey, recodedValue);
    return this._nodeIdLookup[recodedKey][recodedValue];
  }

  addLookupNodeId(key, value, nodeId) {
    const recodedKey = this._recode(key);
    const recodedValue = this._recode(value);
    this._initializeNodeIdLookup(recodedKey, recodedValue);
    this._nodeIdLookup[recodedKey][recodedValue].push(nodeId);
  }

  // Label lookup methods

  _initializeLabelNodeIdLookup(label) {
    if (!this._labelNodeIdLookup[label]) {
      this._labelNodeIdLookup[label] = [];
    }
  }

  lookupLabelNodeIds(label) {
    const recodedLabel = this._recode(label);
    this._initializeLabelNodeIdLookup(recodedLabel);
    return this._labelNodeIdLookup[recodedLabel];
  }

  addLookupLabelNodeId(label, nodeId) {
    const recodedLabel = this._recode(label);
    this._initializeLabelNodeIdLookup(recodedLabel);
    const exists = this._labelNodeIdLookup[recodedLabel].find(id => id === nodeId);
    if (nodeId !== undefined && !exists) {
      this._labelNodeIdLookup[recodedLabel].push(nodeId);
    }
  }

  _addLabelNodeIdLookup(label, nodeId) {
    this.addLookupLabelNodeId(label, nodeId);
  }

  // Relationship lookup methods

  _initializeRelationshipLookup(fromNodeId, toNodeId) {
    if (fromNodeId !== undefined) {
      if (!this._relationshipLookup[fromNodeId]) {
        this._relationshipLookup[fromNodeId] = {};
      }
      if (toNodeId !== undefined && !this._relationshipLookup[fromNodeId][toNodeId]) {
        this._relationshipLookup[fromNodeId][toNodeId] = [];
      }
    }
  }

  lookupRelationships(fromNodeId, toNodeId) {
    this._initializeRelationshipLookup(fromNodeId, toNodeId);
    if (fromNodeId !== undefined) {
      if (toNodeId !== undefined) {
        return this._relationshipLookup[fromNodeId][toNodeId];
      } else {
        let relationshipIds = [];
        for (const nodeId in this._relationshipLookup[fromNodeId]) {
          relationshipIds = relationshipIds.concat(this._relationshipLookup[fromNodeId][nodeId]);
        }
        return relationshipIds;
      }
    }
    return [];
  }

  addLookupRelationship(fromNodeId, toNodeId, relationshipId) {
    this._initializeRelationshipLookup(fromNodeId, toNodeId);
    this._relationshipLookup[fromNodeId][toNodeId].push(relationshipId);
    this._addLookupRelationshipIdsByNodeId(fromNodeId, relationshipId);
    this._addLookupRelationshipIdsByNodeIdIncoming(toNodeId, relationshipId);
  }

  // Relationship by node ID lookup

  _initializeRelationshipIdsByNodeIdLookup(nodeId) {
    if (!this._relationshipIdsByNodeIdLookup[nodeId]) {
      this._relationshipIdsByNodeIdLookup[nodeId] = [];
    }
  }

  lookupRelationshipIdsByNodeId(nodeId) {
    this._initializeRelationshipIdsByNodeIdLookup(nodeId);
    return this._relationshipIdsByNodeIdLookup[nodeId];
  }

  _addLookupRelationshipIdsByNodeId(nodeId, relationshipId) {
    this._initializeRelationshipIdsByNodeIdLookup(nodeId);
    this._relationshipIdsByNodeIdLookup[nodeId].push(relationshipId);
  }

  // Incoming relationship lookup

  _initializeRelationshipIdsByNodeIdLookupIncoming(nodeId) {
    if (!this._relationshipIdsByNodeIdLookupIncoming[nodeId]) {
      this._relationshipIdsByNodeIdLookupIncoming[nodeId] = [];
    }
  }

  lookupRelationshipIdsByNodeIdIncoming(nodeId) {
    this._initializeRelationshipIdsByNodeIdLookupIncoming(nodeId);
    return this._relationshipIdsByNodeIdLookupIncoming[nodeId];
  }

  _addLookupRelationshipIdsByNodeIdIncoming(nodeId, relationshipId) {
    this._initializeRelationshipIdsByNodeIdLookupIncoming(nodeId);
    this._relationshipIdsByNodeIdLookupIncoming[nodeId].push(relationshipId);
  }

  // Relationship property lookup

  _initializeRelationshipIdLookup(key, value) {
    if (!this._relationshipIdLookup[key]) {
      this._relationshipIdLookup[key] = {};
    }
    if (!this._relationshipIdLookup[key][value]) {
      this._relationshipIdLookup[key][value] = [];
    }
  }

  addLookupRelationshipId(key, value, relationshipId) {
    const recodedKey = this._recode(key);
    const recodedValue = this._recode(value);
    this._initializeRelationshipIdLookup(recodedKey, recodedValue);
    this._relationshipIdLookup[recodedKey][recodedValue].push(relationshipId);
  }

  // Type lookup

  _initializeTypeRelationshipIdLookup(type) {
    if (!this._typeRelationshipIdLookup[type]) {
      this._typeRelationshipIdLookup[type] = [];
      return false;
    }
    return true;
  }

  addTypeRelationshipIdLookup(type, relationshipId) {
    if (relationshipId === undefined) return;
    const recodedType = this._recode(type);
    this._initializeTypeRelationshipIdLookup(recodedType);
    const exists = this._typeRelationshipIdLookup[recodedType].find(id => id === relationshipId);
    if (!exists) {
      this._typeRelationshipIdLookup[recodedType].push(relationshipId);
      const rel = this._relationships[relationshipId];
      if (rel && rel.setStoredType) {
        rel.setStoredType(type);
      }
    }
  }

  _addTypeRelationshipIdLookup(type, relationshipId) {
    this.addTypeRelationshipIdLookup(type, relationshipId);
  }

  // Node management

  _getFreeNodeId() {
    while (this._nodes[this._nodeIdFactory]) {
      this._nodeIdFactory++;
    }
    return this._nodeIdFactory;
  }

  addNode(node, givenId) {
    if (!givenId) {
      node.setId(this._getFreeNodeId());
      this._nodes[node.id()] = node;
    } else {
      if (this._nodes[givenId]) {
        throw new Error(`Node with ID ${givenId} already exists in the database.`);
      }
      node.setId(givenId);
      this._nodes[givenId] = node;
    }

    // Add to property lookup
    const rawProps = node.getRawProperties ? node.getRawProperties() : {};
    for (const key in rawProps) {
      this.addLookupNodeId(key, node.getLocalProperty(key), node.id());
    }

    // Add to label lookup
    const labels = node.labels ? node.labels() : {};
    for (const label in labels) {
      this.addLookupLabelNodeId(label, node.id());
    }

    // Update stats
    if (this._engine && this._engine.statement) {
      const stmt = this._engine.statement();
      if (stmt && stmt.setNodesAdded) {
        stmt.setNodesAdded(stmt.getNodesAdded() + 1);
      }
    }
  }

  getNodeById(id) {
    return this._nodes[id];
  }

  createNode(node) {
    let nodeInstance;

    if (node.isReferred && node.isReferred()) {
      const referredNode = node.getReferredNode ? node.getReferredNode().getData() : null;
      if (referredNode) {
        nodeInstance = referredNode;
      } else {
        throw new Error('Expected node.');
      }
    } else {
      if (node.bindProperties) node.bindProperties();
      nodeInstance = node.copy ? node.copy() : node;
      this.addNode(nodeInstance);
      if (node.addMatchedNode) node.addMatchedNode(nodeInstance);
    }

    if (node.outgoingRelationship && node.outgoingRelationship()) {
      node.outgoingRelationship().setFromNode(nodeInstance);
    }

    if (node.incomingRelationship && node.incomingRelationship()) {
      const incomingRel = node.incomingRelationship();
      if (incomingRel.bindProperties) incomingRel.bindProperties();
      incomingRel.setToNode(nodeInstance);
      const relationshipToAdd = incomingRel.copy ? incomingRel.copy() : incomingRel;
      this.addRelationship(relationshipToAdd);
      if (incomingRel.addMatchedRelationship) {
        incomingRel.addMatchedRelationship(relationshipToAdd);
      }
    }

    if (node.nextNode && node.nextNode()) {
      node.nextNode().create();
    } else if (node.nextAction) {
      node.nextAction();
    }
  }

  // Relationship management

  _getFreeRelationshipId() {
    while (this._relationships[this._relationshipIdFactory]) {
      this._relationshipIdFactory++;
    }
    return this._relationshipIdFactory;
  }

  addRelationship(relationship, givenId) {
    let relationshipId = null;
    if (!givenId) {
      relationshipId = this._getFreeRelationshipId();
    } else {
      if (this._nodes[givenId]) {
        throw new Error(`Relationship with ID ${givenId} already exists in the database.`);
      }
      relationshipId = givenId;
    }

    relationship.setId(relationshipId);
    this._relationships[relationshipId] = relationship;

    const fromNode = relationship.getFromNode ? relationship.getFromNode() : null;
    const toNode = relationship.getToNode ? relationship.getToNode() : null;

    if (fromNode && toNode) {
      this.addLookupRelationship(fromNode.id(), toNode.id(), relationshipId);
      if (toNode.id() !== fromNode.id()) {
        this.addLookupRelationship(toNode.id(), fromNode.id(), relationshipId);
      }
    }

    const props = relationship.getProperties ? relationship.getProperties() : {};
    for (const key in props) {
      this.addLookupRelationshipId(key, relationship.getProperty(key), relationshipId);
    }

    const type = relationship.getType ? relationship.getType() : null;
    if (type) {
      this.addTypeRelationshipIdLookup(type, relationshipId);
    }

    if (relationship.setIsAdded) relationship.setIsAdded();

    if (this._engine && this._engine.statement) {
      const stmt = this._engine.statement();
      if (stmt && stmt.setRelationshipsAdded) {
        stmt.setRelationshipsAdded(stmt.getRelationshipsAdded() + 1);
      }
    }
  }

  getRelationshipById(id) {
    return this._relationships[id];
  }

  // Pattern matching

  matchNode(node, merge, pathExpansionDepth) {
    // This is a complex method that would need the full implementation
    // For now, providing the structure
    const nodeIds = this._getMatchingNodeIds(node, merge);
    
    if (nodeIds && nodeIds.length) {
      // Check if this node has relationships
      const hasRelationships = node.outgoingRelationship && node.outgoingRelationship() ||
                               node.incomingRelationship && node.incomingRelationship();
      
      if (hasRelationships) {
        // For relationship patterns, only process the first matching node
        // to avoid overwriting matched nodes
        const nodeId = nodeIds[0];
        const result = this._processNode(node, nodeId, merge, pathExpansionDepth, 0);
        if (result !== undefined) return result;
      } else {
        // For simple node patterns, process all matches for aggregation
        for (let i = 0; i < nodeIds.length; i++) {
          const nodeId = nodeIds[i];
          const result = this._processNode(node, nodeId, merge, pathExpansionDepth, i);
          if (result !== undefined) return result;
        }
      }
    }

    if (node.getPattern && node.getPattern().usedAsCondition()) {
      return false;
    }
  }

  _getMatchingNodeIds(node, merge) {
    // Implementation would match the original logic
    // This is a simplified version
    if (node.isExpanded && node.isExpanded()) {
      const expandedNode = node.getExpandedNode ? node.getExpandedNode() : null;
      return expandedNode ? [expandedNode.id()] : [];
    }

    // Get matching node IDs based on properties and labels
    let nodeIds = [];
    
    // Match by properties
    const props = node.getProperties ? node.getProperties() : {};
    for (const key in props) {
      if (node.bindProperty) node.bindProperty(key);
      const localValue = node.getLocalProperty ? node.getLocalProperty(key) : null;
      const matchingIds = this.lookupNodeIds(key, localValue);
      if (matchingIds) {
        nodeIds = nodeIds.concat(matchingIds);
      }
    }

    // Match by labels
    const labels = node.labels ? node.labels() : {};
    for (const label in labels) {
      const labelIds = this.lookupLabelNodeIds(label);
      if (labelIds) {
        nodeIds = nodeIds.concat(labelIds);
      }
    }

    // Remove duplicates
    nodeIds = [...new Set(nodeIds)];

    if (nodeIds.length === 0 && merge) {
      if (node.getPattern && node.getPattern().usedAsCondition()) {
        return false;
      } else {
        if (node.getPattern) node.getPattern().create();
        return [];
      }
    }

    return nodeIds;
  }

  _processNode(node, nodeId, merge, pathExpansionDepth, nodeIdIndex, isFirstNode = true) {
    // Process node without relationships
    if (!node.incomingRelationship || !node.incomingRelationship()) {
      if (!node.outgoingRelationship || !node.outgoingRelationship()) {
        const matchedNode = this.getNodeById(nodeId);
        if (node.addMatchedNode) node.addMatchedNode(matchedNode);
        
        // Trigger aggregation for this match
        this._triggerAggregation();
        
        if (node.getPattern && node.getPattern().usedAsCondition()) {
          return this._conveyorBelt(node, merge, pathExpansionDepth);
        } else {
          this._conveyorBelt(node, merge, pathExpansionDepth);
        }
      }
    }

    // Process outgoing relationships
    if (node.outgoingRelationship && node.outgoingRelationship()) {
      const rel = node.outgoingRelationship();
      const relType = rel.getType ? rel.getType() : null;
      
      // Get all relationships from this node
      const relationshipIds = this.lookupRelationshipIdsByNodeId(nodeId);
      
      for (const relId of relationshipIds) {
        const relationship = this.getRelationshipById(relId);
        if (!relationship) continue;
        
        // Check if relationship type matches
        if (relType && relationship.getType() !== relType) continue;
        
        // Get the target node
        const toNode = relationship.getToNode ? relationship.getToNode() : null;
        if (!toNode) continue;
        
        // Match the end node
        const nextNode = node.nextNode ? node.nextNode() : null;
        if (nextNode) {
          // Check if end node matches the pattern
          if (this._nodeMatchesPattern(toNode, nextNode)) {
            // Only set the start node matched if this is the first node in the chain
            if (isFirstNode) {
              const matchedNode = this.getNodeById(nodeId);
              if (node.addMatchedNode) node.addMatchedNode(matchedNode);
            }
            if (rel.addMatchedRelationship) rel.addMatchedRelationship(relationship);
            if (nextNode.addMatchedNode) nextNode.addMatchedNode(toNode);
            
            // Trigger aggregation for this match
            this._triggerAggregation();
            
            // Continue with next node in pattern
            if (nextNode.nextNode && nextNode.nextNode()) {
              this._processNode(nextNode, toNode.id(), merge, pathExpansionDepth, 0, false);
            } else {
              // End of pattern - trigger output
              if (node.getPattern && node.getPattern().finish) {
                node.getPattern().finish();
              }
            }
            
            // Only process the first matching relationship for the first node
            if (isFirstNode) {
              return;
            }
          }
        }
      }
    }

    // Process incoming relationships
    if (node.incomingRelationship && node.incomingRelationship()) {
      // Implementation for incoming relationship processing
    }
  }

  _nodeMatchesPattern(node, patternNode) {
    // Check if node matches the pattern criteria
    const patternLabels = patternNode.labels ? patternNode.labels() : {};
    const nodeLabels = node.labels ? node.labels() : {};
    
    // Check labels
    for (const label in patternLabels) {
      if (!nodeLabels[label]) return false;
    }
    
    // Check properties
    const patternProps = patternNode.getProperties ? patternNode.getProperties() : {};
    const nodeProps = node.getProperties ? node.getProperties() : {};
    
    for (const key in patternProps) {
      if (nodeProps[key] !== patternProps[key]) return false;
    }
    
    return true;
  }

  _conveyorBelt(node, merge, pathExpansionDepth) {
    if (node.nextNode && node.nextNode()) {
      if (node.getPattern && node.getPattern().usedAsCondition()) {
        return node.nextNode().convey(merge, pathExpansionDepth);
      } else {
        node.nextNode().convey(merge, pathExpansionDepth);
      }
    } else {
      if (node.getPattern && node.getPattern().usedAsCondition()) {
        return node.nextAction ? node.nextAction() : null;
      } else {
        if (node.nextAction) node.nextAction();
      }
    }
  }

  _triggerAggregation() {
    // Trigger aggregation on the statement's Return operation
    if (this._engine && this._engine.statement) {
      const stmt = this._engine.statement();
      const ctx = stmt.context();
      if (ctx && ctx._reduceExpressions && ctx._reduceExpressions.length > 0) {
        for (const expr of ctx._reduceExpressions) {
          if (expr.aggregate) {
            expr.aggregate();
          }
        }
      }
    }
  }

  // Table management

  addTable(table) {
    this._tables[table.name()] = table;
  }

  getTable(tableName) {
    if (!(tableName in this._tables)) {
      throw new Error(`Table "${tableName}" does not exist.`);
    }
    return this._tables[tableName];
  }

  // Graph operations

  addGraph(nodes, edges) {
    for (let i = 0; i < nodes.length; i++) {
      this.addNodeFromObject(nodes[i]);
    }
    for (let i = 0; i < edges.length; i++) {
      this.addRelationshipFromObject(edges[i]);
    }
  }

  addNodeFromObject(nodeData) {
    const n = new Node(this);
    if (nodeData.properties) n.setProperties(nodeData.properties);
    if (nodeData.labels) {
      for (const label of nodeData.labels) {
        n.setLabel(label, null);
      }
    }
    this.addNode(n, nodeData.id);
  }

  addRelationshipFromObject(relData) {
    const r = new Relationship(this);
    if (relData.from !== undefined) {
      r.setFromNode(this.getNodeById(relData.from));
    }
    if (relData.to !== undefined) {
      r.setToNode(this.getNodeById(relData.to));
    }
    if (relData.properties) r.setProperties(relData.properties);
    if (relData.type) r.setType(relData.type);
    this.addRelationship(r, relData.id);
  }
}

module.exports = { DB };
