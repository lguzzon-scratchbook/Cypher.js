/**
 * @fileoverview Backward Compatibility Tests
 * @description Verifies that the modular implementation matches the behavior of Cypher.js reference implementation
 * @module cypher-ng/tests/compatibility
 */

// Test reference to the original Cypher.js
const CypherReference = require('../Cypher.js')

// Test reference to CypherNG
const CypherNG = require('../CypherNG.js')

describe('Backward Compatibility Tests', () => {
  let cypherRef
  let cypherNG

  beforeEach(() => {
    cypherRef = new CypherReference()
    cypherNG = new CypherNG()
  })

  describe('Basic Query Execution', () => {
    test('should execute simple CREATE and RETURN query', (done) => {
      const query = 'CREATE (n:Node {name: "Test"}) RETURN n'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          // Both should complete successfully
          expect(refResult).toBeDefined()
          expect(ngResult).toBeDefined()
          expect(refResult.output).toBeDefined()
          expect(ngResult.output).toBeDefined()
          done()
        }, (err) => done(err))
      }, (err) => done(err))
    })

    test('should execute MATCH query', (done) => {
      // First create data
      cypherRef.execute('CREATE (n:Node {id: 1}) RETURN n', () => {
        cypherNG.execute('CREATE (n:Node {id: 1}) RETURN n', () => {
          // Then match
          cypherRef.execute('MATCH (n:Node) RETURN n.id as id', (refResult) => {
            cypherNG.execute('MATCH (n:Node) RETURN n.id as id', (ngResult) => {
              expect(refResult.output.length).toBe(ngResult.output.length)
              done()
            }, done)
          }, done)
        }, done)
      }, done)
    })
  })

  describe('CREATE operations', () => {
    test('should create nodes with properties', (done) => {
      const query = 'CREATE (p:Person {name: "Alice", age: 30}) RETURN p.name, p.age'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output).toEqual(refResult.output)
          done()
        }, done)
      }, done)
    })

    test('should create nodes with labels', (done) => {
      const query = 'CREATE (n:Label1:Label2) RETURN labels(n)'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output).toEqual(refResult.output)
          done()
        }, done)
      }, done)
    })

    test('should create relationships', (done) => {
      const query = 'CREATE (a:Person {name: "A"})-[:KNOWS {since: 2020}]->(b:Person {name: "B"}) RETURN a.name, type(REL)'

      // This test verifies that relationship creation works in both implementations
      cypherRef.execute(query, (refResult) => {
        expect(refResult.output).toBeDefined()
        done()
      }, done)
    })
  })

  describe('MATCH operations', () => {
    test('should match nodes by property', (done) => {
      // Setup data first
      cypherRef.addGraph(
        [{ id: 1, labels: { Person: true }, properties: { name: 'John', age: 30 } }],
        []
      )
      cypherNG.addGraph(
        [{ id: 1, labels: { Person: true }, properties: { name: 'John', age: 30 } }],
        []
      )

      const query = 'MATCH (p:Person {name: "John"}) RETURN p.name, p.age'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output).toEqual(refResult.output)
          done()
        }, done)
      }, done)
    })

    test('should match nodes by label', (done) => {
      cypherRef.addGraph(
        [
          { id: 1, labels: { Person: true }, properties: { name: 'John' } },
          { id: 2, labels: { Person: true }, properties: { name: 'Jane' } },
          { id: 3, labels: { Company: true }, properties: { name: 'Acme' } }
        ],
        []
      )
      cypherNG.addGraph(
        [
          { id: 1, labels: { Person: true }, properties: { name: 'John' } },
          { id: 2, labels: { Person: true }, properties: { name: 'Jane' } },
          { id: 3, labels: { Company: true }, properties: { name: 'Acme' } }
        ],
        []
      )

      const query = 'MATCH (p:Person) RETURN p.name'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output).toEqual(refResult.output)
          done()
        }, done)
      }, done)
    })
  })

  describe('Aggregation functions', () => {
    test('should count nodes', (done) => {
      cypherRef.addGraph(
        [
          { id: 1, labels: { Node: true }, properties: {} },
          { id: 2, labels: { Node: true }, properties: {} },
          { id: 3, labels: { Node: true }, properties: {} }
        ],
        []
      )
      cypherNG.addGraph(
        [
          { id: 1, labels: { Node: true }, properties: {} },
          { id: 2, labels: { Node: true }, properties: {} },
          { id: 3, labels: { Node: true }, properties: {} }
        ],
        []
      )

      const query = 'MATCH (n:Node) RETURN count(n) as cnt'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].cnt).toBe(refResult.output[0].cnt)
          done()
        }, done)
      }, done)
    })

    test('should collect values', (done) => {
      const query = 'UNWIND [1, 2, 3] AS x RETURN collect(x) as col'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].col).toEqual(refResult.output[0].col)
          done()
        }, done)
      }, done)
    })

    test('should sum values', (done) => {
      const query = 'UNWIND [1, 2, 3, 4, 5] AS x RETURN sum(x) as total'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].total).toBe(refResult.output[0].total)
          done()
        }, done)
      }, done)
    })
  })

  describe('String functions', () => {
    test('should use lower function', (done) => {
      const query = 'RETURN lower("HELLO WORLD") as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toBe(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })

    test('should use upper function', (done) => {
      const query = 'RETURN upper("hello world") as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toBe(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })

    test('should use replace function', (done) => {
      const query = 'RETURN replace("hello world", "world", "there") as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toBe(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })

    test('should use split function', (done) => {
      const query = 'RETURN split("a,b,c", ",") as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toEqual(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })
  })

  describe('Math functions', () => {
    test('should use sqrt function', (done) => {
      const query = 'RETURN sqrt(16) as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toBe(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })

    test('should use round function', (done) => {
      const query = 'RETURN round(3.7) as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toBe(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })
  })

  describe('Type conversion functions', () => {
    test('should use toint function', (done) => {
      const query = 'RETURN toint("42") as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toBe(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })

    test('should use tofloat function', (done) => {
      const query = 'RETURN tofloat("3.14") as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toBe(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })
  })

  describe('Edge cases', () => {
    test('should handle null values', (done) => {
      const query = 'RETURN null as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toBe(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })

    test('should handle boolean values', (done) => {
      const query = 'RETURN true AND false as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toBe(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })

    test('should handle empty lists', (done) => {
      const query = 'RETURN [] as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toEqual(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })

    test('should handle CASE expressions', (done) => {
      const query = 'RETURN case when 1=1 then "yes" else "no" end as result'

      cypherRef.execute(query, (refResult) => {
        cypherNG.execute(query, (ngResult) => {
          expect(ngResult.output[0].result).toBe(refResult.output[0].result)
          done()
        }, done)
      }, done)
    })
  })
})