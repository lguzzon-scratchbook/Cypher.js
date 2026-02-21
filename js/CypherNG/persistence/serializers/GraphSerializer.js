/**
 * GraphSerializer - Abstract base class for graph serialization
 * 
 * This is an extension point for future serialization implementations.
 * Concrete implementations could include:
 * - JSONSerializer (JSON format)
 * - GraphMLSerializer (GraphML XML format)
 * - BinarySerializer (compact binary format)
 * 
 * @abstract
 */
class GraphSerializer {
  constructor(options = {}) {
    /** @protected */
    this._options = options;
  }

  /**
   * Serialize graph data to string/binary format
   * @abstract
   * @param {Object} data - Graph data
   * @param {Array} data.nodes - Array of node objects
   * @param {Array} data.relationships - Array of relationship objects
   * @returns {string|Buffer} Serialized data
   */
  serialize(data) {
    throw new Error('GraphSerializer.serialize() must be implemented by subclass');
  }

  /**
   * Deserialize string/binary format to graph data
   * @abstract
   * @param {string|Buffer} data - Serialized data
   * @returns {Object} Graph data with nodes and relationships
   */
  deserialize(data) {
    throw new Error('GraphSerializer.deserialize() must be implemented by subclass');
  }

  /**
   * Get the content type for this serializer
   * @abstract
   * @returns {string} MIME type
   */
  getContentType() {
    throw new Error('GraphSerializer.getContentType() must be implemented by subclass');
  }

  /**
   * Get file extension for this serializer
   * @abstract
   * @returns {string} File extension (e.g., '.json')
   */
  getFileExtension() {
    throw new Error('GraphSerializer.getFileExtension() must be implemented by subclass');
  }

  /**
   * Get serializer name
   * @returns {string}
   */
  getName() {
    return this.constructor.name;
  }
}

module.exports = { GraphSerializer };
