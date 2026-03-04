/**
 * @fileoverview Basic tests for CypherNG structures module.
 * Simple Node.js test runner for data structures.
 */

// Load structures
var structures = require('./index.js');
var assert = require('assert');

var testsPassed = 0;
var testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('[PASS] ' + name);
        testsPassed++;
    } catch (e) {
        console.log('[FAIL] ' + name + ': ' + e);
        testsFailed++;
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || ('Expected ' + expected + ' but got ' + actual));
    }
}

console.log('=== CypherNG Structures Tests ===\n');

// Test Constant
console.log('--- Constant Tests ---');
test('Constant wraps value', function() {
    var c = new structures.Constant(42);
    assertEqual(c.value(), 42, 'Constant should return wrapped value');
});

test('Constant getObject returns value', function() {
    var c = new structures.Constant({ x: 1 });
    assertEqual(c.getObject().x, 1, 'Constant getObject should return value');
});

test('Constant setValue changes value', function() {
    var c = new structures.Constant(10);
    c.setValue(20);
    assertEqual(c.value(), 20, 'Constant setValue should change value');
});

// Test AssociativeArray
console.log('\n--- AssociativeArray Tests ---');
test('AssociativeArray addEntry and get', function() {
    var aa = new structures.AssociativeArray();
    aa.addEntry('key1', new structures.Constant('value1'));
    aa.addEntry('key2', new structures.Constant('value2'));
    var result = aa.get(false);
    assertEqual(result.key1, 'value1', 'Should get value1');
    assertEqual(result.key2, 'value2', 'Should get value2');
});

test('AssociativeArray getProperties returns keys', function() {
    var aa = new structures.AssociativeArray();
    aa.addEntry('a', new structures.Constant(1));
    aa.addEntry('b', new structures.Constant(2));
    var props = aa.getProperties();
    assertEqual(props.length, 2, 'Should have 2 keys');
});

test('AssociativeArray duplicate key throws error', function() {
    var aa = new structures.AssociativeArray();
    aa.addEntry('key1', new structures.Constant('value1'));
    var threw = false;
    try {
        aa.addEntry('key1', new structures.Constant('value2'));
    } catch (e) {
        threw = true;
    }
    assertEqual(threw, true, 'Should throw on duplicate key');
});

// Test List
console.log('\n--- List Tests ---');
test('List add and get', function() {
    var list = new structures.List();
    list.add(new structures.Constant(1));
    list.add(new structures.Constant(2));
    list.add(new structures.Constant(3));
    var result = list.get();
    assertEqual(result.length, 3, 'List should have 3 elements');
    assertEqual(result[0], 1, 'First element should be 1');
    assertEqual(result[2], 3, 'Third element should be 3');
});

test('List with initial array', function() {
    var list = new structures.List([1, 2, 3]);
    var result = list.get();
    assertEqual(result.length, 3, 'List should have 3 elements');
});

// Test Case
console.log('\n--- Case Tests ---');
test('Case when/then evaluation', function() {
    var caseExpr = new structures.Case();
    caseExpr.when(new structures.Constant(true));
    caseExpr.then(new structures.Constant('first'));
    caseExpr.when(new structures.Constant(false));
    caseExpr.then(new structures.Constant('second'));
    caseExpr.else(new structures.Constant('default'));
    var result = caseExpr.value();
    assertEqual(result, 'first', 'Should return first matching then');
});

test('Case falls through to else', function() {
    var caseExpr = new structures.Case();
    caseExpr.when(new structures.Constant(false));
    caseExpr.then(new structures.Constant('first'));
    caseExpr.else(new structures.Constant('default'));
    var result = caseExpr.value();
    assertEqual(result, 'default', 'Should return else value');
});

// Test FString
console.log('\n--- FString Tests ---');
test('FString combines strings and expressions', function() {
    var fstr = new structures.FString();
    fstr.string('Hello, ');
    fstr.expression(new structures.Constant('World'));
    fstr.string('!');
    var result = fstr.value();
    assertEqual(result, 'Hello, World!', 'Should combine parts correctly');
});

test('FString with multiple expressions', function() {
    var fstr = new structures.FString();
    fstr.expression(new structures.Constant(1));
    fstr.string(' + ');
    fstr.expression(new structures.Constant(2));
    fstr.string(' = ');
    fstr.expression(new structures.Constant(3));
    var result = fstr.value();
    assertEqual(result, '1 + 2 = 3', 'Should combine multiple expressions');
});

// Test LinkedList
console.log('\n--- LinkedList Tests ---');
test('LinkedList add and size', function() {
    var ll = new structures.LinkedList();
    ll.add(1);
    ll.add(2);
    ll.add(3);
    assertEqual(ll.size(), 3, 'Size should be 3');
});

test('LinkedList toArray', function() {
    var ll = new structures.LinkedList();
    ll.add('a');
    ll.add('b');
    ll.add('c');
    var arr = ll.toArray();
    assertEqual(arr.length, 3, 'Array should have 3 elements');
    assertEqual(arr[0], 'a', 'First element should be a');
    assertEqual(arr[2], 'c', 'Last element should be c');
});

test('LinkedList removeLast', function() {
    var ll = new structures.LinkedList();
    ll.add(1);
    ll.add(2);
    ll.add(3);
    ll.removeLast();
    assertEqual(ll.size(), 2, 'Size should be 2 after removeLast');
});

// Test Table and TableColumn
console.log('\n--- Table Tests ---');
test('Table addColumn and addValue', function() {
    var mockDb = {
        addTable: function(t) {}
    };
    var table = new structures.Table(mockDb, 'test_table');
    table.addColumn('col1');
    table.addColumn('col2');
    table.addValue('col1', 'a');
    table.addValue('col1', 'a');
    table.addValue('col1', 'b');
    var col = table.getColumn('col1');
    assertEqual(col.name(), 'col1', 'Column name should be col1');
});

test('TableColumn run-length encoding', function() {
    var mockDb = { addTable: function(t) {} };
    var table = new structures.Table(mockDb, 'test');
    var col = table.addColumn('rle_col');
    col.addValue('X');
    col.addValue('X');
    col.addValue('X');
    col.addValue('Y');
    col.addValue('Y');
    col.reset();
    var values = [];
    for (var i = 0; i < 5; i++) {
        values.push(col.value());
    }
    assertEqual(values[0], 'X', 'First value should be X');
    assertEqual(values[2], 'X', 'Third value should be X');
    assertEqual(values[3], 'Y', 'Fourth value should be Y');
});

// Test utils
console.log('\n--- Utils Tests ---');
test('StringRecoder returns same code for same string', function() {
    var sr = new structures.StringRecoder();
    var code1 = sr.recode('hello');
    var code2 = sr.recode('hello');
    assertEqual(code1, code2, 'Same string should get same code');
});

test('StringRecoder returns different codes for different strings', function() {
    var sr = new structures.StringRecoder();
    var code1 = sr.recode('hello');
    var code2 = sr.recode('world');
    // Note: codes are sequential, so they should be different
    assertEqual(code1 !== code2, true, 'Different strings should get different codes');
});

test('IDFactory generates sequential IDs', function() {
    var idf = new structures.IDFactory();
    var id1 = idf.getId();
    var id2 = idf.getId();
    var id3 = idf.getId();
    assertEqual(id1, -1, 'First ID should be -1');
    assertEqual(id2, 0, 'Second ID should be 0');
    assertEqual(id3, 1, 'Third ID should be 1');
});

test('addArrayFunctions adds helper methods', function() {
    var arr = structures.addArrayFunctions([1, 2, 3, 4, 5]);
    assertEqual(arr.contains(3), true, 'Should contain 3');
    assertEqual(arr.contains(10), false, 'Should not contain 10');
    assertEqual(arr.last(), 5, 'Last should be 5');
    assertEqual(arr.beforeLast(), 4, 'Before last should be 4');
});

test('addAssociativeArrayFunctions adds helper methods', function() {
    var obj = structures.addAssociativeArrayFunctions({ a: 1, b: 2 });
    assertEqual(obj.getProperty('a'), 1, 'getProperty should return value');
    assertEqual(obj.getKeys().length, 2, 'Should have 2 keys');
});

test('clean removes functions and handles special cases', function() {
    var obj = {
        a: 1,
        b: function() { return 2; },
        c: { d: 'test\0with\0nulls' }
    };
    var cleaned = structures.clean(obj);
    assertEqual(cleaned.b, undefined, 'Function should be removed');
    assertEqual(cleaned.c.d, 'testwithnulls', 'Null chars should be removed');
});

// Test Predicate (requires Variable from query module)
console.log('\n--- Predicate Tests ---');
test('Predicate created successfully', function() {
    var pred = new structures.Predicate();
    assertEqual(pred != null, true, 'Predicate should be created');
});

console.log('\n=== Test Summary ===');
console.log('Passed: ' + testsPassed);
console.log('Failed: ' + testsFailed);
console.log('Total:  ' + (testsPassed + testsFailed));

process.exit(testsFailed > 0 ? 1 : 0);
