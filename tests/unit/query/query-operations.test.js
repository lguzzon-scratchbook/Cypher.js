const { Setter } = require('../../../js/CypherNG/query/operations/Setter.js');
const { Inserter } = require('../../../js/CypherNG/query/operations/Inserter.js');
const { Node } = require('../../../js/CypherNG/core/Node.js');
const { NodeReference, RelationshipReference } = require('../../../js/CypherNG/core/References.js');
const { Relationship } = require('../../../js/CypherNG/core/Relationship.js');
const { Unwind } = require('../../../js/CypherNG/query/operations/Unwind.js');

describe('CypherNG operation modules', () => {
    test('Setter applies property, map, label, and type updates and chains operations', () => {
        const setter = new Setter();
        const previousOperation = { variables: () => ['v1'] };
        const nextOperation = { setPreviousOperation: jest.fn(), doIt: jest.fn(), finish: jest.fn() };
        setter.setPreviousOperation(previousOperation);
        setter.setNextOperation(nextOperation);

        const propertyAssignee = { setProperty: jest.fn(), bindProperty: jest.fn() };
        const mapAssignee = { setProperties: jest.fn() };
        const labelAssignee = { setLabel: jest.fn(), getId: () => 7 };
        const typeAssignee = { setType: jest.fn(), id: () => 5 };
        const unwindValue = { constructor: NodeReference, getObject: () => propertyAssignee };

        setter.addSetter({ getObject: () => ({ constructor: Unwind, value: () => unwindValue }) }, 'name', { value: () => 'Alice' });
        setter.addMapSetter({ getObject: () => ({ constructor: RelationshipReference, getObject: () => mapAssignee }) }, { value: () => ({ since: 2024 }) });
        setter.addLabelSetter({ getObject: () => ({ constructor: Node, getData: () => labelAssignee }) }, { value: () => 'Person' });
        setter.addTypeSetter({ getObject: () => ({ constructor: Relationship, getData: () => typeAssignee }) }, { value: () => 'KNOWS' });
        setter.doIt();
        setter.finish();

        expect(propertyAssignee.setProperty).toHaveBeenCalledWith('name', { value: expect.any(Function) });
        expect(propertyAssignee.bindProperty).toHaveBeenCalledWith('name');
        expect(mapAssignee.setProperties).toHaveBeenCalledWith({ since: 2024 });
        expect(labelAssignee.setLabel).toHaveBeenCalledWith('Person', 7);
        expect(typeAssignee.setType).toHaveBeenCalledWith('KNOWS', 5);
        expect(nextOperation.doIt).toHaveBeenCalled();
        expect(nextOperation.finish).toHaveBeenCalled();
        expect(setter.variables()).toEqual(['v1']);
        expect(() => setter.run()).toThrow(/cannot be first/i);
        expect(setter.type()).toBe('Setter');
    });

    test('Setter rejects unsupported assignee types', () => {
        const setter = new Setter();
        setter.addSetter({ getObject: () => ({ constructor: Date }) }, 'x', { value: () => 1 });
        expect(() => setter.doIt()).toThrow(/Cannot assign to object of type/);
    });

    test('Inserter creates table columns, stores values, and chains correctly', () => {
        const tables = [];
        const db = { addTable: (table) => tables.push(table) };
        const inserter = new Inserter(db, 'people');
        const vars = [
            { getObjectKey: () => 'name', value: () => 'Alice' },
            { getObjectKey: () => 'age', value: () => 42 }
        ];
        const previousOperation = {
            variables: () => vars
        };
        const nextOperation = { setPreviousOperation: jest.fn(), doIt: jest.fn(), finish: jest.fn() };

        inserter.setPreviousOperation(previousOperation);
        inserter.setNextOperation(nextOperation);
        inserter.doIt();
        inserter.finish();

        expect(tables).toHaveLength(1);
        expect(tables[0].name()).toBe('people');
        expect(tables[0].getColumn('name').value()).toBe('name');
        expect(tables[0].getColumn('age').value()).toBe('age');
        expect(nextOperation.doIt).toHaveBeenCalled();
        expect(nextOperation.finish).toHaveBeenCalled();
        expect(inserter.variables()).toBe(vars);
        expect(() => inserter.run()).toThrow(/cannot be first/i);
        expect(inserter.type()).toBe('Inserter');
    });
});