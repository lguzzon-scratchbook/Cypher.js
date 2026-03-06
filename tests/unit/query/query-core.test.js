const { Statement } = require('../../../js/CypherNG/query/Statement.js');
const { Variable } = require('../../../js/CypherNG/query/Variable.js');
const { Where } = require('../../../js/CypherNG/query/Where.js');
const { ReturnValue } = require('../../../js/CypherNG/query/ReturnValue.js');
const { GroupBy } = require('../../../js/CypherNG/query/GroupBy.js');
const { Return } = require('../../../js/CypherNG/query/Return.js');
const { Expression } = require('../../../js/CypherNG/query/Expression.js');
const { Constant } = require('../../../js/CypherNG/structures/Constant.js');
const { List } = require('../../../js/CypherNG/structures/List.js');
const { AssociativeArray } = require('../../../js/CypherNG/structures/AssociativeArray.js');
const { NodeReference, RelationshipReference } = require('../../../js/CypherNG/core/References.js');

describe('CypherNG query core modules', () => {
    test('Variable unwraps constants, delegates value lookups, and supports overrides', () => {
        const constantVariable = new Variable(new Constant(7), 'n');
        expect(constantVariable.getObjectKey()).toBe('n');
        expect(constantVariable.getObject()).toBe(7);

        const object = { getData: () => ({ get: (key) => (key ? 10 : 5) }) };
        const variable = new Variable(object, 'm');
        expect(variable.value()).toBe(5);
        expect(variable.value('age')).toBe(10);

        variable.setOverriddenValue(99);
        expect(variable.getObject()).toBe(99);
        expect(variable.value()).toBe(99);
        expect(variable.type()).toBe('Variable');
    });

    test('Where and ReturnValue expose aliases, grouping, hidden state, and next actions', () => {
        const addedVariables = [];
        const statement = { addVariable: (key, value) => addedVariables.push([key, value]) };
        const expression = {
            getAlias: () => 'score',
            hasKey: () => true,
            value: () => 3,
            isArray: () => false,
            hasAggregateFunctions: () => false
        };

        const rv = new ReturnValue(expression, statement, { name: 'parent' }, true);
        expect(new Where({ value: () => true }).evaluate()).toBe(true);
        expect(new Where({ value: () => 0 }).evaluate()).toBe(false);
        expect(rv.getAlias()).toBe('score');
        expect(rv.hasKey()).toBe(true);
        expect(rv.value()).toBe(3);
        rv.setGroupByValue(4);
        expect(rv.groupByKey()).toBe(4);
        expect(rv.groupByValue()).toBe(4);
        expect(rv.get()).toBe(4);
        expect(rv.getData()).toBe(rv);
        rv.setAlias('total');
        expect(addedVariables[0][0]).toBe('total');
        rv.setId(2);
        expect(rv.getId()).toBe(2);
        let fired = false;
        rv.setNextAction(() => { fired = true; });
        rv.nextAction();
        expect(fired).toBe(true);
        expect(rv.hidden()).toBe(true);
        expect(rv.parent()).toEqual({ name: 'parent' });
        expect(rv.type()).toBe('ReturnValue');
    });

    test('Expression supports aggregation, aliases, array detection, and local variables', () => {
        const groupBy = { addReducer: jest.fn(() => 0), map: jest.fn() };
        const context = { addReduceExpression: jest.fn(), getGroupBy: () => groupBy };
        const aggregateFn = { setGroupBy: jest.fn(), setReducer: jest.fn(), initialize: jest.fn(), aggregate: jest.fn() };
        const root = {
            value: () => 42,
            mappable: () => true,
            hasKey: () => true,
            element: () => ({ getKey: () => 'implicitAlias' }),
            p: [{ element: () => ({ hasReferredVariables: () => true }) }]
        };
        const expr = new Expression(root, 'fallback', [aggregateFn], context, ['n'], true);

        expect(context.addReduceExpression).toHaveBeenCalledWith(expr);
        expect(expr.getAlias()).toBe('implicitAlias');
        expect(expr.value()).toBe(42);
        expect(expr.getData()).toBe(42);
        expect(expr.variableReferences()).toEqual(['n']);
        expect(expr.hasReferredVariables()).toBe(true);
        expect(expr.hasKey()).toBe(true);
        expect(expr.isReduceExpression()).toBe(true);
        expr.aggregate();
        expect(aggregateFn.aggregate).toHaveBeenCalled();
        expr.setAlias('renamed');
        expect(expr.getAlias()).toBe('renamed');
        expect(expr.hasAggregateFunctions()).toBe(true);
        expect(expr.getAggregateFunctions()).toEqual([aggregateFn]);
        expect(expr.mappable()).toBe(true);
        expr.setLocalVariable('x', 8);
        expect(expr.getLocalVariable('x')).toBe(8);

        const listRoot = { value: () => [], mappable: () => true, element: () => ({ constructor: List, getElements: () => [{ hasAggregateFunctions: true }] }) };
        const assocRoot = { value: () => ({}), mappable: () => true, element: () => ({ constructor: AssociativeArray }) };
        expect(new Expression(listRoot, 'l').isArray()).toBe(true);
        expect(new Expression(assocRoot, 'a').isAssociativeArray()).toBe(true);
    });

    test('GroupBy recodes values, manages reducers, and prints aggregate rows', () => {
        const context = { setNextMapValue: jest.fn(), moveToPreviousMapValue: jest.fn(), addAggregateOutputRecord: jest.fn() };
        const groupBy = new GroupBy(context);
        const db = {
            getNodeById: (id) => ({ toObject: () => ({ id }) }),
            getRelationshipById: (id) => ({ toObject: () => ({ id }) })
        };

        groupBy.beginMap();
        const nonDet = { non_deterministic: () => true, precalculate: jest.fn(), groupByKey: () => new NodeReference(db, 1), groupByValue: () => 'node' };
        groupBy.map(nonDet);
        expect(nonDet.precalculate).toHaveBeenCalled();
        groupBy.beginMap();
        groupBy.map({ non_deterministic: () => false, groupByKey: () => [1, 2], groupByValue: () => 'array' });
        const reducerIdx = groupBy.addReducer();
        expect(groupBy.getReducer(reducerIdx)).toEqual({});
        groupBy.print();
        expect(context.setNextMapValue).toHaveBeenCalled();
        expect(context.moveToPreviousMapValue).toHaveBeenCalled();
        expect(context.addAggregateOutputRecord).toHaveBeenCalled();
        expect(groupBy.getTrieRoot()).toBeTruthy();
    });

    test('Statement manages operations, variables, output graph, and success callbacks', () => {
        const statement = new Statement({ name: 'engine' });
        const op1 = { type: () => 'Match', setNextOperation: jest.fn() };
        const op2 = { type: () => 'Return', setNextOperation: jest.fn() };
        statement.addOperation(op1);
        statement.addOperation(op2);
        expect(op1.setNextOperation).toHaveBeenCalledWith(op2);
        expect(() => statement.addOperation({ type: () => 'Create', setNextOperation: jest.fn() })).toThrow(/one return statement/i);

        statement.setContext({ type: () => 'Temp' });
        expect(statement.context().type()).toBe('Temp');
        statement.resetContext();
        expect(statement.context()).toBe(op2);

        statement.addVariable('x', { getData: () => ({ get: () => 1 }) });
        expect(statement.hasVariable('x')).toBe(true);
        expect(statement.getVariable('x').value()).toBe(1);
        expect(statement.getLastVariable().getObjectKey()).toBe('x');
        expect(() => statement.addVariable('x', { getData: () => ({ get: () => 2 }) })).toThrow(/already declared/i);
        expect(() => statement.getVariable('missing')).toThrow(/has not been declared/i);

        statement.setPropertyKey('name');
        expect(statement.getPropertyKey()).toBe('name');

        const db = {
            getNodeById: (id) => ({ toObject: () => ({ id, labels: ['L'], properties: { id } }) }),
            getRelationshipById: (id) => ({ toObject: () => ({ id, type: 'R', fromNode: { id: () => 1 }, toNode: { id: () => 2 }, properties: {} }) })
        };
        statement.addOutputRecord();
        statement.addOutputEntry('dup', 1, 0);
        statement.addOutputEntry('dup', 2, 1);
        statement.addOutputEntry('entities', [new NodeReference(db, 1), new NodeReference(db, 2), new RelationshipReference(db, 5)], 2);
        statement.setNodesAdded(2);
        statement.setRelationshipsAdded(1);
        const results = statement.results();
        expect(results.output[0]).toMatchObject({ dup: 1, dup1: 2 });
        expect(results.graph.nodes).toHaveLength(2);
        expect(results.graph.links).toHaveLength(1);
        expect(results.stats).toEqual({ nodesAdded: 2, relationshipsAdded: 1 });

        const success = jest.fn();
        statement.setSuccessCallback(success);
        statement.success();
        expect(success).toHaveBeenCalledWith(statement.results());

        statement.clear();
        expect(statement.operations()).toEqual([]);
        expect(statement.variables()).toEqual([]);
    });

    test('Return handles basic rows, filtering, limits, chaining, and grouped output', () => {
        const rows = [];
        const statement = {
            addOutputRecord: jest.fn(() => rows.push({})),
            addOutputEntry: jest.fn((key, value) => { rows[rows.length - 1][key] = value; }),
            getVariable: jest.fn((key) => ({ getObjectKey: () => key })),
            success: jest.fn()
        };
        const makeExpr = (alias, value, options = {}) => ({
            getAlias: () => alias,
            hasKey: () => false,
            value: () => value,
            isReduceExpression: () => !!options.reduce,
            mappable: () => options.mappable !== false,
            hasReferredVariables: () => !!options.refs,
            isArray: () => false,
            isAssociativeArray: () => false,
            aggregate: options.aggregate || jest.fn()
        });

        const ret = new Return(statement);
        ret.expression(makeExpr('a', 1));
        ret.where({ value: () => true });
        ret.limit({ value: () => 1 });
        const nextOperation = { setPreviousOperation: jest.fn(), doIt: jest.fn(), finish: jest.fn() };
        ret.setNextOperation(nextOperation);
        ret.doIt();
        ret.doIt();
        ret.finish();
        expect(statement.addOutputRecord).toHaveBeenCalledTimes(1);
        expect(statement.addOutputEntry).toHaveBeenCalledWith('a', 1, 0);
        expect(nextOperation.doIt).toHaveBeenCalledTimes(1);
        expect(nextOperation.finish).toHaveBeenCalled();
        expect(ret.variables()).toEqual([{ getObjectKey: expect.any(Function) }]);
        expect(ret.type()).toBe('Return');

        const groupedRows = [];
        const groupedStatement = {
            addOutputRecord: jest.fn(() => groupedRows.push({})),
            addOutputEntry: jest.fn((key, value) => { groupedRows[groupedRows.length - 1][key] = value; }),
            getVariable: jest.fn((key) => ({ getObjectKey: () => key })),
            success: jest.fn()
        };
        const grouped = new Return(groupedStatement);
        grouped.getGroupBy();
        const groupedExpr = makeExpr('g', 'v', {
            aggregate: () => grouped.getGroupBy().map({ non_deterministic: () => false, groupByKey: () => 'k', groupByValue: () => 'v' })
        });
        grouped.expression(groupedExpr);
        grouped.addReduceExpression({ aggregate: jest.fn() });
        grouped.doIt();
        grouped.finish();
        expect(grouped.hasGroupBy()).toBe(true);
        expect(grouped.doItCount()).toBe(1);
        expect(groupedStatement.addOutputEntry).toHaveBeenCalledWith('g', 'v', 0);
        expect(groupedStatement.success).toHaveBeenCalled();
    });
});