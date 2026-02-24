/**
 * StringRecoder - Trie-based string compression
 * Converts strings to unique integer codes for efficient storage
 */
class TrieNode {
	constructor() {
		/** @type {Object.<string, TrieNode>} */
		this.children = {};
		/** @type {number|null} */
		this.code = null;
	}
}

class StringRecoder {
	constructor() {
		this.root = new TrieNode();
		this.codeFactory = 1;
	}

	/**
	 * Recode a string to an integer
	 * @param {*} val - Value to recode
	 * @returns {number|string} - Integer code or original value
	 */
	recode(val) {
		if (val === null || val === undefined) {
			return val;
		}

		const str = String(val);
		if (str.length === 0) {
			return str;
		}

		let node = this.root;
		for (let i = 0; i < str.length; i++) {
			const char = str.charAt(i);
			if (!node.children[char]) {
				node.children[char] = new TrieNode();
			}
			node = node.children[char];
		}

		if (node.code === null) {
			node.code = this.codeFactory++;
		}

		return node.code;
	}

	/**
	 * Reset the recoder
	 */
	reset() {
		this.root = new TrieNode();
		this.codeFactory = 1;
	}
}

module.exports = StringRecoder;

module.exports.TrieNode = TrieNode;
module.exports.StringRecoder = StringRecoder;