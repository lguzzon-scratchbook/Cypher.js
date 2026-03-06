const CypherNGDirect = require('../../../js/CypherNG/CypherNG.js');
const CypherNGFromIndex = require('../../../js/CypherNG/index.js');

function executeQuery(cypher, query) {
    return new Promise((resolve) => {
        cypher.execute(
            query,
            (result) => resolve({ ok: true, result }),
            (error) => resolve({ ok: false, error: String(error) })
        );
    });
}

describe('CypherNG direct entry points', () => {
    test('index export points to a constructible implementation', () => {
        expect(typeof CypherNGFromIndex).toBe('function');
        expect(typeof CypherNGDirect).toBe('function');
    });

    test('can configure proxy, add graph data, execute, and reset', async () => {
        const cypher = new CypherNGDirect({ runInWebWorker: false });

        cypher.setDataDownloadProxy('/proxy');
        expect(cypher.getDataDownloadProxy()).toBe('/proxy');

        cypher.addGraph(
            [
                { id: 0, labels: { Seed: true }, properties: { name: 'A' } },
                { id: 1, labels: { Seed: true }, properties: { name: 'B' } }
            ],
            [
                { id: 10, type: 'KNOWS', from: 0, to: 1, properties: { since: 2024 } }
            ]
        );

        const matchResult = await executeQuery(cypher, 'MATCH (n:Seed) RETURN count(1) AS c');
        expect(matchResult.ok).toBe(true);
        expect(Number(matchResult.result.output[0].c)).toBe(2);
        expect(matchResult.result.graph).toEqual({ nodes: [], links: [] });
        expect(matchResult.result.stats).toEqual({ nodesAdded: 0, relationshipsAdded: 0 });

        cypher.resetDataBase();

        const emptyResult = await executeQuery(cypher, 'MATCH (n) RETURN count(1) AS c');
        expect(emptyResult.ok).toBe(true);
        expect(Number(emptyResult.result.output[0].c)).toBe(0);
        expect(emptyResult.result.graph).toEqual({ nodes: [], links: [] });
        expect(emptyResult.result.stats).toEqual({ nodesAdded: 0, relationshipsAdded: 0 });
    });

    test('direct file execution supports core query paths', async () => {
        const cypher = new CypherNGDirect({ runInWebWorker: false });
        const result = await executeQuery(
            cypher,
            "CREATE (a:Person {name:'Alice'})-[r:KNOWS]->(b:Person {name:'Bob'}) RETURN a,r,b"
        );

        expect(result.ok).toBe(true);
        expect(result.result.output).toHaveLength(1);
        expect(result.result.output[0].a.properties.name).toBe('Alice');
        expect(result.result.output[0].b.properties.name).toBe('Bob');
        expect(result.result.output[0].r.type).toBe('KNOWS');
    });
});