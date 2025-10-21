const { QueryEngine } = require('./core/QueryEngine.js');

// Test just the bracket parsing
const engine = new QueryEngine();

// Test bracket parsing: [r*]
engine.statementText = '[r*]';
engine.position = 0;

console.log('Testing bracket parsing:');
console.log('Current char:', engine.currentChar());

try {
    engine.expectChar('[');
    console.log('After [, position:', engine.position, 'char:', engine.currentChar());
    
    const relationship = {};
    
    // Parse variable name
    if (engine.peekVariableName()) {
        relationship.variable = engine.getToken();
        console.log('Got variable:', relationship.variable);
        engine.advanceToken();
    }
    
    console.log('After variable, position:', engine.position, 'char:', engine.currentChar());
    
    // Check for variable length after variable name
    if (engine.checkChar('*')) {
        console.log('Found * indicator');
        engine.expectChar('*');
        relationship.variableLength = 'unbounded';
    }
    
    engine.expectChar(']');
    
    console.log('Successfully parsed bracket content:', relationship);
    
} catch (error) {
    console.error('Bracket parsing failed:', error.message);
    console.log('Position:', engine.position);
    console.log('Char at position:', engine.currentChar());
    console.log('Token:', "'" + engine.token + "'");
}
