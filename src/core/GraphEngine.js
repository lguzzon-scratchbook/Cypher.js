import { Graph } from '../data/Graph.js';
import { Node } from '../data/Node.js';
import { Relationship } from '../data/Relationship.js';
import { IDFactory } from '../utils/IDFactory.js';
import { StringRecoder } from '../utils/StringRecoder.js';

/**
 * GraphEngine - Core graph operations
 * Manages nodes, relationships, and graph traversal
 */
export class GraphEngine {
	constructor() {
		this.graph = new Graph();
		this.nodeIdFactory = new IDFactory(0);
		this.relationshipIdFactory = new IDFactory(0);
		this.stringRecoder = new StringRecoder();
	}

	/**
	 * Create a new node
	 * @param {string[]} [labels=[]] - Node labels
	 * @param {Object} [properties={}] - Node properties
	 * @returns {Node}
	 */
	createNode(labels = [], properties = {}) {
		const id = this.nodeIdFactory.getId();
		const node = new Node(id, labels, properties);
		this.graph.addNode(node);
		return node;
	}

	/**
	 * Get a node by ID
	 * @param {number} id
	 * @returns {Node|undefined}
	 */
	getNode(id) {
		return this.graph.getNode(id);
	}

	/**
	 * Get all nodes
	 * @returns {Node[]}
	 */
	getNodes() {
		return this.graph.getNodes();
	}

	/**
	 * Get nodes by label
	 * @param {string} label
	 * @returns {Node[]}
	 */
	getNodesByLabel(label) {
		return this.graph.getNodesByLabel(label);
	}

	/**
	 * Delete a node
	 * @param {number} id
	 * @returns {boolean}
	 */
	deleteNode(id) {
		return this.graph.deleteNode(id);
	}

	/**
	 * Create a relationship
	 * @param {number} startNodeId - Start node ID
	 * @param {number} endNodeId - End node ID
	 * @param {string} type - Relationship type
	 * @param {Object} [properties={}] - Relationship properties
	 * @returns {Relationship|undefined}
	 */
	createRelationship(startNodeId, endNodeId, type, properties = {}) {
		const startNode = this.graph.getNode(startNodeId);
		const endNode = this.graph.getNode(endNodeId);

		if (!startNode || !endNode) {
			return undefined;
		}

		const id = this.relationshipIdFactory.getId();
		const relationship = new Relationship(
			id,
			type,
			startNodeId,
			endNodeId,
			properties
		);
		this.graph.addRelationship(relationship);
		return relationship;
	}

	/**
	 * Get a relationship by ID
	 * @param {number} id
	 * @returns {Relationship|undefined}
	 */
	getRelationship(id) {
		return this.graph.getRelationship(id);
	}

	/**
	 * Get all relationships
	 * @returns {Relationship[]}
	 */
	getRelationships() {
		return this.graph.getRelationships();
	}

	/**
	 * Get relationships from a node
	 * @param {number} nodeId
	 * @returns {Relationship[]}
	 */
	getRelationshipsFrom(nodeId) {
		return this.graph.getRelationshipsFrom(nodeId);
	}

	/**
	 * Get relationships to a node
	 * @param {number} nodeId
	 * @returns {Relationship[]}
	 */
	getRelationshipsTo(nodeId) {
		return this.graph.getRelationshipsTo(nodeId);
	}

	/**
	 * Delete a relationship
	 * @param {number} id
	 * @returns {boolean}
	 */
	deleteRelationship(id) {
		return this.graph.deleteRelationship(id);
	}

	/**
	 * Get node count
	 * @returns {number}
	 */
	get nodeCount() {
		return this.graph.nodeCount;
	}

	/**
	 * Get relationship count
	 * @returns {number}
	 */
	get relationshipCount() {
		return this.graph.relationshipCount;
	}

	/**
	 * Clear all data
	 */
	clear() {
		this.graph.clear();
		this.nodeIdFactory.reset(0);
		this.relationshipIdFactory.reset(0);
	}

	/**
	 * Get the underlying graph
	 * @returns {Graph}
	 */
	getGraph() {
		return this.graph;
	}

	/**
	 * Set the graph (for loading serialized data)
	 * @param {Graph} graph
	 */
	setGraph(graph) {
		this.graph = graph;
		// Recalculate ID factories based on existing data
		const nodes = graph.getNodes();
		const relationships = graph.getRelationships();

		if (nodes.length > 0) {
			const maxNodeId = Math.max(...nodes.map((n) => n.id));
			this.nodeIdFactory.reset(maxNodeId + 1);
		}

		if (relationships.length > 0) {
			const maxRelId = Math.max(...relationships.map((r) => r.id));
			this.relationshipIdFactory.reset(maxRelId + 1);
		}
	}
}

export default GraphEngine;
