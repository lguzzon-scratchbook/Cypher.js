/**
 * Node represents a vertex in the graph
 * @property {number} id - Unique identifier
 * @property {string[]} labels - Node labels (e.g., ['Person', 'Developer'])
 * @property {Object} properties - Key-value pairs
 */
class Node {
	/**
	 * @param {number} id - Unique identifier
	 * @param {string[]} [labels=[]] - Node labels
	 * @param {Object} [properties={}] - Node properties
	 */
	constructor(id, labels = [], properties = {}) {
		this.id = id;
		this.labels = labels;
		this.properties = properties;
	}

	/**
	 * Add a label to the node
	 * @param {string} label
	 */
	addLabel(label) {
		if (!this.labels.includes(label)) {
			this.labels.push(label);
		}
	}

	/**
	 * Check if node has a specific label
	 * @param {string} label
	 * @returns {boolean}
	 */
	hasLabel(label) {
		return this.labels.includes(label);
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
			labels: [...this.labels],
			properties: { ...this.properties },
		};
	}

	/**
	 * Create Node from plain object
	 * @param {Object} obj
	 * @returns {Node}
	 */
	static fromObject(obj) {
		return new Node(obj.id, obj.labels, obj.properties);
	}
}

module.exports = Node;

module.exports.Node = Node;