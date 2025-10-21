const { QueryEngine } = require('./core/QueryEngine.js');

// Simple test for debugging
const engine = new QueryEngine();

try {
    const result = engine.parse('match (n) return n');
    console.log('Simple match parse:', JSON.stringify(result, null, 2));
} catch (error) {
    console.error('Simple parse failed:', error.message);
}

try {
    const result = engine.parse('match (n:Node{ID:1}) return n');
    console.log('Node with properties parse:', JSON.stringify(result, null, 2));
} catch (error) {
    console.error('Node with properties failed:', error.message);
}

try {
    const result = engine.parse('load csv with headers from "https://example.com" as line return line');
    console.log('Load CSV parse:', JSON.stringify(result, null, 2));
} catch (error) {
    console.error('Load CSV failed:', error.message);
}
