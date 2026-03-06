const { _Function } = require('../../../js/CypherNG/parser/Functions.js');

function parameter(value) {
    return { value: () => value, groupByKey: () => value, groupByValue: () => value };
}

describe('CypherNG scalar function evaluations', () => {
    test('evaluates math and constant helpers', () => {
        _Function.f.exp.p = [parameter(1)];
        _Function.f.sqrt.p = [parameter(9)];
        _Function.f.log.p = [parameter(8), parameter(2)];
        _Function.f.ln.p = [parameter(Math.E)];
        _Function.f.sin.p = [parameter(0)];
        _Function.f.cos.p = [parameter(0)];
        _Function.f.round.p = [parameter(3.6)];

        expect(_Function.f.PI.value.call(_Function.f.PI)).toBe(Math.PI);
        expect(_Function.f.E.value.call(_Function.f.E)).toBe(Math.E);
        expect(_Function.f.exp.value.call(_Function.f.exp)).toBeCloseTo(Math.E);
        expect(_Function.f.sqrt.value.call(_Function.f.sqrt)).toBe(3);
        expect(_Function.f.log.value.call(_Function.f.log)).toBe(3);
        expect(_Function.f.ln.value.call(_Function.f.ln)).toBeCloseTo(1);
        expect(_Function.f.sin.value.call(_Function.f.sin)).toBe(0);
        expect(_Function.f.cos.value.call(_Function.f.cos)).toBe(1);
        expect(_Function.f.round.value.call(_Function.f.round)).toBe(4);
        expect(_Function.f.rand.non_deterministic).toBe(true);
    });

    test('evaluates graph/list/lookup/string/conversion helpers', () => {
        const node = { id: () => 7, getLabels: () => ['Person'], getProperties: () => ({ name: 'A' }) };
        const rel = { getType: () => 'KNOWS', startNode: () => 'start', endNode: () => 'end' };
        const path = { getNodes: () => ['n1'], getRelationships: () => ['r1'] };
        const keyed = { getKeys: () => ['x', 'y'] };
        const propertyCarrier = { getProperty: (key) => ({ foo: 1 })[key] };
        const fallbackString = { toString: () => { throw new Error('nope'); }, valueOf: () => 15 };
        const circular = {}; circular.self = circular;

        _Function.f.id.p = [parameter(node)];
        _Function.f.labels.p = [parameter(node)];
        _Function.f.type.p = [parameter(rel)];
        _Function.f.startnode.p = [parameter(rel)];
        _Function.f.endnode.p = [parameter(rel)];
        _Function.f.properties.p = [parameter(node)];
        _Function.f.exists.p = [parameter(undefined)];
        _Function.f.keys.p = [parameter(keyed)];
        expect(_Function.f.id.value.call(_Function.f.id)).toBe(7);
        expect(_Function.f.labels.value.call(_Function.f.labels)).toEqual(['Person']);
        expect(_Function.f.type.value.call(_Function.f.type)).toBe('KNOWS');
        expect(_Function.f.startnode.value.call(_Function.f.startnode)).toBe('start');
        expect(_Function.f.endnode.value.call(_Function.f.endnode)).toBe('end');
        expect(_Function.f.properties.value.call(_Function.f.properties)).toEqual({ name: 'A' });
        expect(_Function.f.exists.value.call(_Function.f.exists)).toBe(false);
        expect(_Function.f.keys.value.call(_Function.f.keys)).toEqual(['x', 'y']);
        _Function.f.keys.p = [parameter({ a: 1, b: 2 })];
        expect(_Function.f.keys.value.call(_Function.f.keys)).toEqual(['a', 'b']);

        _Function.f.nodes.p = [parameter(path)];
        _Function.f.relationships.p = [parameter(path)];
        _Function.f.head.p = [parameter([1, 2, 3])];
        _Function.f.last.p = [parameter([1, 2, 3])];
        _Function.f.size.p = [parameter([1, 2, 3])];
        _Function.f.object_lookup.p = [parameter(propertyCarrier), parameter('foo')];
        _Function.f.array_lookup.p = [parameter(['a', 'b', 'c']), parameter(1)];
        expect(_Function.f.nodes.value.call(_Function.f.nodes)).toEqual(['n1']);
        expect(_Function.f.relationships.value.call(_Function.f.relationships)).toEqual(['r1']);
        expect(_Function.f.head.value.call(_Function.f.head)).toBe(1);
        expect(_Function.f.last.value.call(_Function.f.last)).toBe(3);
        expect(_Function.f.size.value.call(_Function.f.size)).toBe(3);
        expect(_Function.f.object_lookup.value.call(_Function.f.object_lookup)).toBe(1);
        expect(_Function.f.array_lookup.value.call(_Function.f.array_lookup)).toBe('b');
        _Function.f.object_lookup.p = [parameter({ bar: 2 }), parameter('bar')];
        _Function.f.array_lookup.p = [parameter(['a', 'b', 'c']), parameter([0, 2])];
        expect(_Function.f.object_lookup.value.call(_Function.f.object_lookup)).toBe(2);
        expect(_Function.f.array_lookup.value.call(_Function.f.array_lookup)).toEqual(['a', 'c']);

        _Function.f.split.p = [parameter('a,b,c'), parameter(',')];
        _Function.f.join.p = [parameter(['a', 'b', 'c']), parameter('-')];
        _Function.f.trim.p = [parameter('  hi  ')];
        _Function.f.lower.p = [parameter('AbC')];
        _Function.f.upper.p = [parameter('AbC')];
        _Function.f.replace.p = [parameter('a-b-a'), parameter('a'), parameter('x')];
        expect(Array.from(_Function.f.split.value.call(_Function.f.split))).toEqual(['a', 'b', 'c']);
        expect(_Function.f.join.value.call(_Function.f.join)).toBe('a-b-c');
        expect(_Function.f.trim.value.call(_Function.f.trim)).toBe('hi');
        expect(_Function.f.lower.value.call(_Function.f.lower)).toBe('abc');
        expect(_Function.f.upper.value.call(_Function.f.upper)).toBe('ABC');
        expect(_Function.f.replace.value.call(_Function.f.replace)).toBe('x-b-x');

        _Function.f.tofloat.p = [parameter('3.14')];
        _Function.f.tostring.p = [parameter(fallbackString)];
        _Function.f.stringify.p = [parameter({ a: 1 }), parameter(2)];
        _Function.f.todate.p = [parameter('2024-01-01T00:00:00Z')];
        _Function.f.tojson.p = [parameter('{"x":1}')];
        _Function.f.range.p = [parameter(1), parameter(5), parameter(2)];
        _Function.f.coalesce.p = [parameter(null), parameter('fallback')];
        _Function.f.not.p = [parameter(false)];
        expect(_Function.f.tofloat.value.call(_Function.f.tofloat)).toBeCloseTo(3.14);
        expect(_Function.f.tostring.value.call(_Function.f.tostring)).toBe('15');
        expect(_Function.f.stringify.value.call(_Function.f.stringify)).toContain('"a": 1');
        _Function.f.stringify.p = [parameter(circular), parameter(2)];
        expect(_Function.f.stringify.value.call(_Function.f.stringify)).toBe(null);
        expect(_Function.f.todate.value.call(_Function.f.todate)).toBeInstanceOf(Date);
        expect(_Function.f.tojson.value.call(_Function.f.tojson)).toEqual({ x: 1 });
        expect(Array.from(_Function.f.range.value.call(_Function.f.range))).toEqual([1, 3]);
        expect(_Function.f.coalesce.value.call(_Function.f.coalesce)).toBe('fallback');
        expect(_Function.f.timestamp.value.call(_Function.f.timestamp)).toBeInstanceOf(Date);
        expect(_Function.f.not.value.call(_Function.f.not)).toBe(true);

        _Function.f.range.p = [parameter(1), parameter(5), parameter(0)];
        expect(Array.from(_Function.f.range.value.call(_Function.f.range))).toEqual([1, 2, 3, 4]);
    });
});