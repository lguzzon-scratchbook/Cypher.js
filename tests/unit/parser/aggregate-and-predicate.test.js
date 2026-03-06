const { AggregateFunction } = require('../../../js/CypherNG/parser/AggregateFunctions.js');
const { Predicate } = require('../../../js/CypherNG/structures/Predicate.js');

function parameter(value) {
    return { value: () => value, groupByKey: () => value, groupByValue: () => value };
}

function createGroupByStub() {
    const reducers = {};
    return {
        addReducer() { const id = Object.keys(reducers).length; reducers[id] = {}; return id; },
        getReducer(id) { reducers[id] = reducers[id] || {}; return reducers[id]; }
    };
}

function ctx(groupBy, reducerId, value, distinct = false) {
    return {
        p: [parameter(value)],
        getGroupBy: () => groupBy,
        getReducerId: () => reducerId,
        distinct: () => distinct,
        initializeIfNecessary() { this.element.initialize.call(this); },
        element: null
    };
}

describe('CypherNG aggregate functions and predicates', () => {
    test('evaluates aggregate functions across reducers', () => {
        const gb = createGroupByStub();

        const sum = ctx(gb, gb.addReducer(), 2); sum.element = AggregateFunction.f.sum;
        AggregateFunction.f.sum.aggregate.call(sum); sum.p = [parameter(5)]; AggregateFunction.f.sum.aggregate.call(sum);
        expect(Number(AggregateFunction.f.sum.value.call(sum))).toBe(7);

        const bar = ctx(gb, gb.addReducer(), { groupByKey: () => 'a' }); bar.element = AggregateFunction.f.barchart;
        AggregateFunction.f.barchart.aggregate.call(bar); AggregateFunction.f.barchart.aggregate.call(bar);
        bar.p = [parameter({ groupByKey: () => 'b' })]; AggregateFunction.f.barchart.aggregate.call(bar);
        expect(AggregateFunction.f.barchart.value.call(bar)).toMatchObject({ a: 2, b: 1 });

        const hist = { ...ctx(gb, gb.addReducer(), 1), p: [parameter(1), parameter(2)] }; hist.element = AggregateFunction.f.histogram;
        AggregateFunction.f.histogram.aggregate.call(hist); hist.p = [parameter(3), parameter(2)]; AggregateFunction.f.histogram.aggregate.call(hist);
        expect(Array.from(AggregateFunction.f.histogram.value.call(hist))).toHaveLength(2);

        const min = ctx(gb, gb.addReducer(), 5); min.element = AggregateFunction.f.min;
        AggregateFunction.f.min.aggregate.call(min); min.p = [parameter(2)]; AggregateFunction.f.min.aggregate.call(min);
        expect(AggregateFunction.f.min.value.call(min)).toBe(2);

        const max = ctx(gb, gb.addReducer(), 5); max.element = AggregateFunction.f.max;
        AggregateFunction.f.max.aggregate.call(max); max.p = [parameter(8)]; AggregateFunction.f.max.aggregate.call(max);
        expect(AggregateFunction.f.max.value.call(max)).toBe(8);

        const count = ctx(gb, gb.addReducer(), 'x'); count.element = AggregateFunction.f.count;
        AggregateFunction.f.count.aggregate.call(count); AggregateFunction.f.count.aggregate.call(count);
        expect(Number(AggregateFunction.f.count.value.call(count))).toBe(2);
        const countDistinct = ctx(gb, gb.addReducer(), 'x', true); countDistinct.element = AggregateFunction.f.count;
        AggregateFunction.f.count.aggregate.call(countDistinct); AggregateFunction.f.count.aggregate.call(countDistinct);
        countDistinct.p = [parameter('y')]; AggregateFunction.f.count.aggregate.call(countDistinct);
        expect(AggregateFunction.f.count.value.call(countDistinct)).toBe(2);

        const stdev = ctx(gb, gb.addReducer(), 2); stdev.element = AggregateFunction.f.stdev;
        [2, 4, 4, 4, 5, 5, 7, 9].forEach((n) => { stdev.p = [parameter(n)]; AggregateFunction.f.stdev.aggregate.call(stdev); });
        expect(AggregateFunction.f.stdev.value.call(stdev)).toBeCloseTo(2.138, 2);

        const collect = ctx(gb, gb.addReducer(), 'x'); collect.element = AggregateFunction.f.collect;
        AggregateFunction.f.collect.aggregate.call(collect); collect.p = [parameter('y')]; AggregateFunction.f.collect.aggregate.call(collect);
        expect(Array.from(AggregateFunction.f.collect.value.call(collect))).toEqual(['x', 'y']);
        const distinctCollect = ctx(gb, gb.addReducer(), { groupByKey: () => 'k1', valueOf: () => 'x' }, true); distinctCollect.element = AggregateFunction.f.collect;
        AggregateFunction.f.collect.aggregate.call(distinctCollect); AggregateFunction.f.collect.aggregate.call(distinctCollect);
        distinctCollect.p = [parameter({ groupByKey: () => 'k2', valueOf: () => 'y' })]; AggregateFunction.f.collect.aggregate.call(distinctCollect);
        expect(AggregateFunction.f.collect.value.call(distinctCollect)).toHaveLength(2);
    });

    test('evaluates predicate all/any/sum and validation errors', () => {
        const makePredicate = (name, list, predicateFn) => {
            const p = new Predicate();
            p.setPredicateFunctionName(name);
            p.variable('x');
            p.list({ value: () => list });
            p.where({ setLocalVariable: jest.fn(), value: predicateFn });
            return p;
        };

        expect(makePredicate('all', [2, 4, 6], () => true).value()).toBe(true);
        expect(makePredicate('any', [1, 3, 5], () => false).value()).toBe(false);
        let count = 0;
        const sumPredicate = makePredicate('sum', [1, 2, 3], () => ++count < 3);
        expect(sumPredicate.get()).toBe(2);
        expect(sumPredicate.next()).toBe(false);
        expect(sumPredicate.hasNext()).toBe(true);
        sumPredicate.reset();
        expect(sumPredicate.getData()).toBe(sumPredicate);
        expect(sumPredicate.type()).toBe('Predicate');

        const invalid = new Predicate();
        invalid.setPredicateFunctionName('all');
        invalid.variable('x');
        invalid.list({ value: () => ({ not: 'array' }) });
        invalid.where({ value: () => true });
        expect(() => invalid.value()).toThrow(/must be an array/);
    });
});