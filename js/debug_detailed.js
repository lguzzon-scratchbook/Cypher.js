const { QueryEngine } = require('./core/QueryEngine.js');

// Test with detailed debugging
const engine = new QueryEngine();

engine.statementText = 'load csv with headers from "https://example.com" as line return line';
engine.position = 27; // Position right before the URL (after 'from ')

console.log('Starting position:', engine.position);
console.log('Current char:', engine.currentChar());
console.log('Before parsing, token:', "'" + engine.token + "'");

engine.ignoreWhiteSpaceAndComments();
console.log('After ignoring whitespace, position:', engine.position);
console.log('Current char:', engine.currentChar());
console.log('Before parseExpression, token:', "'" + engine.token + "'");

try {
    const result = engine.parseExpression();
    console.log('Expression parsed:', JSON.stringify(result, null, 2));
    console.log('After parsing, position:', engine.position);
    console.log('Current char:', engine.currentChar());
    console.log('Token after parsing:', "'" + engine.token + "'");
} catch (error) {
    console.error('Parse failed:', error.message);
    console.log('Fail position:', engine.position);
    console.log('Fail char:', engine.currentChar());
    console.log('Fail token:', "'" + engine.token + "'");
}
