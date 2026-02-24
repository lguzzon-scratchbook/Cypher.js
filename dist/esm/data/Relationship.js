/**
 * Relationship represents an edge between two nodes in the graph
 * @property {number} id - Unique identifier
 * @property {string} type - Relationship type (e.g., 'KNOWS', 'WORKS_AT')
 * @property {number} startNodeId - ID of the start node
 * @property {number} endNodeId - ID of the end node
 * @property {Object} properties - Key-value pairs
 */
export class Relationship {
	/**
	 * @param {number} id - Unique identifier
	 * @param {string} type - Relationship type
	 * @param {number} startNodeId - Start node ID
	 * @param {number} endNodeId - End node ID
	 * @param {Object} [properties={}] - Relationship properties
	 */
	constructor(id, type, startNodeId, endNodeId, properties = {}) {
		this.id = id;
		this.type = type;
		this.startNodeId = startNodeId;
		this.endNodeId = endNodeId;
		this.properties = properties;
	}

	/**
	 * Get a property value
	 * @param {string} key
	 * @returns {*}
	 */
	get(key) {
		return this.properties[key];
	}

	/**
	 * Set a property value
	 * @param {string} key
	 * @param {*} value
	 */
	set(key, value) {
		this.properties[key] = value;
	}

	/**
	 * Convert to plain object
	 * @returns {Object}
	 */
	toObject() {
		return {
			id: this.id,
			type: this.type,
			startNodeId: this.startNodeId,
			endNodeId: this.endNodeId,
			properties: { ...this.properties },
		};
	}

	/**
	 * Create Relationship from plain object
	 * @param {Object} obj
	 * @returns {Relationship}
	 */
	static fromObject(obj) {
		return new Relationship(
			obj.id,
			obj.type,
			obj.startNodeId,
			obj.endNodeId,
			obj.properties
		);
	}
}

export default Relationship;
