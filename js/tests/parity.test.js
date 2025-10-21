/**
 * Functional Parity Test Suite for CypherNG.js
 * Tests that CypherNG.js produces identical results to original Cypher.js
 * @author Factory Droid
 */

const CypherOriginal = require("../Cypher.js");
const { CypherNG } = require("../CypherNG.js");

// Test statements from original Cypher.test.js
const testStatements = [
    'load csv with headers from "https://raw.githubusercontent.com/melaniewalsh/sample-social-network-datasets/master/sample-datasets/game-of-thrones/got-nodes.csv" as l \
    merge (c:Character{name:l.Id}) \
    return count(1)',

    'load csv with headers from "https://raw.githubusercontent.com/melaniewalsh/sample-social-network-datasets/master/sample-datasets/game-of-thrones/got-edges.csv" as l \
    match (source:Character{name:l.Source}), (target:Character{name:l.Target}) \
    merge (source)-[r:KNOWS{weight:l.Weight}]->(target) \
    return count(1)',

    'match (a:Character)-[:KNOWS]->(b:Character) \
    return count(1) as cnt',

    'match (a:Character)-[:KNOWS*]->(b:Character) \
    return count(1) as cnt',
    
    'merge (:Node{ID:1})-[:TO{ID:12}]->(:Node{ID:2}) \
    merge (:Node{ID:2})-[:TO{ID:23}]->(:Node{ID:3}) \
    merge (:Node{ID:2})-[:TO{ID:24}]->(:Node{ID:4}) \
    merge (:Node{ID:3})-[:TO{ID:35}]->(:Node{ID:5}) \
    merge (:Node{ID:3})-[:TO{ID:36}]->(:Node{ID:6}) \
    merge (:Node{ID:2})-[:TO{ID:24}]->(:Node{ID:4}) \
    merge (:Node{ID:4})-[:TO{ID:47}]->(:Node{ID:7}) \
    with 1 as dummy \
    match (a)-[r:TO]->(b) \
    return count(1)',

    'match (a:Node{ID:1})-[r*]->(b) \
    return size(r)',
    
    'merge (:Node{ID:1})-[:TO]->(:Node{ID:2}) merge (:Node{ID:1})-[:TO]->(:Node{ID:3}) return count(1)',

    'merge (:Node{ID:1})-[:TO]->(:Node{ID:2}) merge (:Node{ID:1})-[:TO]->(:Node{ID:3}) return count(1)',

    'match (a:Character{name:"Edmure"})-[:KNOWS*]->(:Character) \
    return a.name, count(1)',

    'unwind [{k:"a", v: 1}, {k:"b", v: 2}] as e return collect(distinct e)',
    
    'unwind ["a","a","b","b","c","d","a"] as e with barchart(e) as bc, {kiwi: 2} as k return bc.a, k.kiwi',

    'return case when 1=1 then 1 else 0 end',

    'create (a:Node{id:0}) \
    create (b:Node{id:1}) \
    create (c:Node{id:2}) \
    create (d:Node{id:3}) \
    create (e:Node{id:4}) \
    create (a)-[:PARENT]->(b) \
    create (b)-[:PARENT]->(c) \
    create (d)-[:PARENT]->(e) \
    with 1 as dummy \
    match p=(:Node)-[:PARENT*]->(parent:Node) \
    where not((parent)-[:PARENT]->(:Node)) \
    unwind nodes(p) as node \
    return id(nodes(p)[0]) as leaf, collect(id(node)) as path'
];

/**
 * Runs parity test comparing original and new implementations
 * @param {string} query - Cypher query to test
 * @returns {Promise<boolean>} - True if results match
 */
async function runParityTest(query) {
    return new Promise((resolve) => {
        const originalResults = [];
        const ngResults = [];
        
        let originalComplete = false;
        let ngComplete = false;
        
        // Test original implementation
        const cypherOriginal = new CypherOriginal();
        cypherOriginal.execute(
            query,
            function(results) {
                originalResults.push(results);
                originalComplete = true;
                if (ngComplete) {
                    resolve(compareResults(originalResults[0], ngResults[0]));
                }
            },
            function(error) {
                console.error('Original implementation error:', error);
                originalComplete = true;
                if (ngComplete) {
                    resolve(false);
                }
            }
        );
        
        // Test new implementation
        const cypherNG = new CypherNG();
        cypherNG.execute(
            query,
            function(results) {
                ngResults.push(results);
                ngComplete = true;
                if (originalComplete) {
                    resolve(compareResults(originalResults[0], ngResults[0]));
                }
            },
            function(error) {
                console.error('CypherNG implementation error:', error);
                ngComplete = true;
                if (originalComplete) {
                    resolve(false);
                }
            }
        );
    });
}

/**
 * Compares results from both implementations
 * @param {any} original - Original implementation results
 * @param {any} ng - New implementation results  
 * @returns {boolean} - True if results are functionally equivalent
 */
function compareResults(original, ng) {
    try {
        // Deep comparison ignoring potential minor formatting differences
        const originalStr = JSON.stringify(normalizeResults(original));
        const ngStr = JSON.stringify(normalizeResults(ng));
        
        return originalStr === ngStr;
    } catch (error) {
        console.error('Error comparing results:', error);
        return false;
    }
}

/**
 * Normalizes results for comparison by handling minor formatting differences
 * @param {any} results - Results to normalize
 * @returns {any} - Normalized results
 */
function normalizeResults(results) {
    if (!results) return null;
    
    // Create a deep copy for normalization
    const normalized = JSON.parse(JSON.stringify(results));
    
    // Ensure arrays are in consistent order
    if (normalized.graph && Array.isArray(normalized.graph)) {
        normalized.graph.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    
    return normalized;
}

/**
 * Runs the complete parity test suite
 * @returns {Promise<{passed: number, failed: number, results: Array}>}
 */
async function runParityTestSuite() {
    console.log('Starting Cypher.js parity test suite...\n');
    
    const results = [];
    let passed = 0;
    let failed = 0;
    
    for (let i = 0; i < testStatements.length; i++) {
        const query = testStatements[i];
        console.log(`Running test ${i + 1}/${testStatements.length}...`);
        
        try {
            const isParity = await runParityTest(query);
            
            results.push({
                testIndex: i + 1,
                query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
                passed: isParity
            });
            
            if (isParity) {
                passed++;
                console.log(`✅ Test ${i + 1} PASSED`);
            } else {
                failed++;
                console.log(`❌ Test ${i + 1} FAILED`);
            }
        } catch (error) {
            failed++;
            console.log(`❌ Test ${i + 1} ERROR:`, error.message);
            results.push({
                testIndex: i + 1,
                query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
                passed: false,
                error: error.message
            });
        }
        
        console.log(''); // Empty line for readability
    }
    
    console.log('=' * 50);
    console.log(`PARITY TEST SUITE RESULTS:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Success Rate: ${((passed / testStatements.length) * 100).toFixed(1)}%`);
    console.log('=' * 50);
    
    return { passed, failed, results };
}

// Run tests if this file is executed directly
if (require.main === module) {
    runParityTestSuite()
        .then((results) => {
            process.exit(results.failed > 0 ? 1 : 0);
        })
        .catch((error) => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = {
    runParityTestSuite,
    runParityTest,
    compareResults,
    testStatements
};
