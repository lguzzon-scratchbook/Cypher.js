const { runTwinQuery } = require('./helpers/engines');
const { normalizeExecution } = require('./helpers/normalizeResult');

describe('Cypher parity: advanced expressions and aggregations', () => {
    test.each([
        {
            name: 'CASE expression matches legacy output',
            query: 'RETURN CASE WHEN 1=1 THEN 1 ELSE 0 END'
        },
        {
            name: 'tojson map access matches legacy output',
            query: "RETURN tojson('{\"a\":1}').a"
        },
        {
            name: 'collect distinct over maps matches legacy output',
            query: "UNWIND [{k:'a', v:1}, {k:'b', v:2}] AS e RETURN collect(distinct e)"
        },
        {
            name: 'barchart aggregation matches legacy output',
            query: "UNWIND ['a','a','b'] AS e WITH barchart(e) AS bc RETURN bc.a AS a, bc.b AS b"
        },
        {
            name: 'range and array lookup semantics match legacy output',
            query: 'WITH range(1,5,2) AS nums RETURN nums[1] AS second'
        }
    ])('$name', async ({ query }) => {
        const { legacy, ng } = await runTwinQuery(query);

        expect(normalizeExecution(ng)).toEqual(normalizeExecution(legacy));
    });
});