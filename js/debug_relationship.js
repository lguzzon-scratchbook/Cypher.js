const { QueryEngine } = require('./core/QueryEngine.js');

// Test relationship parsing specifically
const engine = new QueryEngine();

// Test relationship parsing: -[r*]-
engine.statementText = '-[r*]->';
engine.position = 0;

console.log('Testing relationship pattern:');
console.log('Current char:', engine.currentChar());

try {
    const pattern = { relationships: [] };
    engine.parseRelationship(pattern);
    console.log('Relationship parsed:', JSON.stringify(pattern, null, 2));
} catch (error) {
    console.error('Relationship parsing failed:', error.message);
    console.log('Position:', engine.position);
    console.log('Char at position:', engine.currentChar());
}
