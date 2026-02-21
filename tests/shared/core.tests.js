/**
 * Shared Core Tests
 * 
 * These tests run against both Cypher.js and CypherNG.js implementations
 * to ensure behavioral parity.
 */

const { dualFaceTest, compareResults, assertBehavioralParity, runQuery } = require('./dual-face-harness');

describe('Core Functionality - Dual Face Tests', () => {

  // Basic node creation tests
  dualFaceTest('should create a simple node', async (cypher, implName) => {
    const result = await runQuery(cypher, 'CREATE (n:Test {name: "hello"}) RETURN n');
    
    expect(result.output).toHaveLength(1);
    expect(result.output[0].n).toBeDefined();
    expect(result.stats.nodesAdded).toBe(1);
  });

  dualFaceTest('should create multiple nodes', async (cypher, implName) => {
    const result = await runQuery(cypher, 
      'CREATE (a:Node {id: 1}), (b:Node {id: 2}), (c:Node {id: 3}) RETURN count(*) as cnt'
    );
    
    expect(result.output[0].cnt).toBe(3);
    expect(result.stats.nodesAdded).toBe(3);
  });

  dualFaceTest('should create nodes with relationships', async (cypher, implName) => {
    const result = await runQuery(cypher,
      'CREATE (a:Person {name: "Alice"})-[:KNOWS {since: 2020}]->(b:Person {name: "Bob"}) RETURN a, b'
    );
    
    expect(result.stats.nodesAdded).toBe(2);
    expect(result.stats.relationshipsAdded).toBe(1);
  });

  // MATCH tests
  dualFaceTest('should match nodes by label', async (cypher, implName) => {
    await runQuery(cypher, 'CREATE (n:TestMatch {value: 1}), (n2:TestMatch {value: 2})');
    const result = await runQuery(cypher, 'MATCH (n:TestMatch) RETURN n.value as val ORDER BY val');
    
    expect(result.output).toHaveLength(2);
    expect(result.output[0].val).toBe(1);
    expect(result.output[1].val).toBe(2);
  });

  dualFaceTest('should match nodes by property', async (cypher, implName) => {
    await runQuery(cypher, 'CREATE (n:FilterTest {type: "A", status: "active"}), (n2:FilterTest {type: "B", status: "inactive"})');
    const result = await runQuery(cypher, 'MATCH (n:FilterTest {status: "active"}) RETURN n.type as type');
    
    expect(result.output).toHaveLength(1);
    expect(result.output[0].type).toBe('A');
  });

  dualFaceTest('should match relationships', async (cypher, implName) => {
    await runQuery(cypher, 'CREATE (a:RelTest {name: "A"})-[:CONNECTS {weight: 5}]->(b:RelTest {name: "B"})');
    const result = await runQuery(cypher, 'MATCH (a:RelTest)-[r:CONNECTS]->(b:RelTest) RETURN a.name, r.weight, b.name');
    
    expect(result.output).toHaveLength(1);
    expect(result.output[0]['r.weight']).toBe(5);
  });

  // MERGE tests
  dualFaceTest('should merge nodes (create new)', async (cypher, implName) => {
    const result = await runQuery(cypher, 'MERGE (n:MergeTest {id: 1}) RETURN n.id as id');
    
    expect(result.output[0].id).toBe(1);
    expect(result.stats.nodesAdded).toBe(1);
  });

  dualFaceTest('should merge nodes (match existing)', async (cypher, implName) => {
    await runQuery(cypher, 'MERGE (n:MergeTest2 {id: 1})');
    const result = await runQuery(cypher, 'MERGE (n:MergeTest2 {id: 1}) RETURN n.id as id');
    
    expect(result.output[0].id).toBe(1);
    expect(result.stats.nodesAdded).toBe(0); // Should not create new node
  });

  // RETURN clause tests
  dualFaceTest('should return multiple expressions', async (cypher, implName) => {
    await runQuery(cypher, 'CREATE (n:ReturnTest {a: 1, b: 2, c: 3})');
    const result = await runQuery(cypher, 'MATCH (n:ReturnTest) RETURN n.a as first, n.b as second, n.c as third');
    
    expect(result.output[0].first).toBe(1);
    expect(result.output[0].second).toBe(2);
    expect(result.output[0].third).toBe(3);
  });

  dualFaceTest('should support count aggregation', async (cypher, implName) => {
    await runQuery(cypher, 'CREATE (n:AggTest), (n2:AggTest), (n3:AggTest)');
    const result = await runQuery(cypher, 'MATCH (n:AggTest) RETURN count(*) as cnt');
    
    expect(result.output[0].cnt).toBe(3);
  });

  dualFaceTest('should support collect aggregation', async (cypher, implName) => {
    await runQuery(cypher, 'CREATE (n:CollectTest {val: 1}), (n2:CollectTest {val: 2}), (n3:CollectTest {val: 3})');
    const result = await runQuery(cypher, 'MATCH (n:CollectTest) RETURN collect(n.val) as values');
    
    expect(result.output[0].values).toHaveLength(3);
    expect(result.output[0].values).toContain(1);
    expect(result.output[0].values).toContain(2);
    expect(result.output[0].values).toContain(3);
  });

  // WHERE clause tests
  dualFaceTest('should filter with WHERE clause', async (cypher, implName) => {
    await runQuery(cypher, 'CREATE (n:WhereTest {score: 10}), (n2:WhereTest {score: 50}), (n3:WhereTest {score: 100})');
    const result = await runQuery(cypher, 'MATCH (n:WhereTest) WHERE n.score > 30 RETURN n.score as score');
    
    expect(result.output).toHaveLength(2);
    const scores = result.output.map(r => r.score);
    expect(scores).toContain(50);
    expect(scores).toContain(100);
    expect(scores).not.toContain(10);
  });

  // UNWIND tests
  dualFaceTest('should unwind lists', async (cypher, implName) => {
    const result = await runQuery(cypher, 'UNWIND [1, 2, 3] as num RETURN num');
    
    expect(result.output).toHaveLength(3);
    expect(result.output.map(r => r.num)).toEqual([1, 2, 3]);
  });

  // WITH clause tests
  dualFaceTest('should support WITH clause for chaining', async (cypher, implName) => {
    const result = await runQuery(cypher, 
      'UNWIND [1, 2, 3, 4, 5] as num WITH num WHERE num > 2 RETURN num ORDER BY num'
    );
    
    expect(result.output).toHaveLength(3);
    expect(result.output.map(r => r.num)).toEqual([3, 4, 5]);
  });

  // LIMIT tests
  dualFaceTest('should support LIMIT clause', async (cypher, implName) => {
    await runQuery(cypher, 'CREATE (n:LimitTest {id: 1}), (n2:LimitTest {id: 2}), (n3:LimitTest {id: 3}), (n4:LimitTest {id: 4})');
    const result = await runQuery(cypher, 'MATCH (n:LimitTest) RETURN n.id as id ORDER BY id LIMIT 2');
    
    expect(result.output).toHaveLength(2);
  });

  // Pattern matching tests
  dualFaceTest('should match variable-length paths', async (cypher, implName) => {
    await runQuery(cypher, `
      CREATE (a:PathTest {name: "A"})-[:STEP]->(b:PathTest {name: "B"})-[:STEP]->(c:PathTest {name: "C"})
    `);
    const result = await runQuery(cypher, 'MATCH p=(a:PathTest)-[:STEP*]->(c:PathTest) RETURN length(p) as len');
    
    expect(result.output.length).toBeGreaterThan(0);
  });

  // CASE expression tests
  dualFaceTest('should support CASE expressions', async (cypher, implName) => {
    const result = await runQuery(cypher, 'RETURN CASE WHEN 1=1 THEN "yes" ELSE "no" END as result');
    
    expect(result.output[0].result).toBe('yes');
  });

  // Functions tests
  dualFaceTest('should support id() function', async (cypher, implName) => {
    await runQuery(cypher, 'CREATE (n:IdTest)');
    const result = await runQuery(cypher, 'MATCH (n:IdTest) RETURN id(n) as nodeId');
    
    expect(typeof result.output[0].nodeId).toBe('number');
  });

  dualFaceTest('should support range() function', async (cypher, implName) => {
    const result = await runQuery(cypher, 'RETURN range(1, 5) as nums');
    
    expect(result.output[0].nums).toEqual([1, 2, 3, 4, 5]);
  });

  // Complex query tests
  dualFaceTest('should handle complex multi-clause queries', async (cypher, implName) => {
    const query = `
      CREATE (a:Complex {name: "Alice", age: 30}),
             (b:Complex {name: "Bob", age: 25}),
             (c:Complex {name: "Charlie", age: 35})
      CREATE (a)-[:FRIEND {since: 2010}]->(b),
             (b)-[:FRIEND {since: 2015}]->(c)
      WITH 1 as dummy
      MATCH (p:Complex)-[:FRIEND]->(friend:Complex)
      WHERE p.age >= 25
      RETURN p.name as person, friend.name as friend_name, count(*) as connections
    `;
    const result = await runQuery(cypher, query);
    
    expect(result.output.length).toBeGreaterThan(0);
    expect(result.stats.nodesAdded).toBe(3);
    expect(result.stats.relationshipsAdded).toBe(2);
  });

});

// Direct comparison tests for specific scenarios
describe('Behavioral Parity - Direct Comparisons', () => {
  
  compareResults(
    'Simple node creation',
    'CREATE (n:CompareTest {value: 42}) RETURN n.value as val'
  );

  compareResults(
    'Multiple property types',
    'CREATE (n:TypesTest {str: "text", num: 123, bool: true, float: 3.14}) RETURN n.str, n.num, n.bool, n.float'
  );

  compareResults(
    'Relationship with properties',
    'CREATE (a:RelA)-[r:REL {p1: 1, p2: "two"}]->(b:RelB) RETURN r.p1, r.p2'
  );

  compareResults(
    'Aggregation with grouping',
    'CREATE (a:Group {cat: "A"}), (b:Group {cat: "A"}), (c:Group {cat: "B"}) RETURN a.cat, count(*) as cnt'
  );

});

// Parity assertions for common query patterns
describe('Query Pattern Parity', () => {
  
  assertBehavioralParity('Basic CRUD operations', [
    'CREATE (n:CrudTest {id: 1}) RETURN n.id',
    'MATCH (n:CrudTest) RETURN count(*)',
    'MATCH (n:CrudTest) WHERE n.id = 1 SET n.updated = true RETURN n.updated',
    'MATCH (n:CrudTest) RETURN n.id, n.updated'
  ]);

  assertBehavioralParity('Pattern matching variations', [
    'CREATE (a:Pattern)-[:R]->(b:Pattern)-[:R]->(c:Pattern)',
    'MATCH (n:Pattern) RETURN count(*)',
    'MATCH (a:Pattern)-[:R]->(b:Pattern) RETURN a, b',
    'MATCH (a:Pattern)-[:R*]->(b:Pattern) RETURN a, b'
  ]);

});
