const { CypherNG, executeQuery } = require('../../parity/helpers/engines');

describe('CypherNG parser branches', () => {
    test.each([
        {
            name: 'WITH expressions must be aliased',
            query: 'WITH 1 + 2 RETURN 3',
            error: /Expression in WITH must be aliased/
        },
        {
            name: 'CASE requires at least one WHEN branch',
            query: 'RETURN CASE ELSE 1 END',
            error: /Expected WHEN keyword/
        },
        {
            name: 'CASE requires END keyword',
            query: 'RETURN CASE WHEN 1=1 THEN 1',
            error: /Expected END keyword/
        },
        {
            name: 'lists require a closing bracket',
            query: 'RETURN [1,2',
            error: /Expected closing bracket/
        },
        {
            name: 'object literals require colons',
            query: 'RETURN {a 1}',
            error: /Expected colon/
        },
        {
            name: 'pattern property maps require colons',
            query: 'CREATE (n {a 1}) RETURN n',
            error: /Expected colon/
        },
        {
            name: 'predicate functions require WHERE',
            query: 'WITH [1,2] AS nums RETURN all(x IN nums x > 0)',
            error: /Expected WHERE-keyword/
        },
        {
            name: 'variables are rejected in LIMIT context',
            query: 'RETURN 1 LIMIT foo',
            error: /Variables not allowed within this context/
        },
        {
            name: 'graph patterns require closing parentheses',
            query: 'MATCH (n RETURN n',
            error: /Expecting closing parentheses/
        },
        {
            name: 'array lookups require a closing square bracket',
            query: 'RETURN [1,2,3][0,2] AS picked',
            error: /Expected closing square bracket/
        }
    ])('$name', async ({ query, error }) => {
        const result = await executeQuery(CypherNG, query);

        expect(result.ok).toBe(false);
        expect(result.error).toMatch(error);
    });

    test.each([
        {
            name: 'CASE expressions parse nested WHEN branches',
            query: "RETURN CASE WHEN 1=1 THEN 'a' WHEN 1=0 THEN 'b' ELSE 'c' END AS v",
            output: [{ v: 'a' }]
        },
        {
            name: 'list lookups parse successfully',
            query: 'RETURN [1,2][0] AS n',
            output: [{ n: 1 }]
        },
        {
            name: 'object lookups parse successfully',
            query: 'RETURN {a:1}.a AS n',
            output: [{ n: 1 }]
        },
        {
            name: 'WITH parses multiple aliases plus WHERE filters',
            query: 'WITH 1 AS x, 2 AS y WHERE x < y RETURN x',
            output: [{ x: 1 }]
        }
    ])('$name', async ({ query, output }) => {
        const result = await executeQuery(CypherNG, query);

        expect(result).toEqual({
            ok: true,
            result: {
                output,
                graph: { nodes: [], links: [] },
                stats: { nodesAdded: 0, relationshipsAdded: 0 }
            }
        });
    });
});