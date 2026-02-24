


/**
 * Graph is the container for nodes and relationships
 */
class Graph {
	constructor() {
		/** @type {Map<number, Node>} */
		this._nodes = new Map();
		/** @type {Map<number, Relationship>} */
		this._relationships = new Map();
		/** @type {Map<string, Set<number>>} */
		this._nodeIndex = new Map(); // label -> set of node IDs
	}

	/**
	 * Add a node to the graph
	 * @param {Node} node
	 * @returns {Node} The added node
	 */
	addNode(node) {
		if (!(node instanceof Node)) {
			node = Node.fromObject(node);
		}
		this._nodes.set(node.id, node);

		// Index by labels
		for (const label of node.labels) {
			if (!this._nodeIndex.has(label)) {
				this._nodeIndex.set(label, new Set());
			}
			this._nodeIndex.get(label).add(node.id);
		}

		return node;
	}

	/**
	 * Get a node by ID
	 * @param {number} id
	 * @returns {Node|undefined}
	 */
	getNode(id) {
		return this._nodes.get(id);
	}

	/**
	 * Get all nodes
	 * @returns {Node[]}
	 */
	getNodes() {
		return Array.from(this._nodes.values());
	}

	/**
	 * Get nodes by label
	 * @param {string} label
	 * @returns {Node[]}
	 */
	getNodesByLabel(label) {
		const ids = this._nodeIndex.get(label);
		if (!ids) return [];
		return Array.from(ids)
			.map((id) => this._nodes.get(id))
			.filter(Boolean);
	}

	/**
	 * Check if node exists
	 * @param {number} id
	 * @returns {boolean}
	 */
	hasNode(id) {
		return this._nodes.has(id);
	}

	/**
	 * Delete a node and its relationships
	 * @param {number} id
	 * @returns {boolean}
	 */
	deleteNode(id) {
		const node = this._nodes.get(id);
		if (!node) return false;

		// Remove from label index
		for (const label of node.labels) {
			const ids = this._nodeIndex.get(label);
			if (ids) {
				ids.delete(id);
				if (ids.size === 0) {
					this._nodeIndex.delete(label);
				}
			}
		}

		// Delete all relationships connected to this node
		for (const [relId, rel] of this._relationships) {
			if (rel.startNodeId === id || rel.endNodeId === id) {
				this._relationships.delete(relId);
			}
		}

		this._nodes.delete(id);
		return true;
	}

	/**
	 * Add a relationship to the graph
	 * @param {Relationship} relationship
	 * @returns {Relationship} The added relationship
	 */
	addRelationship(relationship) {
		if (!(relationship instanceof Relationship)) {
			relationship = Relationship.fromObject(relationship);
		}
		this._relationships.set(relationship.id, relationship);
		return relationship;
	}

	/**
	 * Get a relationship by ID
	 * @param {number} id
	 * @returns {Relationship|undefined}
	 */
	getRelationship(id) {
		return this._relationships.get(id);
	}

	/**
	 * Get all relationships
	 * @returns {Relationship[]}
	 */
	getRelationships() {
		return Array.from(this._relationships.values());
	}

	/**
	 * Get relationships from a node
	 * @param {number} nodeId
	 * @returns {Relationship[]}
	 */
	getRelationshipsFrom(nodeId) {
		return this.getRelationships().filter((r) => r.startNodeId === nodeId);
	}

	/**
	 * Get relationships to a node
	 * @param {number} nodeId
	 * @returns {Relationship[]}
	 */
	getRelationshipsTo(nodeId) {
		return this.getRelationships().filter((r) => r.endNodeId === nodeId);
	}

	/**
	 * Get relationships by type
	 * @param {string} type
	 * @returns {Relationship[]}
	 */
	getRelationshipsByType(type) {
		return this.getRelationships().filter((r) => r.type === type);
	}

	/**
	 * Check if relationship exists
	 * @param {number} id
	 * @returns {boolean}
	 */
	hasRelationship(id) {
		return this._relationships.has(id);
	}

	/**
	 * Delete a relationship
	 * @param {number} id
	 * @returns {boolean}
	 */
	deleteRelationship(id) {
		return this._relationships.delete(id);
	}

	/**
	 * Get node count
	 * @returns {number}
	 */
	get nodeCount() {
		return this._nodes.size;
	}

	/**
	 * Get relationship count
	 * @returns {number}
	 */
	get relationshipCount() {
		return this._relationships.size;
	}

	/**
	 * Clear the graph
	 */
	clear() {
		this._nodes.clear();
		this._relationships.clear();
		this._nodeIndex.clear();
	}

	/**
	 * Convert to plain object for serialization
	 * @returns {Object}
	 */
	toObject() {
		return {
			nodes: this.getNodes().map((n) => n.toObject()),
			relationships: this.getRelationships().map((r) => r.toObject()),
		};
	}

	/**
	 * Create Graph from plain object
	 * @param {Object} obj
	 * @returns {Graph}
	 */
	static fromObject(obj) {
		const graph = new Graph();
		for (const node of obj.nodes) {
			graph.addNode(Node.fromObject(node));
		}
		for (const rel of obj.relationships) {
			graph.addRelationship(Relationship.fromObject(rel));
		}
		return graph;
	}
}

module.exports = Graph;

module.exports.Graph = Graph;