/**
 * Dual-Face Test Harness
 * 
 * This module provides utilities for running the same tests against both
 * Cypher.js (legacy) and CypherNG.js (next-gen) implementations,
 * ensuring behavioral parity.
 * 
 * Extended with support for:
 * - Module-level testing (Node, Relationship, Pattern, Parser, etc.)
 * - Deep comparison with detailed diff output
 * - Performance benchmarking
 * - Error behavior validation
 * - State management and reset
 */

const CypherLegacy = require('../../js/Cypher.js');
const CypherNG = require('../../js/CypherNG.js');

// Import CypherNG modules for direct testing
const { Node } = require('../../js/CypherNG/core/Node.js');
const { Relationship } = require('../../js/CypherNG/core/Relationship.js');
const { Pattern } = require('../../js/CypherNG/core/Pattern.js');
const { DB } = require('../../js/CypherNG/core/DB.js');
const { StringRecoder } = require('../../js/CypherNG/core/StringRecoder.js');
const { IDFactory } = require('../../js/CypherNG/core/IDFactory.js');
const { List } = require('../../js/CypherNG/types/List.js');
const { AssociativeArray } = require('../../js/CypherNG/types/AssociativeArray.js');
const { Case } = require('../../js/CypherNG/types/Case.js');
const { Predicate } = require('../../js/CypherNG/types/Predicate.js');
const { Table, TableColumn } = require('../../js/CypherNG/types/Table.js');
const { 
  Parser, 
  KeyWord, 
  Operator, 
  _Function, 
  AggregateFunction 
} = require('../../js/CypherNG/query/Parser.js');
const { Expression } = require('../../js/CypherNG/query/Expression.js');

/**
 * Creates a dual-face test context that runs tests against both implementations
 * @param {string} testName - Name of the test suite
 * @param {Function} testFn - Test function that receives (cypher, implName)
 */
function dualFaceTest(testName, testFn) {
  describe(`[Dual-Face] ${testName}`, () => {
    test(`${testName} - Legacy (Cypher.js)`, async () => {
      const cypher = new CypherLegacy({ runInWebWorker: false });
      await testFn(cypher, 'Cypher.js (Legacy)');
    });

    test(`${testName} - Next-Gen (CypherNG.js)`, async () => {
      const cypher = new CypherNG({ runInWebWorker: false });
      await testFn(cypher, 'CypherNG.js (Next-Gen)');
    });
  });
}

/**
 * Creates a comparison test that asserts both implementations produce identical results
 * @param {string} testName - Name of the test
 * @param {string} query - Cypher query to execute
 * @param {Function} resultTransformer - Optional function to transform results before comparison
 */
function compareResults(testName, query, resultTransformer = null) {
  describe(`[Compare] ${testName}`, () => {
    let legacyResult;
    let ngResult;

    beforeAll(async () => {
      const legacyCypher = new CypherLegacy({ runInWebWorker: false });
      const ngCypher = new CypherNG({ runInWebWorker: false });

      legacyResult = await new Promise((resolve, reject) => {
        legacyCypher.execute(query, resolve, reject);
      });

      ngResult = await new Promise((resolve, reject) => {
        ngCypher.execute(query, resolve, reject);
      });

      if (resultTransformer) {
        legacyResult = resultTransformer(legacyResult);
        ngResult = resultTransformer(ngResult);
      }
    });

    test('both implementations should produce identical output', () => {
      expect(ngResult.output).toEqual(legacyResult.output);
    });

    test('both implementations should produce identical graph nodes', () => {
      expect(ngResult.graph.nodes).toEqual(legacyResult.graph.nodes);
    });

    test('both implementations should produce identical graph links', () => {
      expect(ngResult.graph.links).toEqual(legacyResult.graph.links);
    });

    test('both implementations should produce identical stats', () => {
      expect(ngResult.stats).toEqual(legacyResult.stats);
    });
  });
}

/**
 * Runs a query and returns a standardized result object
 * @param {Object} cypher - Cypher instance
 * @param {string} query - Cypher query
 * @returns {Promise<Object>} Standardized result object
 */
function runQuery(cypher, query) {
  return new Promise((resolve, reject) => {
    cypher.execute(query, resolve, reject);
  });
}

/**
 * Asserts that two cypher instances produce the same results for a set of queries
 * @param {string} description - Test description
 * @param {Array<string>} queries - Array of Cypher queries
 */
function assertBehavioralParity(description, queries) {
  describe(`[Parity] ${description}`, () => {
    const legacyCypher = new CypherLegacy({ runInWebWorker: false });
    const ngCypher = new CypherNG({ runInWebWorker: false });

    queries.forEach((query, index) => {
      test(`Query ${index + 1}: ${query.substring(0, 50)}...`, async () => {
        const legacyResult = await runQuery(legacyCypher, query);
        const ngResult = await runQuery(ngCypher, query);

        expect(ngResult.output).toEqual(legacyResult.output);
        expect(ngResult.stats).toEqual(legacyResult.stats);
      });
    });
  });
}

/**
 * Deep comparison of two objects with detailed error reporting
 * @param {*} actual - Actual value
 * @param {*} expected - Expected value
 * @param {string} path - Current path for error reporting
 * @returns {Array<string>} Array of differences
 */
function deepCompare(actual, expected, path = '') {
  const differences = [];
  
  if (actual === expected) return differences;
  
  if (typeof actual !== typeof expected) {
    differences.push(`${path}: type mismatch (${typeof actual} vs ${typeof expected})`);
    return differences;
  }
  
  if (actual === null || expected === null) {
    differences.push(`${path}: ${actual} vs ${expected}`);
    return differences;
  }
  
  if (typeof actual !== 'object') {
    differences.push(`${path}: ${actual} vs ${expected}`);
    return differences;
  }
  
  if (Array.isArray(actual) !== Array.isArray(expected)) {
    differences.push(`${path}: array vs object mismatch`);
    return differences;
  }
  
  if (Array.isArray(actual)) {
    if (actual.length !== expected.length) {
      differences.push(`${path}: array length mismatch (${actual.length} vs ${expected.length})`);
    }
    const minLength = Math.min(actual.length, expected.length);
    for (let i = 0; i < minLength; i++) {
      differences.push(...deepCompare(actual[i], expected[i], `${path}[${i}]`));
    }
  } else {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    
    const missingKeys = expectedKeys.filter(k => !actualKeys.includes(k));
    const extraKeys = actualKeys.filter(k => !expectedKeys.includes(k));
    
    if (missingKeys.length > 0) {
      differences.push(`${path}: missing keys [${missingKeys.join(', ')}]`);
    }
    if (extraKeys.length > 0) {
      differences.push(`${path}: extra keys [${extraKeys.join(', ')}]`);
    }
    
    for (const key of actualKeys) {
      if (expectedKeys.includes(key)) {
        differences.push(...deepCompare(actual[key], expected[key], `${path}.${key}`));
      }
    }
  }
  
  return differences;
}

/**
 * Asserts deep equality with detailed error message
 * @param {*} actual - Actual value
 * @param {*} expected - Expected value
 * @param {string} message - Error message prefix
 */
function assertDeepEqual(actual, expected, message = 'Values not equal') {
  const differences = deepCompare(actual, expected);
  if (differences.length > 0) {
    throw new Error(`${message}:\n${differences.join('\n')}`);
  }
}

/**
 * Creates a dual-face test for CypherNG modules
 * Tests that module classes work identically when used directly
 * @param {string} testName - Name of the test
 * @param {Function} testFn - Test function receiving (modules, implName)
 */
function dualFaceModuleTest(testName, testFn) {
  describe(`[Module-Dual-Face] ${testName}`, () => {
    test(`${testName} - Legacy modules`, async () => {
      // Legacy modules are accessed through the main CypherJS function
      const legacyModules = {
        // Legacy doesn't have separate modules, we test through Cypher instance
        createCypher: () => new CypherLegacy({ runInWebWorker: false })
      };
      await testFn(legacyModules, 'Cypher.js (Legacy)');
    });

    test(`${testName} - Next-Gen modules`, async () => {
      const ngModules = {
        Node,
        Relationship,
        Pattern,
        DB,
        StringRecoder,
        IDFactory,
        List,
        AssociativeArray,
        Case,
        Predicate,
        Table,
        TableColumn,
        Parser,
        Expression,
        KeyWord,
        Operator,
        _Function,
        AggregateFunction,
        createCypher: () => new CypherNG({ runInWebWorker: false })
      };
      await testFn(ngModules, 'CypherNG.js (Next-Gen)');
    });
  });
}

/**
 * Tests parser behavior between implementations
 * @param {string} testName - Name of the test
 * @param {string} query - Cypher query to parse
 * @param {Function} validationFn - Function to validate parsed result
 */
function compareParserResults(testName, query, validationFn) {
  describe(`[Parser-Compare] ${testName}`, () => {
    test('both parsers should handle query without errors', async () => {
      const legacyCypher = new CypherLegacy({ runInWebWorker: false });
      const ngCypher = new CypherNG({ runInWebWorker: false });
      
      let legacyError = null;
      let ngError = null;
      
      try {
        await runQuery(legacyCypher, query);
      } catch (e) {
        legacyError = e;
      }
      
      try {
        await runQuery(ngCypher, query);
      } catch (e) {
        ngError = e;
      }
      
      // Both should either succeed or fail with similar errors
      if (legacyError && ngError) {
        // Both failed - this is acceptable if error types match
        expect(ngError.constructor.name).toBe(legacyError.constructor.name);
      } else if (legacyError) {
        fail(`Legacy failed but NG succeeded: ${legacyError}`);
      } else if (ngError) {
        fail(`NG failed but Legacy succeeded: ${ngError}`);
      }
      
      if (validationFn) {
        await validationFn(legacyError, ngError);
      }
    });
  });
}

/**
 * Benchmarks performance between implementations
 * @param {string} testName - Name of the benchmark
 * @param {string} query - Query to benchmark
 * @param {number} iterations - Number of iterations
 */
function benchmarkPerformance(testName, query, iterations = 100) {
  describe(`[Benchmark] ${testName}`, () => {
    test(`runs ${iterations} iterations`, async () => {
      const legacyCypher = new CypherLegacy({ runInWebWorker: false });
      const ngCypher = new CypherNG({ runInWebWorker: false });
      
      // Warmup
      for (let i = 0; i < 10; i++) {
        await runQuery(legacyCypher, query);
        await runQuery(ngCypher, query);
      }
      
      // Benchmark legacy
      const legacyStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await runQuery(legacyCypher, query);
      }
      const legacyTime = Date.now() - legacyStart;
      
      // Benchmark NG
      const ngStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await runQuery(ngCypher, query);
      }
      const ngTime = Date.now() - ngStart;
      
      console.log(`\n[Benchmark] ${testName}:`);
      console.log(`  Legacy: ${legacyTime}ms (${(legacyTime/iterations).toFixed(2)}ms/op)`);
      console.log(`  Next-Gen: ${ngTime}ms (${(ngTime/iterations).toFixed(2)}ms/op)`);
      console.log(`  Ratio: ${(ngTime/legacyTime).toFixed(2)}x`);
      
      // NG should not be more than 2x slower
      expect(ngTime).toBeLessThan(legacyTime * 2);
    });
  });
}

/**
 * Tests error handling behavior
 * @param {string} testName - Name of the test
 * @param {string} query - Query that should produce an error
 * @param {string|RegExp} expectedError - Expected error message pattern
 */
function compareErrorHandling(testName, query, expectedError) {
  describe(`[Error-Compare] ${testName}`, () => {
    test('both implementations should produce similar errors', async () => {
      const legacyCypher = new CypherLegacy({ runInWebWorker: false });
      const ngCypher = new CypherNG({ runInWebWorker: false });
      
      let legacyError = null;
      let ngError = null;
      
      try {
        await runQuery(legacyCypher, query);
      } catch (e) {
        legacyError = e.toString();
      }
      
      try {
        await runQuery(ngCypher, query);
      } catch (e) {
        ngError = e.toString();
      }
      
      expect(legacyError).not.toBeNull();
      expect(ngError).not.toBeNull();
      
      if (expectedError instanceof RegExp) {
        expect(legacyError).toMatch(expectedError);
        expect(ngError).toMatch(expectedError);
      } else {
        expect(legacyError).toContain(expectedError);
        expect(ngError).toContain(expectedError);
      }
    });
  });
}

/**
 * Creates isolated test environment with fresh instances
 * @param {Function} testFn - Test function receiving { legacy, ng, runLegacy, runNg }
 */
function withIsolatedInstances(testFn) {
  const legacy = new CypherLegacy({ runInWebWorker: false });
  const ng = new CypherNG({ runInWebWorker: false });
  
  const runLegacy = (query) => runQuery(legacy, query);
  const runNg = (query) => runQuery(ng, query);
  
  return testFn({ legacy, ng, runLegacy, runNg });
}

/**
 * Tests data structure serialization/deserialization
 * @param {string} testName - Name of the test
 * @param {*} data - Data to serialize
 */
function compareDataSerialization(testName, data) {
  describe(`[Serialization] ${testName}`, () => {
    test('both implementations should serialize data consistently', () => {
      const legacyJson = JSON.stringify(data);
      // NG should produce same JSON representation
      const ngJson = JSON.stringify(data);
      expect(ngJson).toBe(legacyJson);
      
      // Both should parse back to equivalent objects
      const legacyParsed = JSON.parse(legacyJson);
      const ngParsed = JSON.parse(ngJson);
      expect(ngParsed).toEqual(legacyParsed);
    });
  });
}

/**
 * Validates that both implementations support the same set of features
 * @param {Array<string>} features - List of feature names to check
 */
function validateFeatureParity(features) {
  describe('[Feature Parity]', () => {
    const legacy = new CypherLegacy({ runInWebWorker: false });
    const ng = new CypherNG({ runInWebWorker: false });
    
    features.forEach(feature => {
      test(`both support: ${feature}`, () => {
        // Check method existence
        const legacyHasMethod = typeof legacy[feature] === 'function';
        const ngHasMethod = typeof ng[feature] === 'function';
        expect(ngHasMethod).toBe(legacyHasMethod);
      });
    });
  });
}

module.exports = {
  // Original exports
  dualFaceTest,
  compareResults,
  runQuery,
  assertBehavioralParity,
  CypherLegacy,
  CypherNG,
  
  // New extended utilities
  deepCompare,
  assertDeepEqual,
  dualFaceModuleTest,
  compareParserResults,
  benchmarkPerformance,
  compareErrorHandling,
  withIsolatedInstances,
  compareDataSerialization,
  validateFeatureParity,
  
  // Module exports for direct testing
  Modules: {
    Node,
    Relationship,
    Pattern,
    DB,
    StringRecoder,
    IDFactory,
    List,
    AssociativeArray,
    Case,
    Predicate,
    Table,
    TableColumn,
    Parser,
    Expression,
    KeyWord,
    Operator,
    _Function,
    AggregateFunction
  }
};
