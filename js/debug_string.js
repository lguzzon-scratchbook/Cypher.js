const { QueryEngine } = require('./core/QueryEngine.js');

// Test string parsing
const engine = new QueryEngine();

// Save original position and text for testing
engine.statementText = 'from "https://raw.githubusercontent.com..."';
engine.position = 5; // Start at the quote
engine.token = '';

console.log('Current char:', engine.currentChar());
console.log('Is string literal?', engine.checkStringLiteral());

try {
    const result = engine.parseStringLiteral();
    console.log('Parsed string:', result);
} catch (error) {
    console.error('String parse failed:', error.message);
    console.log('Position:', engine.position);
    console.log('Char at position:', engine.currentChar());
}
