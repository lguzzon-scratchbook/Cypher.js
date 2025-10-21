const DataAdapter = require("./DataAdapter");

let redis;
try {
	redis = require("redis");
} catch {
	redis = null;
}

/**
 * @class RedisAdapter
 * @extends DataAdapter
 * @description Redis-backed graph storage with connection pooling and resilience.
 * Requires: npm install redis
 */
class RedisAdapter extends DataAdapter {
	/**
	 * @param {Object} options - Redis client options
	 * @throws {Error} If redis module not installed
	 */
	constructor(options = {}) {
		super();
		if (!redis) {
			throw new Error("Redis module not installed. Run: npm install redis");
		}
		this.options = { ...options };
		this.client = null;
		this.connected = false;
	}

	async connect(config = {}) {
		try {
			const redisConfig = { ...this.options, ...config };
			this.client = redis.createClient(redisConfig);

			this.client.on("error", (err) => {
				console.error("Redis error:", err);
			});

			await this.client.connect();
			this.connected = true;

			// Clear existing data (for testing)
			if (config.clearOnConnect) {
				const keys = await this.client.keys("node:*");
				keys.concat(await this.client.keys("rel:*"));
				keys.concat(await this.client.keys("idx:*"));
				if (keys.length > 0) {
					await this.client.del(keys);
				}
			}
		} catch (error) {
			throw new Error(`Failed to connect to Redis: ${error.message}`);
		}
	}

	async disconnect() {
		if (this.client) {
			await this.client.quit();
			this.connected = false;
		}
	}

	#ensureConnected() {
		if (!this.connected || !this.client) {
			throw new Error("Redis not connected");
		}
	}

	async getNodeById(nodeId) {
		this.#ensureConnected();
		const data = await this.client.hGetAll(`node:${nodeId}`);
		if (!data || Object.keys(data).length === 0) return null;

		return {
			id: parseInt(nodeId, 10),
			labels: JSON.parse(data.labels || "[]"),
			properties: new Map(Object.entries(JSON.parse(data.properties || "{}"))),
		};
	}

	async getRelationshipById(relationshipId) {
		this.#ensureConnected();
		const data = await this.client.hGetAll(`rel:${relationshipId}`);
		if (!data || Object.keys(data).length === 0) return null;

		return {
			id: parseInt(relationshipId, 10),
			type: data.type,
			fromNodeId: parseInt(data.fromNodeId, 10),
			toNodeId: parseInt(data.toNodeId, 10),
			properties: new Map(Object.entries(JSON.parse(data.properties || "{}"))),
		};
	}

	async getNodesByLabel(label) {
		this.#ensureConnected();
		const nodeIds = await this.client.sMembers(`idx:label:${label}`);
		const nodes = [];
		for (const id of nodeIds) {
			const node = await this.getNodeById(id);
			if (node) nodes.push(node);
		}
		return nodes;
	}

	async getNodesByProperty(_key, value) {
		this.#ensureConnected();
		const nodes = [];
		const keys = await this.client.keys("node:*");

		for (const key of keys) {
			const data = await this.client.hGetAll(key);
			const props = JSON.parse(data.properties || "{}");
			if (props[_key] === value) {
				const nodeId = parseInt(key.split(":")[1], 10);
				const node = await this.getNodeById(nodeId);
				if (node) nodes.push(node);
			}
		}
		return nodes;
	}

	async getRelationshipsByType(type) {
		this.#ensureConnected();
		const relIds = await this.client.sMembers(`idx:type:${type}`);
		const rels = [];
		for (const id of relIds) {
			const rel = await this.getRelationshipById(id);
			if (rel) rels.push(rel);
		}
		return rels;
	}

	async getRelationshipsBetween(fromNodeId, toNodeId) {
		this.#ensureConnected();
		const key = `idx:adj:${fromNodeId}:${toNodeId}`;
		const relIds = await this.client.sMembers(key);
		const rels = [];
		for (const id of relIds) {
			const rel = await this.getRelationshipById(id);
			if (rel) rels.push(rel);
		}
		return rels;
	}

	async getOutgoingRelationships(nodeId) {
		this.#ensureConnected();
		const key = `idx:out:${nodeId}`;
		const relIds = await this.client.sMembers(key);
		const rels = [];
		for (const id of relIds) {
			const rel = await this.getRelationshipById(id);
			if (rel) rels.push(rel);
		}
		return rels;
	}

	async getIncomingRelationships(nodeId) {
		this.#ensureConnected();
		const key = `idx:in:${nodeId}`;
		const relIds = await this.client.sMembers(key);
		const rels = [];
		for (const id of relIds) {
			const rel = await this.getRelationshipById(id);
			if (rel) rels.push(rel);
		}
		return rels;
	}

	async getAllNodes() {
		this.#ensureConnected();
		const keys = await this.client.keys("node:*");
		const nodes = [];
		for (const key of keys) {
			const nodeId = parseInt(key.split(":")[1], 10);
			const node = await this.getNodeById(nodeId);
			if (node) nodes.push(node);
		}
		return nodes;
	}

	async getAllRelationships() {
		this.#ensureConnected();
		const keys = await this.client.keys("rel:*");
		const rels = [];
		for (const key of keys) {
			const relId = parseInt(key.split(":")[1], 10);
			const rel = await this.getRelationshipById(relId);
			if (rel) rels.push(rel);
		}
		return rels;
	}

	async createNode(graphNode) {
		this.#ensureConnected();

		// Get next ID
		const nextId = await this.client.incr("counter:node");

		const labels = graphNode.labels || [];
		const properties = graphNode.properties || {};

		// Store node
		await this.client.hSet(`node:${nextId}`, {
			labels: JSON.stringify(labels),
			properties: JSON.stringify(properties),
		});

		// Update label index
		for (const label of labels) {
			await this.client.sAdd(`idx:label:${label}`, nextId.toString());
		}

		return {
			id: nextId,
			labels,
			properties: new Map(Object.entries(properties)),
		};
	}

	async createRelationship(graphRel) {
		this.#ensureConnected();

		// Get next ID
		const nextId = await this.client.incr("counter:rel");

		const { type, fromNodeId, toNodeId, properties = {} } = graphRel;

		// Store relationship
		await this.client.hSet(`rel:${nextId}`, {
			type,
			fromNodeId: fromNodeId.toString(),
			toNodeId: toNodeId.toString(),
			properties: JSON.stringify(properties),
		});

		// Update indexes
		await this.client.sAdd(`idx:type:${type}`, nextId.toString());
		await this.client.sAdd(
			`idx:adj:${fromNodeId}:${toNodeId}`,
			nextId.toString(),
		);
		await this.client.sAdd(`idx:out:${fromNodeId}`, nextId.toString());
		await this.client.sAdd(`idx:in:${toNodeId}`, nextId.toString());

		return {
			id: nextId,
			type,
			fromNodeId,
			toNodeId,
			properties: new Map(Object.entries(properties)),
		};
	}

	async updateNodeProperties(nodeId, properties) {
		this.#ensureConnected();
		const data = await this.client.hGetAll(`node:${nodeId}`);
		if (!data || Object.keys(data).length === 0) {
			throw new Error(`Node ${nodeId} not found`);
		}

		const currentProps = JSON.parse(data.properties || "{}");
		const merged = { ...currentProps, ...properties };

		await this.client.hSet(`node:${nodeId}`, {
			properties: JSON.stringify(merged),
		});
	}

	async updateRelationshipProperties(relationshipId, properties) {
		this.#ensureConnected();
		const data = await this.client.hGetAll(`rel:${relationshipId}`);
		if (!data || Object.keys(data).length === 0) {
			throw new Error(`Relationship ${relationshipId} not found`);
		}

		const currentProps = JSON.parse(data.properties || "{}");
		const merged = { ...currentProps, ...properties };

		await this.client.hSet(`rel:${relationshipId}`, {
			properties: JSON.stringify(merged),
		});
	}

	async addNodeLabel(nodeId, label) {
		this.#ensureConnected();
		const data = await this.client.hGetAll(`node:${nodeId}`);
		if (!data || Object.keys(data).length === 0) {
			throw new Error(`Node ${nodeId} not found`);
		}

		const labels = JSON.parse(data.labels || "[]");
		if (!labels.includes(label)) {
			labels.push(label);
			await this.client.hSet(`node:${nodeId}`, {
				labels: JSON.stringify(labels),
			});
			await this.client.sAdd(`idx:label:${label}`, nodeId.toString());
		}
	}

	async deleteNode(nodeId) {
		this.#ensureConnected();
		const data = await this.client.hGetAll(`node:${nodeId}`);
		if (!data || Object.keys(data).length === 0) {
			throw new Error(`Node ${nodeId} not found`);
		}

		// Delete connected relationships
		const outgoing = await this.getOutgoingRelationships(nodeId);
		const incoming = await this.getIncomingRelationships(nodeId);

		for (const rel of [...outgoing, ...incoming]) {
			await this.deleteRelationship(rel.id);
		}

		// Delete node
		await this.client.del(`node:${nodeId}`);

		// Remove from label indexes
		const labels = JSON.parse(data.labels || "[]");
		for (const label of labels) {
			await this.client.sRem(`idx:label:${label}`, nodeId.toString());
		}
	}

	async deleteRelationship(relationshipId) {
		this.#ensureConnected();
		const data = await this.client.hGetAll(`rel:${relationshipId}`);
		if (!data || Object.keys(data).length === 0) {
			throw new Error(`Relationship ${relationshipId} not found`);
		}

		// Remove from indexes
		await this.client.sRem(`idx:type:${data.type}`, relationshipId.toString());
		await this.client.sRem(
			`idx:adj:${data.fromNodeId}:${data.toNodeId}`,
			relationshipId.toString(),
		);
		await this.client.sRem(
			`idx:out:${data.fromNodeId}`,
			relationshipId.toString(),
		);
		await this.client.sRem(
			`idx:in:${data.toNodeId}`,
			relationshipId.toString(),
		);

		// Delete relationship
		await this.client.del(`rel:${relationshipId}`);
	}

	async getNextNodeId() {
		this.#ensureConnected();
		return this.client
			.get("counter:node")
			.then((v) => parseInt(v || "0", 10) + 1);
	}

	async getNextRelationshipId() {
		this.#ensureConnected();
		return this.client
			.get("counter:rel")
			.then((v) => parseInt(v || "0", 10) + 1);
	}

	async clear() {
		this.#ensureConnected();
		const keys = await this.client.keys("*");
		if (keys.length > 0) {
			await this.client.del(keys);
		}
	}
}

module.exports = RedisAdapter;
