const DataAdapter = require("./DataAdapter");
const fs = require("node:fs").promises;
const path = require("node:path");
const os = require("node:os");

/**
 * @class FilesystemAdapter
 * @extends DataAdapter
 * @description Persistent graph storage using JSON files with atomic writes.
 */
class FilesystemAdapter extends DataAdapter {
	/**
	 * @param {string} dataDir - Directory for data files (default: ./cypher-data)
	 */
	constructor(dataDir = "./cypher-data") {
		super();
		this.dataDir = dataDir;
		this.nodesFile = path.join(dataDir, "nodes.json");
		this.relsFile = path.join(dataDir, "relationships.json");
		this.nodes = new Map();
		this.relationships = new Map();
		this.labelIndex = new Map();
		this.typeIndex = new Map();
		this.adjacencyOut = new Map();
		this.adjacencyIn = new Map();
		this.nextNodeId = 0;
		this.nextRelId = 0;
	}

	async connect(_config) {
		try {
			await fs.mkdir(this.dataDir, { recursive: true });
			await this.#loadFromDisk();
		} catch (error) {
			throw new Error(`Failed to connect: ${error.message}`);
		}
	}

	async disconnect() {
		try {
			await this.#saveToDisk();
		} catch (error) {
			throw new Error(`Failed to disconnect: ${error.message}`);
		}
	}

	async #loadFromDisk() {
		try {
			const nodeData = await this.#readFileIfExists(this.nodesFile);
			const relData = await this.#readFileIfExists(this.relsFile);

			if (nodeData) {
				const parsed = JSON.parse(nodeData);
				for (const node of parsed) {
					this.nodes.set(node.id, {
						...node,
						labels: new Set(node.labels),
						properties: new Map(Object.entries(node.properties || {})),
					});
					this.nextNodeId = Math.max(this.nextNodeId, node.id + 1);
					for (const label of node.labels) {
						if (!this.labelIndex.has(label)) {
							this.labelIndex.set(label, new Set());
						}
						this.labelIndex.get(label).add(node.id);
					}
				}
			}

			if (relData) {
				const parsed = JSON.parse(relData);
				for (const rel of parsed) {
					this.relationships.set(rel.id, {
						...rel,
						properties: new Map(Object.entries(rel.properties || {})),
					});
					this.nextRelId = Math.max(this.nextRelId, rel.id + 1);

					if (!this.typeIndex.has(rel.type)) {
						this.typeIndex.set(rel.type, new Set());
					}
					this.typeIndex.get(rel.type).add(rel.id);

					if (!this.adjacencyOut.has(rel.fromNodeId)) {
						this.adjacencyOut.set(rel.fromNodeId, new Map());
					}
					const outMap = this.adjacencyOut.get(rel.fromNodeId);
					if (!outMap.has(rel.toNodeId)) {
						outMap.set(rel.toNodeId, []);
					}
					outMap.get(rel.toNodeId).push(rel.id);

					if (!this.adjacencyIn.has(rel.toNodeId)) {
						this.adjacencyIn.set(rel.toNodeId, []);
					}
					this.adjacencyIn.get(rel.toNodeId).push(rel.id);
				}
			}
		} catch (error) {
			throw new Error(`Failed to load from disk: ${error.message}`);
		}
	}

	async #saveToDisk() {
		try {
			const nodeData = Array.from(this.nodes.values()).map((n) => ({
				id: n.id,
				labels: Array.from(n.labels),
				properties: Object.fromEntries(n.properties),
			}));

			const relData = Array.from(this.relationships.values()).map((r) => ({
				id: r.id,
				type: r.type,
				fromNodeId: r.fromNodeId,
				toNodeId: r.toNodeId,
				properties: Object.fromEntries(r.properties),
			}));

			await this.#writeFileAtomic(
				this.nodesFile,
				JSON.stringify(nodeData, null, 2),
			);
			await this.#writeFileAtomic(
				this.relsFile,
				JSON.stringify(relData, null, 2),
			);
		} catch (error) {
			throw new Error(`Failed to save to disk: ${error.message}`);
		}
	}

	async #writeFileAtomic(filePath, data) {
		const tempPath = path.join(os.tmpdir(), `${path.basename(filePath)}.tmp`);
		await fs.writeFile(tempPath, data, "utf-8");
		await fs.rename(tempPath, filePath);
	}

	async #readFileIfExists(filePath) {
		try {
			return await fs.readFile(filePath, "utf-8");
		} catch {
			return null;
		}
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

		for (const label of node.labels) {
			if (!this.labelIndex.has(label)) {
				this.labelIndex.set(label, new Set());
			}
			this.labelIndex.get(label).add(id);
		}

		await this.#saveToDisk();
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

		if (!this.typeIndex.has(rel.type)) {
			this.typeIndex.set(rel.type, new Set());
		}
		this.typeIndex.get(rel.type).add(id);

		if (!this.adjacencyOut.has(rel.fromNodeId)) {
			this.adjacencyOut.set(rel.fromNodeId, new Map());
		}
		const outMap = this.adjacencyOut.get(rel.fromNodeId);
		if (!outMap.has(rel.toNodeId)) {
			outMap.set(rel.toNodeId, []);
		}
		outMap.get(rel.toNodeId).push(id);

		if (!this.adjacencyIn.has(rel.toNodeId)) {
			this.adjacencyIn.set(rel.toNodeId, []);
		}
		this.adjacencyIn.get(rel.toNodeId).push(id);

		await this.#saveToDisk();
		return Promise.resolve(rel);
	}

	async updateNodeProperties(nodeId, properties) {
		const node = this.nodes.get(nodeId);
		if (!node) throw new Error(`Node ${nodeId} not found`);
		Object.entries(properties).forEach(([k, v]) => {
			node.properties.set(k, v);
		});
		await this.#saveToDisk();
		return Promise.resolve();
	}

	async updateRelationshipProperties(relationshipId, properties) {
		const rel = this.relationships.get(relationshipId);
		if (!rel) throw new Error(`Relationship ${relationshipId} not found`);
		Object.entries(properties).forEach(([k, v]) => {
			rel.properties.set(k, v);
		});
		await this.#saveToDisk();
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
		await this.#saveToDisk();
		return Promise.resolve();
	}

	async deleteNode(nodeId) {
		const node = this.nodes.get(nodeId);
		if (!node) throw new Error(`Node ${nodeId} not found`);

		const outRels = await this.getOutgoingRelationships(nodeId);
		const inRels = await this.getIncomingRelationships(nodeId);
		for (const rel of [...outRels, ...inRels]) {
			await this.deleteRelationship(rel.id);
		}

		for (const label of node.labels) {
			const nodeIds = this.labelIndex.get(label);
			if (nodeIds) nodeIds.delete(nodeId);
		}

		this.nodes.delete(nodeId);
		await this.#saveToDisk();
		return Promise.resolve();
	}

	async deleteRelationship(relationshipId) {
		const rel = this.relationships.get(relationshipId);
		if (!rel) throw new Error(`Relationship ${relationshipId} not found`);

		const typeIds = this.typeIndex.get(rel.type);
		if (typeIds) typeIds.delete(relationshipId);

		const outMap = this.adjacencyOut.get(rel.fromNodeId);
		if (outMap) {
			const toList = outMap.get(rel.toNodeId);
			if (toList) {
				const idx = toList.indexOf(relationshipId);
				if (idx >= 0) toList.splice(idx, 1);
			}
		}

		const inList = this.adjacencyIn.get(rel.toNodeId);
		if (inList) {
			const idx = inList.indexOf(relationshipId);
			if (idx >= 0) inList.splice(idx, 1);
		}

		this.relationships.delete(relationshipId);
		await this.#saveToDisk();
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
		await this.#saveToDisk();
		return Promise.resolve();
	}
}

module.exports = FilesystemAdapter;
