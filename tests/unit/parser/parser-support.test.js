const { KeyWord } = require('../../../js/CypherNG/parser/KeyWords.js');
const { Operator } = require('../../../js/CypherNG/parser/Operators.js');
const { _Function } = require('../../../js/CypherNG/parser/Functions.js');
const { AggregateFunction } = require('../../../js/CypherNG/parser/AggregateFunctions.js');
const { PredicateFunctionLookup } = require('../../../js/CypherNG/parser/PredicateFunctionLookup.js');
const { Trie } = require('../../../js/CypherNG/parser/Trie.js');

function parameter(value) {
    return { value: () => value, groupByKey: () => value, groupByValue: () => value };
}

function createGroupByStub() {
    const reducers = {};
    return {
        addReducer() {
            const id = Object.keys(reducers).length;
            reducers[id] = {};
            return id;
        },
        getReducer(id) {
            reducers[id] = reducers[id] || {};
            return reducers[id];
        }
    };
}

describe('CypherNG parser support modules', () => {
    test('keywords are recognized and dispatch actions', () => {
        const calls = [];
        const engine = {
            create: () => calls.push('create'),
            _with: () => calls.push('with'),
            unwind: () => calls.push('unwind')
        };

        expect(KeyWord.isKeyWord('CREATE (n)', 0)).toBeGreaterThan(0);
        expect(KeyWord.latestParsed.displayValue()).toBe('CREATE');
        KeyWord.f.CREATE.action(engine);
        KeyWord.f.WITH.action(engine);
        KeyWord.f.UNWIND.action(engine);

        expect(calls).toEqual(['create', 'with', 'unwind']);
    });

    test('operators expose precedence and evaluate values', () => {
        expect(Operator.isOperator('a>=b', 1)).toBeGreaterThan(0);
        expect(Operator.latestParsed.displayValue()).toBe('>=');
        expect(Operator.f.PLUS.value.call({ lhs: parameter(2), rhs: parameter(3) })).toBe(5);
        expect(Operator.f.IN.value.call({ lhs: parameter('b'), rhs: parameter(['a', 'b']) })).toBe(true);
        expect(Operator.f.AND.value.call({ lhs: parameter(true), rhs: parameter(false) })).toBe(false);
    });

    test('scalar functions parse and evaluate common helpers', () => {
        expect(_Function.isFunction('tojson({})', 0)).toBeGreaterThan(0);
        expect(_Function.latestParsed.displayValue()).toBe('tojson');

        _Function.f.toint.p = [parameter('42')];
        _Function.f.tojson.p = [parameter('{"a":1}')];
        _Function.f.range.p = [parameter(1), parameter(5), parameter(2)];
        _Function.f.coalesce.p = [parameter(null), parameter('fallback')];
        _Function.f.not.p = [parameter(false)];

        expect(_Function.f.toint.value.call(_Function.f.toint)).toBe(42);
        expect(_Function.f.tojson.value.call(_Function.f.tojson)).toEqual({ a: 1 });
        expect(Array.from(_Function.f.range.value.call(_Function.f.range))).toEqual([1, 3]);
        expect(_Function.f.coalesce.value.call(_Function.f.coalesce)).toBe('fallback');
        expect(_Function.f.not.value.call(_Function.f.not)).toBe(true);
        expect(() => _Function.f.range.verifyParsedParameterCount(1)).toThrow();
    });

    test('aggregate functions initialize, reduce, and expose values', () => {
        expect(AggregateFunction.isAggregateFunction('count(1)', 0)).toBeGreaterThan(0);
        expect(AggregateFunction.latestParsed.displayValue()).toBe('count');

        const groupBy = createGroupByStub();
        const reducerId = groupBy.addReducer();

        const countCtx = {
            p: [parameter(1)],
            getGroupBy: () => groupBy,
            getReducerId: () => reducerId,
            distinct: () => false,
            initializeIfNecessary() {
                AggregateFunction.f.count.initialize.call(this);
            }
        };
        AggregateFunction.f.count.aggregate.call(countCtx);
        AggregateFunction.f.count.aggregate.call(countCtx);
        expect(AggregateFunction.f.count.value.call(countCtx)).toBe(2);

        const collectReducerId = groupBy.addReducer();
        const collectCtx = {
            p: [parameter('x')],
            getGroupBy: () => groupBy,
            getReducerId: () => collectReducerId,
            distinct: () => false,
            initializeIfNecessary() {
                AggregateFunction.f.collect.initialize.call(this);
            }
        };
        AggregateFunction.f.collect.aggregate.call(collectCtx);
        AggregateFunction.f.collect.aggregate.call(collectCtx);
        expect(Array.from(AggregateFunction.f.collect.value.call(collectCtx))).toEqual(['x', 'x']);
    });

    test('predicate lookups and trie helpers recognize function names', () => {
        expect(PredicateFunctionLookup.isPredicateFunction('all(x IN y)', 0)).toBeGreaterThan(0);
        expect(PredicateFunctionLookup.latestParsed.displayValue()).toBe('all');

        const namespace = { latestParsed: null };
        const trie = Trie.buildTrie({
            MATCH: { displayValue: () => 'MATCH' },
            MERGE: { displayValue: () => 'MERGE' }
        });

        expect(Trie.isF(namespace, trie, 'MATCH (n)', 0)).toBe(5);
        expect(namespace.latestParsed.displayValue()).toBe('MATCH');
        expect(Trie.isF(namespace, trie, 'MISS', 0)).toBe(0);
    });
});