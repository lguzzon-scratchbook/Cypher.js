const { runTwinQuery } = require('./helpers/engines');
const { normalizeExecution } = require('./helpers/normalizeResult');

describe('Cypher parity: operators', () => {
    test.each([
        {
            name: 'scalar arithmetic matches legacy output',
            query: 'RETURN 5 + 3 AS add, 10 - 4 AS sub, 6 * 7 AS mul, 20 / 4 AS div'
        },
        {
            name: 'power and modulo match legacy output',
            query: 'RETURN 2 ^ 3 AS pow, 17 % 5 AS mod'
        },
        {
            name: 'list concatenation and difference match legacy output',
            query: 'RETURN [1,2] + [3,4] AS concat, [1,2,3] - [2] AS diff'
        },
        {
            name: 'set union and intersection match legacy output',
            query: 'RETURN [1,2] | [2,3] AS unioned, [1,2,3] & [2,4] AS intersected'
        },
        {
            name: 'comparison and logical precedence match legacy output',
            query: 'RETURN false OR true AND false AS value, 10 >= 10 AS gte, 5 <> 6 AS neq'
        },
        {
            name: 'IN filtering semantics match legacy output',
            query: 'UNWIND [1,2,3,4,5] AS n WITH n WHERE n IN [2,4] RETURN n'
        },
        {
            name: 'invalid IN usage matches legacy error',
            query: 'RETURN 1 IN 3 AS badIn'
        }
    ])('$name', async ({ query }) => {
        const { legacy, ng } = await runTwinQuery(query);

        expect(normalizeExecution(ng)).toEqual(normalizeExecution(legacy));
    });
});