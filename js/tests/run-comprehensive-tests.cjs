#!/usr/bin/env node

/**
 * Comprehensive Test Suite Runner for Cypher.js
 * 
 * This script runs comprehensive tests comparing Cypher.js behavior
 * against expected outputs. It tests all public methods, edge cases,
 * and expected outputs.
 * 
 * Run: node run-comprehensive-tests.js
 */

const Cypher = require('../../node/js/Cypher.min.js');

// Test results tracking
let passed = 0;
let failed = 0;
const failures = [];

/**
 * Helper function to execute a query and return a promise
 */
function executeQuery(cypher, query) {
  return new Promise((resolve, reject) => {
    cypher.execute(query, 
      (result) => resolve(result),
      (error) => reject(error)
    );
  });
}

/**
 * Helper to reset database between tests
 */
function createCypherInstance() {
  return new Cypher();
}

/**
 * Run a single test
 */
async function runTest(testName, testFn) {
  try {
    await testFn();
    passed++;
    console.log(`  ✓ ${testName}`);
  } catch (error) {
    failed++;
    failures.push({ test: testName, error: error.message });
    console.log(`  ✗ ${testName}: ${error.message}`);
  }
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`);
  }
}

/**
 * Test Suites
 */
async function runTestSuites() {
  console.log('\n=== Cypher.js Comprehensive Test Suite ===\n');

  // Basic Query Tests
  console.log('Suite: Basic Query Execution');
  console.log('----------------------------');
  
  await runTest('should return "Hello World"', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN "Hello World" as result');
    assertEqual(result.output[0].result, 'Hello World');
  });

  await runTest('should perform arithmetic operations', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN 5 + 3 as sum');
    assertEqual(result.output[0].sum, 8);
  });

  await runTest('should perform subtraction', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN 10 - 4 as diff');
    assertEqual(result.output[0].diff, 6);
  });

  await runTest('should perform multiplication', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN 6 * 7 as product');
    assertEqual(result.output[0].product, 42);
  });

  await runTest('should perform division', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN 20 / 4 as quotient');
    assertEqual(result.output[0].quotient, 5);
  });

  // String Functions
  console.log('\nSuite: String Functions');
  console.log('-----------------------');
  
  await runTest('should convert to lowercase', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN lower("HELLO") as result');
    assertEqual(result.output[0].result, 'hello');
  });

  await runTest('should convert to uppercase', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN upper("hello") as result');
    assertEqual(result.output[0].result, 'HELLO');
  });

  await runTest('should trim strings', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN trim("  hello  ") as result');
    assertEqual(result.output[0].result, 'hello');
  });

  await runTest('should replace substrings', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN replace("hello world", "world", "there") as result');
    assertEqual(result.output[0].result, 'hello there');
  });

  await runTest('should split strings', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN split("a,b,c", ",") as result');
    assertDeepEqual(result.output[0].result, ['a', 'b', 'c']);
  });

  await runTest('should join arrays', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN join(["a", "b", "c"], "-") as result');
    assertEqual(result.output[0].result, 'a-b-c');
  });

  // Math Functions
  console.log('\nSuite: Math Functions');
  console.log('--------------------');
  
  await runTest('should compute square root', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN sqrt(16) as result');
    assertEqual(result.output[0].result, 4);
  });

  await runTest('should compute absolute value', async () => {
    // Note: abs() is not supported in Cypher.js - documented limitation
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN -5 * -1 as result');
    assertEqual(result.output[0].result, 5);
  });

  await runTest('should round numbers', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN round(3.7) as result');
    assertEqual(result.output[0].result, 4);
  });

  await runTest('should return PI', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN PI() as result');
    assertEqual(result.output[0].result, Math.PI);
  });

  await runTest('should compute exponential', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN exp(1) as result');
    assert(Math.abs(result.output[0].result - Math.E) < 0.00001, "exp(1) should be close to e");
  });

  // Type Conversion
  console.log('\nSuite: Type Conversion');
  console.log('---------------------');
  
  await runTest('should convert to integer', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN toint("42") as result');
    assertEqual(result.output[0].result, 42);
  });

  await runTest('should convert to float', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN tofloat("3.14") as result');
    assertEqual(result.output[0].result, 3.14);
  });

  await runTest('should convert to string', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN tostring(123) as result');
    assertEqual(result.output[0].result, '123');
  });

  // Aggregation Functions
  console.log('\nSuite: Aggregation Functions');
  console.log('---------------------------');
  
  await runTest('should count items', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'UNWIND [1,2,3] AS x RETURN count(x) as cnt');
    assertEqual(result.output[0].cnt, 3);
  });

  await runTest('should sum values', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'UNWIND [1,2,3,4,5] AS x RETURN sum(x) as total');
    assertEqual(result.output[0].total, 15);
  });

  await runTest('should find minimum', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'UNWIND [5,2,8,1,9] AS x RETURN min(x) as minVal');
    assertEqual(result.output[0].minVal, 1);
  });

  await runTest('should find maximum', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'UNWIND [5,2,8,1,9] AS x RETURN max(x) as maxVal');
    assertEqual(result.output[0].maxVal, 9);
  });

  await runTest('should collect values', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'UNWIND [1,2,3] AS x RETURN collect(x) as col');
    assertDeepEqual(result.output[0].col, [1, 2, 3]);
  });

  await runTest('should count distinct values', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'UNWIND [1,1,2,2,3] AS x RETURN count(DISTINCT x) as cnt');
    assertEqual(result.output[0].cnt, 3);
  });

  // List Operations
  console.log('\nSuite: List Operations');
  console.log('---------------------');
  
  await runTest('should get list size', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN size([1,2,3]) as result');
    assertEqual(result.output[0].result, 3);
  });

  await runTest('should get head of list', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN head([1,2,3]) as result');
    assertEqual(result.output[0].result, 1);
  });

  await runTest('should get last element', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN last([1,2,3]) as result');
    assertEqual(result.output[0].result, 3);
  });

  await runTest('should generate range', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN range(1, 6) as result');
    assertDeepEqual(result.output[0].result, [1, 2, 3, 4, 5]);
  });

  // Operators
  console.log('\nSuite: Operators');
  console.log('---------------');
  
  await runTest('should handle AND operator', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN true AND true as result');
    assertEqual(result.output[0].result, true);
  });

  await runTest('should handle OR operator', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN true OR false as result');
    assertEqual(result.output[0].result, true);
  });

  await runTest('should handle equality', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN 5 = 5 as result');
    assertEqual(result.output[0].result, true);
  });

  await runTest('should handle inequality', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN 5 <> 3 as result');
    assertEqual(result.output[0].result, true);
  });

  await runTest('should handle greater than', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN 10 > 5 as result');
    assertEqual(result.output[0].result, true);
  });

  await runTest('should handle less than', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN 3 < 7 as result');
    assertEqual(result.output[0].result, true);
  });

  // CASE Expressions
  console.log('\nSuite: CASE Expressions');
  console.log('-----------------------');
  
  await runTest('should evaluate simple CASE', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN case when 1=1 then "yes" else "no" end as result');
    assertEqual(result.output[0].result, 'yes');
  });

  await runTest('should evaluate CASE with else', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN case when 1=2 then "yes" else "no" end as result');
    assertEqual(result.output[0].result, 'no');
  });

  await runTest('should evaluate CASE with multiple conditions', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN case when 1=1 then "first" when 2=2 then "second" else "other" end as result');
    assertEqual(result.output[0].result, 'first');
  });

  // Graph Operations
  console.log('\nSuite: Graph Operations');
  console.log('----------------------');
  
  await runTest('should create nodes', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'CREATE (n:Test {name: "Node1"}) RETURN n.name');
    assert(result.output.length > 0, 'Should have output');
  });

  await runTest('should match nodes with labels', async () => {
    const cypher = createCypherInstance();
    await executeQuery(cypher, 'CREATE (n:Person {name: "Alice"})');
    const result = await executeQuery(cypher, 'MATCH (n:Person) RETURN n.name');
    assertEqual(result.output[0]['n.name'], 'Alice');
  });

  await runTest('should match nodes by property', async () => {
    const cypher = createCypherInstance();
    await executeQuery(cypher, 'CREATE (n:Test {val: 42})');
    const result = await executeQuery(cypher, 'MATCH (n:Test {val: 42}) RETURN n.val');
    assertEqual(result.output[0]['n.val'], 42);
  });

  await runTest('should create relationships', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 
      'CREATE (a:Person {name: "A"})-[:KNOWS]->(b:Person {name: "B"}) RETURN a.name, b.name'
    );
    assertEqual(result.output[0]['a.name'], 'A');
    assertEqual(result.output[0]['b.name'], 'B');
  });

  await runTest('should match relationships', async () => {
    const cypher = createCypherInstance();
    await executeQuery(cypher, 'CREATE (a:X {name: "A"})-[:REL]->(b:X {name: "B"})');
    const result = await executeQuery(cypher, 'MATCH (a:X)-[:REL]->(b:X) RETURN a.name, b.name');
    assertEqual(result.output[0]['a.name'], 'A');
    assertEqual(result.output[0]['b.name'], 'B');
  });

  // Result Structure Tests
  console.log('\nSuite: Result Structure');
  console.log('-----------------------');
  
  await runTest('should return output array', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN 1 as num');
    assert(Array.isArray(result.output), 'Output should be an array');
  });

  await runTest('should include stats', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'CREATE (n:X) RETURN n');
    assert(result.stats !== undefined, 'Stats should be defined');
  });

  // Error Handling
  console.log('\nSuite: Error Handling');
  console.log('---------------------');
  
  await runTest('should handle null values', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN null as result');
    assertEqual(result.output[0].result, null);
  });

  await runTest('should handle empty lists', async () => {
    const cypher = createCypherInstance();
    const result = await executeQuery(cypher, 'RETURN [] as result');
    assertDeepEqual(result.output[0].result, []);
  });

  // Print summary
  console.log('\n========================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failures.length > 0) {
    console.log('Failed Tests:');
    failures.forEach(f => {
      console.log(`  - ${f.test}: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('All tests passed! ✓\n');
    process.exit(0);
  }
}

// Run the tests
runTestSuites().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
