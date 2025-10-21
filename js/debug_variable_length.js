const { QueryEngine } = require('./core/QueryEngine.js');

// Test variable length relationship pattern
const engine = new QueryEngine();

try {
    const result = engine.parse('match (a:Node{ID:1})-[r*]->(b) return size(r)');
    console.log('Variable length parse:', JSON.stringify(result, null, 2));
} catch (error) {
    console.error('Variable length failed:', error.message);
    console.log('Position during error:', engine.position);
    console.log('Remaining text:', engine.statementText.substring(engine.position));
}
