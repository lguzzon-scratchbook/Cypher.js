const { runTwinQuery } = require('./helpers/engines');
const { normalizeExecution } = require('./helpers/normalizeResult');

describe('Cypher parity: SET behavior', () => {
    test.each([
        {
            name: 'property assignment matches legacy output',
            query: "CREATE (n {name:'Alice'}) SET n.name = 'Bob' RETURN n.name AS name"
        },
        {
            name: 'map assignment matches legacy output',
            query: "CREATE (n {name:'Alice'}) SET n += {age: 30, city: 'Paris'} RETURN n.name AS name, n.age AS age, n.city AS city"
        },
        {
            name: 'label assignment matches legacy output',
            query: "CREATE (n) SET n:'Person' RETURN labels(n) AS labels"
        },
        {
            name: 'relationship type assignment matches legacy output',
            query: "CREATE ()-[r]->() SET r:'KNOWS' RETURN type(r) AS relType"
        },
        {
            name: 'invalid scalar label assignment matches legacy error',
            query: "WITH 1 AS x SET x:'Nope' RETURN x"
        },
        {
            name: 'invalid scalar map assignment matches legacy error',
            query: 'WITH 1 AS x SET x += {a:1} RETURN x'
        }
    ])('$name', async ({ query }) => {
        const { legacy, ng } = await runTwinQuery(query);

        expect(normalizeExecution(ng)).toEqual(normalizeExecution(legacy));
    });
});