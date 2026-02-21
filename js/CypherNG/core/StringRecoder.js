/**
 * StringRecoder - String interning using a Trie data structure
 * 
 * This class provides efficient string-to-integer mapping for memory optimization.
 * Commonly used for interning property keys, labels, and relationship types.
 * 
 * @example
 * const recoder = new StringRecoder();
 * const code1 = recoder.recode("username"); // Returns 1
 * const code2 = recoder.recode("username"); // Returns 1 (same code)
 */
class StringRecoder {
  constructor() {
    /** @private */
    this._root = this._createTrieNode();
    /** @private */
    this._codeFactory = 1;
    /** @private @const */
    this._CHARS = 0;
    /** @private @const */
    this._CODE = 1;
  }

  /**
   * Creates a new trie node
   * @private
   * @returns {Array} Trie node as [charMap, code]
   */
  _createTrieNode() {
    return [{}, null];
  }

  /**
   * Recodes a string value to an integer code
   * @param {*} _val - Value to recode (will be converted to string)
   * @returns {number|null} Integer code for the string, or null if input is falsy
   */
  recode(_val) {
    if (!_val) return _val;
    
    let val = _val;
    if (!val.charAt) {
      val = '' + _val;
    }

    let n = this._root;
    for (let i = 0; i < val.length; i++) {
      const char = val.charAt(i);
      if (!n[this._CHARS][char]) {
        n[this._CHARS][char] = this._createTrieNode();
      }
      n = n[this._CHARS][char];
    }
    
    return n[this._CODE] || (n[this._CODE] = this._codeFactory++);
  }

  /**
   * Resets the recoder, clearing all interned strings
   */
  reset() {
    this._root = this._createTrieNode();
    this._codeFactory = 1;
  }
}

module.exports = { StringRecoder };
