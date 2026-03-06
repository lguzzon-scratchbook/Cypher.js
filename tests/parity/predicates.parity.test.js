const { runTwinQuery } = require('./helpers/engines');
const { normalizeExecution } = require('./helpers/normalizeResult');

describe('Cypher parity: predicate functions', () => {
    test.each([
        {
            name: 'all predicate matches legacy output',
            query: 'WITH [2,4,6,8] AS nums RETURN all(x IN nums WHERE x > 0) AS allPositive, all(x IN nums WHERE x > 5) AS allGreaterThan5'
        },
        {
            name: 'any predicate matches legacy output',
            query: 'WITH [1,3,5,7] AS nums RETURN any(x IN nums WHERE x = 5) AS hasFound, any(x IN nums WHERE x > 10) AS hasLarge'
        },
        {
            name: 'sum predicate matches legacy output',
            query: 'WITH [1,2,3] AS nums RETURN sum(x IN nums WHERE x > 1) AS c'
        },
        {
            name: 'predicate WHERE expressions with logical operators match legacy output',
            query: 'WITH [1,2,3] AS nums RETURN all(x IN nums WHERE x >= 1 AND x <= 3) AS ok, sum(x IN nums WHERE x % 2 = 1) AS oddCount'
        },
        {
            name: 'empty-list predicate semantics match legacy output',
            query: 'WITH [] AS nums RETURN all(x IN nums WHERE x > 0) AS allEmpty, any(x IN nums WHERE x > 0) AS anyEmpty, sum(x IN nums WHERE x > 0) AS sumEmpty'
        }
    ])('$name', async ({ query }) => {
        const { legacy, ng } = await runTwinQuery(query);

        expect(normalizeExecution(ng)).toEqual(normalizeExecution(legacy));
    });
});