/**
 * Unit tests for CypherNG modules
 */

const { StringRecoder } = require('../../js/CypherNG/core/StringRecoder.js');
const { IDFactory } = require('../../js/CypherNG/core/IDFactory.js');
const { Node } = require('../../js/CypherNG/core/Node.js');
const { Relationship } = require('../../js/CypherNG/core/Relationship.js');
const { Pattern } = require('../../js/CypherNG/core/Pattern.js');
const { List } = require('../../js/CypherNG/types/List.js');
const { AssociativeArray } = require('../../js/CypherNG/types/AssociativeArray.js');
const { Case } = require('../../js/CypherNG/types/Case.js');
const { Predicate } = require('../../js/CypherNG/types/Predicate.js');
const { Table } = require('../../js/CypherNG/types/Table.js');
const { TableColumn } = require('../../js/CypherNG/types/TableColumn.js');
const { HTTP } = require('../../js/CypherNG/network/HTTP.js');
const { StorageAdapter } = require('../../js/CypherNG/persistence/adapters/StorageAdapter.js');
const { GraphSerializer } = require('../../js/CypherNG/persistence/serializers/GraphSerializer.js');

describe('CypherNG Core Modules', () => {
  describe('StringRecoder', () => {
    test('should recode strings to integers', () => {
      const recoder = new StringRecoder();
      const code1 = recoder.recode('test');
      const code2 = recoder.recode('test');
      const code3 = recoder.recode('other');

      expect(typeof code1).toBe('number');
      expect(code1).toBe(code2); // Same string = same code
      expect(code1).not.toBe(code3); // Different string = different code
    });

    test('should handle falsy values', () => {
      const recoder = new StringRecoder();
      expect(recoder.recode(null)).toBe(null);
      expect(recoder.recode(undefined)).toBe(undefined);
      expect(recoder.recode('')).toBe('');
    });

    test('should convert non-strings to strings', () => {
      const recoder = new StringRecoder();
      const code1 = recoder.recode(123);
      const code2 = recoder.recode('123');

      expect(typeof code1).toBe('number');
      expect(code1).toBe(code2);
    });

    test('should reset correctly', () => {
      const recoder = new StringRecoder();
      const code1 = recoder.recode('test');
      recoder.reset();
      const code2 = recoder.recode('test');

      // After reset, the recoder starts fresh, so same string gets code 1 again
      expect(code1).toBe(code2);
      expect(code1).toBe(1);
    });
  });

  describe('IDFactory', () => {
    test('should generate sequential IDs', () => {
      const factory = new IDFactory();
      const id1 = factory.getId();
      const id2 = factory.getId();
      const id3 = factory.getId();

      expect(id1).toBe(-1);
      expect(id2).toBe(-2);
      expect(id3).toBe(-3);
    });

    test('should track current ID', () => {
      const factory = new IDFactory();
      factory.getId();
      factory.getId();
      expect(factory.currentId()).toBe(-2);
    });

    test('should reset correctly', () => {
      const factory = new IDFactory();
      factory.getId();
      factory.getId();
      factory.reset();
      expect(factory.getId()).toBe(-1);
    });

    test('should allow setting ID', () => {
      const factory = new IDFactory();
      factory.setId(-100);
      expect(factory.getId()).toBe(-100);
    });
  });

  describe('Node', () => {
    test('should create a node', () => {
      const node = new Node(null);
      expect(node.isNode()).toBe(true);
      expect(node.isRelationship()).toBe(false);
    });

    test('should set and get ID', () => {
      const node = new Node(null);
      node.setId(42);
      expect(node.id()).toBe(42);
      expect(node.getId()).toBe(42);
    });

    test('should manage properties', () => {
      const node = new Node(null);
      node.setProperties({ name: 'test', value: 123 });
      
      expect(node.getLocalProperty('name')).toBe('test');
      expect(node.getLocalProperty('value')).toBe(123);
      expect(node.hasProperties()).toBe(true);
    });

    test('should manage labels', () => {
      const node = new Node(null);
      node.setLabels({ Person: true, Employee: true });
      
      expect(node.hasLabel('Person')).toBe(true);
      expect(node.hasLabel('NonExistent')).toBe(false);
      expect(node.getLabels()).toContain('Person');
      expect(node.getLabels()).toContain('Employee');
    });

    test('should create a copy', () => {
      const node = new Node(null);
      node.setId(1);
      node.setProperties({ name: 'test' });
      node.setLabels({ Person: true });

      const copy = node.copy();
      expect(copy.id()).toBeNull(); // Copy doesn't copy ID
      expect(copy.getLocalProperty('name')).toBe('test');
      expect(copy.hasLabel('Person')).toBe(true);
    });

    test('should check mappable status', () => {
      const node = new Node(null);
      expect(node.mappable()).toBe(true);
    });
  });

  describe('Relationship', () => {
    test('should create a relationship', () => {
      const rel = new Relationship(null);
      expect(rel.isRelationship()).toBe(true);
      expect(rel.isNode()).toBe(false);
    });

    test('should manage direction', () => {
      const rel = new Relationship(null);
      
      expect(rel.noDirection()).toBe(true);
      
      rel.setLeftDirection(true);
      expect(rel.leftDirection()).toBe(true);
      expect(rel.noDirection()).toBe(false);
      expect(rel.direction()).toBe('left');
      
      // Reset and test right direction
      rel.setLeftDirection(false);
      rel.setRightDirection(true);
      expect(rel.rightDirection()).toBe(true);
      expect(rel.direction()).toBe('right');
      
      // When both directions are set, it's considered undirected
      rel.setLeftDirection(true);
      expect(rel.uniDirectional()).toBe(true);
      // direction() returns 'none' when both are set due to exclusive logic
      expect(rel.direction()).toBe('none');
    });

    test('should manage type', () => {
      const rel = new Relationship(null);
      rel.setType('KNOWS');
      expect(rel.getType()).toBe('KNOWS');
    });

    test('should manage properties', () => {
      const rel = new Relationship(null);
      rel.setProperties({ since: 2020, weight: 5 });
      
      expect(rel.getProperty('since')).toBe(2020);
      expect(rel.getProperty('weight')).toBe(5);
    });

    test('should handle variable path length', () => {
      const rel = new Relationship(null);
      expect(rel.hasVariablePathLength()).toBe(false);
      
      rel.setHasVariablePathLength();
      expect(rel.hasVariablePathLength()).toBe(true);
      expect(rel.expandPath()).toBe(true);
    });

    test('should check path length satisfaction', () => {
      const rel = new Relationship(null);
      rel.setPathLengthFrom(1);
      rel.setPathLengthTo(3);
      
      expect(rel.pathLengthFromSatisfied()).toBe(true);
      expect(rel.pathLengthToSatisfied()).toBe(true);
      expect(rel.pathLengthSatisfied()).toBe(true);
    });
  });

  describe('Pattern', () => {
    test('should create an empty pattern', () => {
      const pattern = new Pattern();
      expect(pattern.empty()).toBe(true);
      expect(pattern.nodeCount()).toBe(0);
      expect(pattern.relationshipCount()).toBe(0);
    });

    test('should add nodes and relationships', () => {
      const pattern = new Pattern();
      const node1 = new Node(null);
      const node2 = new Node(null);
      const rel = new Relationship(null);

      pattern.addNode(node1);
      pattern.addRelationship(rel);
      pattern.addNode(node2);

      expect(pattern.empty()).toBe(false);
      expect(pattern.nodeCount()).toBe(2);
      expect(pattern.relationshipCount()).toBe(1);
    });

    test('should get last object', () => {
      const pattern = new Pattern();
      const node = new Node(null);
      pattern.addNode(node);
      
      expect(pattern.lastObject()).toBe(node);
      expect(pattern.getLast()).toBe(node);
    });

    test('should check mappable status', () => {
      const pattern = new Pattern();
      expect(pattern.mappable()).toBe(true);
    });
  });
});

describe('CypherNG Type Modules', () => {
  describe('List', () => {
    test('should create an empty list', () => {
      const list = new List();
      expect(list.length()).toBe(0);
      expect(list.get()).toEqual([]);
    });

    test('should add elements', () => {
      const list = new List();
      list.add({ value: () => 'item1' });
      list.add({ value: () => 'item2' });
      
      expect(list.length()).toBe(2);
      expect(list.get()).toEqual(['item1', 'item2']);
    });

    test('should handle bind function', () => {
      const list = new List([1, 2, 3], (x) => x * 2);
      expect(list.get()).toEqual([2, 4, 6]);
    });

    test('should set elements', () => {
      const list = new List();
      list.add({ value: () => 'old' });
      list.setElement(0, { value: () => 'new' });
      
      expect(list.get()).toEqual(['new']);
    });

    test('should provide type info', () => {
      const list = new List();
      expect(list.type()).toBe('List');
    });
  });

  describe('AssociativeArray', () => {
    test('should create an empty associative array', () => {
      const arr = new AssociativeArray();
      expect(arr.getProperties()).toEqual([]);
    });

    test('should add entries', () => {
      const arr = new AssociativeArray();
      arr.addEntry('key1', { value: () => 'value1' });
      arr.addEntry('key2', 'value2');
      
      const result = arr.get();
      expect(result.key1).toBe('value1');
      expect(result.key2).toBe('value2');
    });

    test('should prevent duplicate keys', () => {
      const arr = new AssociativeArray();
      arr.addEntry('key', 'value1');
      expect(() => arr.addEntry('key', 'value2')).toThrow();
    });

    test('should get property', () => {
      const arr = new AssociativeArray();
      arr.addEntry('key', { value: () => 'value' });
      
      expect(arr.getProperty('key')).toBe('value');
    });

    test('should convert to string', () => {
      const arr = new AssociativeArray();
      arr.addEntry('key', 'value');
      
      expect(arr.toString()).toBe('{"key":"value"}');
    });
  });

  describe('Case', () => {
    test('should evaluate simple case', () => {
      const caseExpr = new Case();
      caseExpr.when({ value: () => true });
      caseExpr.then({ value: () => 'yes' });
      caseExpr.else({ value: () => 'no' });
      
      expect(caseExpr.value()).toBe('yes');
    });

    test('should evaluate else case', () => {
      const caseExpr = new Case();
      caseExpr.when({ value: () => false });
      caseExpr.then({ value: () => 'yes' });
      caseExpr.else({ value: () => 'no' });
      
      expect(caseExpr.value()).toBe('no');
    });

    test('should handle multiple whens', () => {
      const caseExpr = new Case();
      caseExpr.when({ value: () => false });
      caseExpr.then({ value: () => 'first' });
      caseExpr.when({ value: () => true });
      caseExpr.then({ value: () => 'second' });
      caseExpr.else({ value: () => 'else' });
      
      expect(caseExpr.value()).toBe('second');
    });

    test('should count when clauses', () => {
      const caseExpr = new Case();
      caseExpr.when({ value: () => true });
      caseExpr.when({ value: () => false });
      
      expect(caseExpr.whenCount()).toBe(2);
    });
  });

  describe('Predicate', () => {
    test('should evaluate all predicate', () => {
      const pred = new Predicate();
      pred.setPredicateFunctionName('all');
      pred.list({ value: () => [1, 2, 3] });
      pred.where({ value: () => true });
      
      expect(pred.value()).toBe(true);
    });

    test('should evaluate any predicate', () => {
      const pred = new Predicate();
      pred.setPredicateFunctionName('any');
      pred.list({ value: () => [false, false, true] });
      pred.where({ value: () => true });
      
      expect(pred.value()).toBe(true);
    });

    test('should evaluate sum predicate', () => {
      const pred = new Predicate();
      pred.setPredicateFunctionName('sum');
      pred.list({ value: () => [1, 1, 1, 1, 1] });
      pred.where({ value: () => true });
      
      expect(pred.value()).toBe(5);
    });

    test('should throw for non-array list', () => {
      const pred = new Predicate();
      pred.setPredicateFunctionName('all');
      pred.list({ value: () => 'not an array' });
      
      expect(() => pred.value()).toThrow('Predicate list must be an array');
    });
  });

  describe('Table and TableColumn', () => {
    test('should create a table', () => {
      const table = new Table(null, 'TestTable');
      expect(table.name()).toBe('TestTable');
      expect(table.type()).toBe('Table');
    });

    test('should add columns to table', () => {
      const table = new Table(null, 'TestTable');
      const col = table.addColumn('col1');
      
      expect(col).toBeDefined();
      expect(table.getColumn('col1')).toBe(col);
    });

    test('should add values to column', () => {
      const table = new Table(null, 'TestTable');
      const col = table.addColumn('col1');
      
      col.addValue('value1');
      col.addValue('value1'); // Should use run-length encoding
      col.addValue('value2');
      
      expect(col.getValues()).toEqual(['value1', 'value1', 'value2']);
    });

    test('should iterate through column values', () => {
      const col = new TableColumn(null, 'test');
      col.addValue('a');
      col.addValue('b');
      
      expect(col.value()).toBe('a');
      expect(col.value()).toBe('b');
    });

    test('should reset column iterator', () => {
      const col = new TableColumn(null, 'test');
      col.addValue('a');
      col.value();
      col.reset();
      
      expect(col.value()).toBe('a');
    });
  });
});

describe('CypherNG Network Module', () => {
  describe('HTTP', () => {
    test('should create HTTP client', () => {
      const http = new HTTP();
      expect(http).toBeDefined();
    });

    test('should detect Node.js environment', () => {
      const http = new HTTP();
      expect(http._isNode).toBe(true);
    });
  });
});

describe('CypherNG Persistence Extension Points', () => {
  describe('StorageAdapter', () => {
    test('should define abstract methods', () => {
      const adapter = new StorageAdapter();
      
      expect(adapter.load()).rejects.toThrow('must be implemented');
      expect(adapter.save({})).rejects.toThrow('must be implemented');
      expect(adapter.isAvailable()).rejects.toThrow('must be implemented');
      expect(adapter.clear()).rejects.toThrow('must be implemented');
    });

    test('should store options', () => {
      const options = { databaseName: 'test' };
      const adapter = new StorageAdapter(options);
      expect(adapter._options).toBe(options);
    });

    test('should return class name', () => {
      const adapter = new StorageAdapter();
      expect(adapter.getName()).toBe('StorageAdapter');
    });
  });

  describe('GraphSerializer', () => {
    test('should define abstract methods', () => {
      const serializer = new GraphSerializer();
      
      expect(() => serializer.serialize({})).toThrow('must be implemented');
      expect(() => serializer.deserialize('')).toThrow('must be implemented');
      expect(() => serializer.getContentType()).toThrow('must be implemented');
      expect(() => serializer.getFileExtension()).toThrow('must be implemented');
    });

    test('should store options', () => {
      const options = { format: 'json' };
      const serializer = new GraphSerializer(options);
      expect(serializer._options).toBe(options);
    });

    test('should return class name', () => {
      const serializer = new GraphSerializer();
      expect(serializer.getName()).toBe('GraphSerializer');
    });
  });
});
