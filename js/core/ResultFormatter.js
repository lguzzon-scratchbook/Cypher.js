/**
 * @class ResultFormatter
 * @description Formats query results into a standardized structure.
 */

class ResultFormatter {
	/**
	 * Format raw query results.
	 * @param {Object} rawResults - Results from Cypher engine
	 * @returns {Object} Formatted results
	 */
	static format(rawResults) {
		if (!rawResults) {
			return {
				output: [],
				graph: { nodes: [], links: [] },
				stats: { nodesAdded: 0, relationshipsAdded: 0 },
			};
		}

		return {
			output: ResultFormatter.#formatOutput(rawResults.output || []),
			graph: ResultFormatter.#formatGraph(rawResults.graph || {}),
			stats: {
				nodesAdded: rawResults.stats?.nodesAdded || 0,
				relationshipsAdded: rawResults.stats?.relationshipsAdded || 0,
			},
		};
	}

	/**
	 * Format output records.
	 * @private
	 * @param {Array} records - Raw records
	 * @returns {Array} Formatted records
	 */
	static #formatOutput(records) {
		return records.map((record) => {
			const formatted = {};
			for (const [key, value] of Object.entries(record)) {
				formatted[key] = ResultFormatter.#formatValue(value);
			}
			return formatted;
		});
	}

	/**
	 * Format graph nodes and relationships.
	 * @private
	 * @param {Object} graph - Raw graph
	 * @returns {Object} Formatted graph
	 */
	static #formatGraph(graph) {
		return {
			nodes: (graph.nodes || []).map((n) => ResultFormatter.#formatNode(n)),
			links: (graph.links || []).map((r) =>
				ResultFormatter.#formatRelationship(r),
			),
		};
	}

	/**
	 * Format a single value.
	 * @private
	 * @param {any} value - Value to format
	 * @returns {any} Formatted value
	 */
	static #formatValue(value) {
		if (value === null || value === undefined) {
			return null;
		}

		if (typeof value === "object") {
			if (Array.isArray(value)) {
				return value.map((v) => ResultFormatter.#formatValue(v));
			}

			if (value.constructor?.name === "Map") {
				return Object.fromEntries(value);
			}

			if (value.constructor?.name === "Set") {
				return Array.from(value);
			}

			if (value.id !== undefined) {
				// Node or Relationship reference
				return ResultFormatter.#formatReference(value);
			}

			return Object.fromEntries(
				Object.entries(value).map(([k, v]) => [
					k,
					ResultFormatter.#formatValue(v),
				]),
			);
		}

		return value;
	}

	/**
	 * Format a node reference.
	 * @private
	 * @param {Object} node - Node object
	 * @returns {Object} Formatted node
	 */
	static #formatNode(node) {
		if (!node) return null;

		return {
			id: node.id,
			labels: Array.isArray(node.labels)
				? node.labels
				: node.labels instanceof Set
					? Array.from(node.labels)
					: [],
			properties:
				node.properties instanceof Map
					? Object.fromEntries(node.properties)
					: node.properties || {},
		};
	}

	/**
	 * Format a relationship reference.
	 * @private
	 * @param {Object} rel - Relationship object
	 * @returns {Object} Formatted relationship
	 */
	static #formatRelationship(rel) {
		if (!rel) return null;

		return {
			id: rel.id,
			type: rel.type,
			source: rel.source !== undefined ? rel.source : rel.fromNodeId,
			target: rel.target !== undefined ? rel.target : rel.toNodeId,
			properties:
				rel.properties instanceof Map
					? Object.fromEntries(rel.properties)
					: rel.properties || {},
		};
	}

	/**
	 * Format a graph reference (node or relationship).
	 * @private
	 * @param {Object} ref - Reference object
	 * @returns {Object} Formatted reference
	 */
	static #formatReference(ref) {
		if (ref.type) {
			return ResultFormatter.#formatRelationship(ref);
		}

		return ResultFormatter.#formatNode(ref);
	}
}

module.exports = ResultFormatter;
