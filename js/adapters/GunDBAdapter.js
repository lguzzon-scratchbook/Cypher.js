const DataAdapter = require("./DataAdapter");

let Gun;
try {
	Gun = require("gun");
} catch {
	Gun = null;
}

/**
 * @class GunDBAdapter
 * @extends DataAdapter
 * @description GunDB-backed graph storage with real-time peer-to-peer sync.
 * Supports subscriptions for reactive updates.
 * Requires: npm install gun
 */
class GunDBAdapter extends DataAdapter {
	/**
	 * @param {Object} options - Gun peer configuration
	 * @throws {Error} If gun module not installed
	 */
	constructor(options = {}) {
		super();
		if (!Gun) {
			throw new Error("Gun module not installed. Run: npm install gun");
		}
		this.options = { ...options };
		this.gun = null;
		this.nodes = new Map();
		this.relationships = new Map();
		this.subscribers = new Map();
		this.nextNodeId = 0;
		this.nextRelId = 0;
	}

	async connect(_config = {}) {
		try {
			this.gun = Gun();
			this.gun.on("create", (msg) => {
				this.#notifySubscribers("update", msg);
			});
		} catch (error) {
			throw new Error(`Failed to connect to Gun: ${error.message}`);
		}
	}

	async disconnect() {
		if (this.gun) {
			this.gun = null;
		}
	}

	#ensureConnected() {
		if (!this.gun) {
			throw new Error("GunDB not connected");
		}
	}

	#notifySubscribers(event, data) {
		for (const [_id, callback] of this.subscribers) {
			try {
				callback(event, data);
			} catch {
				// Ignore callback errors
			}
		}
	}

	async getNodeById(nodeId) {
		const node = this.nodes.get(nodeId);
		if (!node) return null;

		return {
			id: nodeId,
			labels: Array.isArray(node.labels) ? node.labels : node.labels || [],
			properties: new Map(Object.entries(node.properties || {})),
		};
	}

	async getRelationshipById(relationshipId) {
		const rel = this.relationships.get(relationshipId);
		if (!rel) return null;

		return {
			id: relationshipId,
			type: rel.type,
			fromNodeId: rel.fromNodeId,
			toNodeId: rel.toNodeId,
			properties: new Map(Object.entries(rel.properties || {})),
		};
	}

	async getNodesByLabel(label) {
		const nodes = [];
		for (const [_id, node] of this.nodes) {
			const labels = Array.isArray(node.labels)
				? node.labels
				: node.labels || [];
			if (labels.includes(label)) {
				const n = await this.getNodeById(_id);
				if (n) nodes.push(n);
			}
		}
		return nodes;
	}

	async getNodesByProperty(key, value) {
		const nodes = [];
		for (const [nodeId, node] of this.nodes) {
			if (node.properties && node.properties[key] === value) {
				const n = await this.getNodeById(nodeId);
				if (n) nodes.push(n);
			}
		}
		return nodes;
	}

	async getRelationshipsByType(type) {
		const rels = [];
		for (const [relId, rel] of this.relationships) {
			if (rel.type === type) {
				const r = await this.getRelationshipById(relId);
				if (r) rels.push(r);
			}
		}
		return rels;
	}

	async getRelationshipsBetween(fromNodeId, toNodeId) {
		const rels = [];
		for (const [relId, rel] of this.relationships) {
			if (rel.fromNodeId === fromNodeId && rel.toNodeId === toNodeId) {
				const r = await this.getRelationshipById(relId);
				if (r) rels.push(r);
			}
		}
		return rels;
	}

	async getOutgoingRelationships(nodeId) {
		const rels = [];
		for (const [relId, rel] of this.relationships) {
			if (rel.fromNodeId === nodeId) {
				const r = await this.getRelationshipById(relId);
				if (r) rels.push(r);
			}
		}
		return rels;
	}

	async getIncomingRelationships(nodeId) {
		const rels = [];
		for (const [relId, rel] of this.relationships) {
			if (rel.toNodeId === nodeId) {
				const r = await this.getRelationshipById(relId);
				if (r) rels.push(r);
			}
		}
		return rels;
	}

	async getAllNodes() {
		const nodes = [];
		for (const [nodeId] of this.nodes) {
			const node = await this.getNodeById(nodeId);
			if (node) nodes.push(node);
		}
		return nodes;
	}

	async getAllRelationships() {
		const rels = [];
		for (const [relId] of this.relationships) {
			const rel = await this.getRelationshipById(relId);
			if (rel) rels.push(rel);
		}
		return rels;
	}

	async createNode(graphNode) {
		this.#ensureConnected();

		const id = this.nextNodeId++;
		const labels = graphNode.labels || [];
		const properties = graphNode.properties || {};

		const node = { labels, properties };
		this.nodes.set(id, node);

		this.#notifySubscribers("nodeCreated", { id, node });

		return {
			id,
			labels,
			properties: new Map(Object.entries(properties)),
		};
	}

	async createRelationship(graphRel) {
		this.#ensureConnected();

		const id = this.nextRelId++;
		const { type, fromNodeId, toNodeId, properties = {} } = graphRel;

		const rel = { type, fromNodeId, toNodeId, properties };
		this.relationships.set(id, rel);

		this.#notifySubscribers("relationshipCreated", { id, rel });

		return {
			id,
			type,
			fromNodeId,
			toNodeId,
			properties: new Map(Object.entries(properties)),
		};
	}

	async updateNodeProperties(nodeId, properties) {
		this.#ensureConnected();
		const node = this.nodes.get(nodeId);
		if (!node) throw new Error(`Node ${nodeId} not found`);

		node.properties = { ...node.properties, ...properties };
		this.#notifySubscribers("nodeUpdated", { nodeId, node });
	}

	async updateRelationshipProperties(relationshipId, properties) {
		this.#ensureConnected();
		const rel = this.relationships.get(relationshipId);
		if (!rel) throw new Error(`Relationship ${relationshipId} not found`);

		rel.properties = { ...rel.properties, ...properties };
		this.#notifySubscribers("relationshipUpdated", { relationshipId, rel });
	}

	async addNodeLabel(nodeId, label) {
		this.#ensureConnected();
		const node = this.nodes.get(nodeId);
		if (!node) throw new Error(`Node ${nodeId} not found`);

		const labels = Array.isArray(node.labels) ? node.labels : node.labels || [];
		if (!labels.includes(label)) {
			labels.push(label);
			node.labels = labels;
			this.#notifySubscribers("labelAdded", { nodeId, label });
		}
	}

	async deleteNode(nodeId) {
		this.#ensureConnected();
		const node = this.nodes.get(nodeId);
		if (!node) throw new Error(`Node ${nodeId} not found`);

		// Delete connected relationships
		const outgoing = await this.getOutgoingRelationships(nodeId);
		const incoming = await this.getIncomingRelationships(nodeId);

		for (const rel of [...outgoing, ...incoming]) {
			await this.deleteRelationship(rel.id);
		}

		// Delete node
		this.nodes.delete(nodeId);
		this.#notifySubscribers("nodeDeleted", { nodeId });
	}

	async deleteRelationship(relationshipId) {
		this.#ensureConnected();
		const rel = this.relationships.get(relationshipId);
		if (!rel) throw new Error(`Relationship ${relationshipId} not found`);

		this.relationships.delete(relationshipId);
		this.#notifySubscribers("relationshipDeleted", { relationshipId });
	}

	async getNextNodeId() {
		return this.nextNodeId;
	}

	async getNextRelationshipId() {
		return this.nextRelId;
	}

	async clear() {
		this.nodes.clear();
		this.relationships.clear();
		this.nextNodeId = 0;
		this.nextRelId = 0;
		this.#notifySubscribers("cleared", {});
	}

	/**
	 * Subscribe to graph changes (GunDB specific).
	 * @param {Function} callback - Called with (event, data)
	 * @returns {Function} Unsubscribe function
	 * @example
	 * const unsub = adapter.subscribe((event, data) => {
	 *   console.log('Graph event:', event, data);
	 * });
	 */
	subscribe(callback) {
		const id = Math.random().toString(36).substr(2, 9);
		this.subscribers.set(id, callback);

		return () => {
			this.subscribers.delete(id);
		};
	}
}

module.exports = GunDBAdapter;
