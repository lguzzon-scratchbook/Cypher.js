const DataAdapter = require("./DataAdapter");

/**
 * @class InMemoryAdapter
 * @extends DataAdapter
 * @description In-memory graph storage with indexes for label/type lookups.
 */
class InMemoryAdapter extends DataAdapter {
	constructor() {
		super();
		this.nodes = new Map(); // id → {id, labels: Set, properties: Map}
		this.relationships = new Map(); // id → {id, type, fromNodeId, toNodeId, properties: Map}
		this.labelIndex = new Map(); // label → Set of nodeIds
		this.typeIndex = new Map(); // type → Set of relationshipIds
		this.adjacencyOut = new Map(); // nodeId → Map(toNodeId → [relIds])
		this.adjacencyIn = new Map(); // nodeId → [relIds]
		this.nextNodeId = 0;
		this.nextRelId = 0;
	}

	async connect(_config) {
		return Promise.resolve();
	}

	async disconnect() {
		return Promise.resolve();
	}

	async getNodeById(nodeId) {
		return Promise.resolve(this.nodes.get(nodeId) || null);
	}

	async getRelationshipById(relationshipId) {
		return Promise.resolve(this.relationships.get(relationshipId) || null);
	}

	async getNodesByLabel(label) {
		const nodeIds = this.labelIndex.get(label) || new Set();
		const nodes = Array.from(nodeIds).map((id) => this.nodes.get(id));
		return Promise.resolve(nodes.filter((n) => n));
	}

	async getNodesByProperty(key, value) {
		const nodes = Array.from(this.nodes.values()).filter(
			(n) => n.properties && n.properties.get(key) === value,
		);
		return Promise.resolve(nodes);
	}

	async getRelationshipsByType(type) {
		const relIds = this.typeIndex.get(type) || new Set();
		const rels = Array.from(relIds).map((id) => this.relationships.get(id));
		return Promise.resolve(rels.filter((r) => r));
	}

	async getRelationshipsBetween(fromNodeId, toNodeId) {
		const outMap = this.adjacencyOut.get(fromNodeId);
		if (!outMap) return Promise.resolve([]);
		const relIds = outMap.get(toNodeId) || [];
		const rels = relIds.map((id) => this.relationships.get(id));
		return Promise.resolve(rels.filter((r) => r));
	}

	async getOutgoingRelationships(nodeId) {
		const outMap = this.adjacencyOut.get(nodeId);
		if (!outMap) return Promise.resolve([]);
		const allRelIds = Array.from(outMap.values()).flat();
		const rels = allRelIds.map((id) => this.relationships.get(id));
		return Promise.resolve(rels.filter((r) => r));
	}

	async getIncomingRelationships(nodeId) {
		const relIds = this.adjacencyIn.get(nodeId) || [];
		const rels = relIds.map((id) => this.relationships.get(id));
		return Promise.resolve(rels.filter((r) => r));
	}

	async getAllNodes() {
		return Promise.resolve(Array.from(this.nodes.values()));
	}

	async getAllRelationships() {
		return Promise.resolve(Array.from(this.relationships.values()));
	}

	async createNode(graphNode) {
		const id = this.nextNodeId++;
		const node = {
			id,
			labels: new Set(graphNode.labels || []),
			properties: new Map(Object.entries(graphNode.properties || {})),
		};
		this.nodes.set(id, node);

		// Update label index
		for (const label of node.labels) {
			if (!this.labelIndex.has(label)) {
				this.labelIndex.set(label, new Set());
			}
			this.labelIndex.get(label).add(id);
		}

		return Promise.resolve({ ...node, labels: Array.from(node.labels) });
	}

	async createRelationship(graphRel) {
		const id = this.nextRelId++;
		const rel = {
			id,
			type: graphRel.type,
			fromNodeId: graphRel.fromNodeId,
			toNodeId: graphRel.toNodeId,
			properties: new Map(Object.entries(graphRel.properties || {})),
		};
		this.relationships.set(id, rel);

		// Update type index
		if (!this.typeIndex.has(rel.type)) {
			this.typeIndex.set(rel.type, new Set());
		}
		this.typeIndex.get(rel.type).add(id);

		// Update adjacency out
		if (!this.adjacencyOut.has(rel.fromNodeId)) {
			this.adjacencyOut.set(rel.fromNodeId, new Map());
		}
		const outMap = this.adjacencyOut.get(rel.fromNodeId);
		if (!outMap.has(rel.toNodeId)) {
			outMap.set(rel.toNodeId, []);
		}
		outMap.get(rel.toNodeId).push(id);

		// Update adjacency in
		if (!this.adjacencyIn.has(rel.toNodeId)) {
			this.adjacencyIn.set(rel.toNodeId, []);
		}
		this.adjacencyIn.get(rel.toNodeId).push(id);

		return Promise.resolve(rel);
	}

	async updateNodeProperties(nodeId, properties) {
		const node = this.nodes.get(nodeId);
		if (!node) throw new Error(`Node ${nodeId} not found`);
		Object.entries(properties).forEach(([k, v]) => {
			node.properties.set(k, v);
		});
		return Promise.resolve();
	}

	async updateRelationshipProperties(relationshipId, properties) {
		const rel = this.relationships.get(relationshipId);
		if (!rel) throw new Error(`Relationship ${relationshipId} not found`);
		Object.entries(properties).forEach(([k, v]) => {
			rel.properties.set(k, v);
		});
		return Promise.resolve();
	}

	async addNodeLabel(nodeId, label) {
		const node = this.nodes.get(nodeId);
		if (!node) throw new Error(`Node ${nodeId} not found`);
		node.labels.add(label);
		if (!this.labelIndex.has(label)) {
			this.labelIndex.set(label, new Set());
		}
		this.labelIndex.get(label).add(nodeId);
		return Promise.resolve();
	}

	async deleteNode(nodeId) {
		const node = this.nodes.get(nodeId);
		if (!node) throw new Error(`Node ${nodeId} not found`);

		// Delete all connected relationships
		const outRels = await this.getOutgoingRelationships(nodeId);
		const inRels = await this.getIncomingRelationships(nodeId);
		for (const rel of [...outRels, ...inRels]) {
			await this.deleteRelationship(rel.id);
		}

		// Remove from label index
		for (const label of node.labels) {
			const nodeIds = this.labelIndex.get(label);
			if (nodeIds) nodeIds.delete(nodeId);
		}

		this.nodes.delete(nodeId);
		return Promise.resolve();
	}

	async deleteRelationship(relationshipId) {
		const rel = this.relationships.get(relationshipId);
		if (!rel) throw new Error(`Relationship ${relationshipId} not found`);

		// Remove from type index
		const typeIds = this.typeIndex.get(rel.type);
		if (typeIds) typeIds.delete(relationshipId);

		// Remove from adjacency out
		const outMap = this.adjacencyOut.get(rel.fromNodeId);
		if (outMap) {
			const toList = outMap.get(rel.toNodeId);
			if (toList) {
				const idx = toList.indexOf(relationshipId);
				if (idx >= 0) toList.splice(idx, 1);
			}
		}

		// Remove from adjacency in
		const inList = this.adjacencyIn.get(rel.toNodeId);
		if (inList) {
			const idx = inList.indexOf(relationshipId);
			if (idx >= 0) inList.splice(idx, 1);
		}

		this.relationships.delete(relationshipId);
		return Promise.resolve();
	}

	async getNextNodeId() {
		return Promise.resolve(this.nextNodeId);
	}

	async getNextRelationshipId() {
		return Promise.resolve(this.nextRelId);
	}

	async clear() {
		this.nodes.clear();
		this.relationships.clear();
		this.labelIndex.clear();
		this.typeIndex.clear();
		this.adjacencyOut.clear();
		this.adjacencyIn.clear();
		this.nextNodeId = 0;
		this.nextRelId = 0;
		return Promise.resolve();
	}
}

module.exports = InMemoryAdapter;
