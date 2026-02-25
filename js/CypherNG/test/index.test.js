/**
 * Test suite for CypherNG
 * Main entry point for running all tests
 */

// Import all test files
import './Node.test.js';
import './Relationship.test.js';
import './Database.test.js';
import './Utilities.test.js';
import './Statement.test.js';

// Re-export for convenience
export {};

// Note: Query operation tests (Match, Create, Merge, Delete, Return, etc.)
// require more complex setup and are currently covered through integration tests