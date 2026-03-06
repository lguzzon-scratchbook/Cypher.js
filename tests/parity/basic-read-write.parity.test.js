const { runTwinQuery } = require('./helpers/engines');
const { normalizeExecution } = require('./helpers/normalizeResult');

describe('Cypher parity: core read/write behavior', () => {
    test.each([
        {
            name: 'MATCH on empty graph returns empty output',
            query: 'MATCH (n) RETURN n'
        },
        {
            name: 'UNWIND returns identical scalar rows',
            query: 'UNWIND [1,2,3] AS x RETURN x'
        },
        {
            name: 'WITH forwards aliased values',
            query: 'WITH 1 AS x RETURN x'
        },
        {
            name: 'CREATE node returns identical node payload',
            query: "CREATE (n:Person {name:'Alice'}) RETURN n"
        },
        {
            name: 'CREATE property projection matches exactly',
            query: "CREATE (n:Person {name:'Alice'}) RETURN n.name AS name"
        },
        {
            name: 'MERGE node returns identical node payload',
            query: "MERGE (n:Person {name:'Alice'}) RETURN n"
        },
        {
            name: 'RETURN of undeclared variable matches error message',
            query: 'RETURN missingVar'
        }
    ])('$name', async ({ query }) => {
        const { legacy, ng } = await runTwinQuery(query);

        expect(normalizeExecution(ng)).toEqual(normalizeExecution(legacy));
    });
});