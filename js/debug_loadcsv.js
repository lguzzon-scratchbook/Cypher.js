const { QueryEngine } = require('./core/QueryEngine.js');

// Test LOAD CSV
const engine = new QueryEngine();

try {
    const result = engine.parse('load csv with headers from "https://example.com" as line return line');
    console.log('Load CSV parse:', JSON.stringify(result, null, 2));
} catch (error) {
    console.error('Load CSV failed:', error.message);
    console.log('Position during error:', engine.position);
    console.log('Remaining text:', engine.statementText.substring(engine.position));
}
