const { runTwinQuery } = require('./helpers/engines');
const { normalizeExecution } = require('./helpers/normalizeResult');

describe('Cypher parity: relationship and path bindings', () => {
    test.each([
        {
            name: 'CREATE relationship returns bound endpoints and relationship',
            query: "CREATE (a:Person {name:'Alice'})-[r:KNOWS]->(b:Person {name:'Bob'}) RETURN a,r,b"
        },
        {
            name: 'MERGE relationship returns bound relationship payload',
            query: 'MERGE (a:Node{id:0}) MERGE (b:Node{id:1}) MERGE (a)-[r:TO]->(b) RETURN r'
        },
        {
            name: 'startnode/endnode bindings remain identical after collect and unwind',
            query: 'CREATE (:A)-[:CONNECT]->(:B), (:A)-[:CONNECT]->(:B) MATCH ()-[r]->() WITH collect(r) AS rels UNWIND rels AS rel RETURN startnode(rel), rel, endnode(rel)'
        },
        {
            name: 'variable-length path count matches legacy',
            query: "CREATE (n1:Node{name:'n1'})-[:CONNECTED]->(n2:Node{name:'n2'})-[:CONNECTED]->(n3:Node{name:'n3'}), (n3)-[:CONNECTED]->(n4:Node{name:'n4'}) CREATE (n2)-[:CONNECTED]->(n5:Node{name:'n5'})-[:CONNECTED]->(n3) MATCH p=(:Node)-[:CONNECTED*]->(:Node) RETURN count(1)"
        }
    ])('$name', async ({ query }) => {
        const { legacy, ng } = await runTwinQuery(query);

        expect(normalizeExecution(ng)).toEqual(normalizeExecution(legacy));
    });
});