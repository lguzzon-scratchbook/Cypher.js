/**
 * @fileoverview Unit tests for CypherNG core data structures.
 * Tests AssociativeArray, List, Case, FString, LinkedList, and utilities.
 */

// Load structures module - it exports via module.exports
// Use path from project root for Jest
const structures = require('../../../js/CypherNG/structures/index.js');
const AssociativeArray = structures.AssociativeArray;
const List = structures.List;
const Case = structures.Case;
const FString = structures.FString;
const Constant = structures.Constant;
const Predicate = structures.Predicate;
const LinkedList = structures.LinkedList;
const Table = structures.Table;
const TableColumn = structures.TableColumn;
const StringRecoder = structures.StringRecoder;
const IDFactory = structures.IDFactory;
const addArrayFunctions = structures.addArrayFunctions;
const addAssociativeArrayFunctions = structures.addAssociativeArrayFunctions;
const clean = structures.clean;

describe('CypherNG Structures', () => {

    describe('Constant', () => {
        test('should wrap a value', () => {
            const c = new Constant(42);
            expect(c.value()).toBe(42);
            expect(c.get()).toBe(42);
            expect(c.getObject()).toBe(42);
        });

        test('should allow setting a new value', () => {
            const c = new Constant('initial');
            c.setValue('updated');
            expect(c.value()).toBe('updated');
        });

        test('should have correct type', () => {
            const c = new Constant('test');
            expect(c.type()).toBe('Constant');
        });
    });

    describe('AssociativeArray', () => {
        test('should add and retrieve entries', () => {
            const aa = new AssociativeArray();
            aa.addEntry('name', new Constant('Alice'));
            aa.addEntry('age', new Constant(30));

            const result = aa.get();
            expect(result.name).toBe('Alice');
            expect(result.age).toBe(30);
        });

        test('should throw on duplicate keys', () => {
            const aa = new AssociativeArray();
            aa.addEntry('key', new Constant('value1'));
            expect(() => aa.addEntry('key', new Constant('value2')))
                .toThrow('already exists');
        });

        test('should get property keys', () => {
            const aa = new AssociativeArray();
            aa.addEntry('a', new Constant(1));
            aa.addEntry('b', new Constant(2));
            aa.addEntry('c', new Constant(3));

            const keys = aa.getProperties();
            expect(keys).toContain('a');
            expect(keys).toContain('b');
            expect(keys).toContain('c');
        });
    });

    describe('List', () => {
        test('should wrap an array', () => {
            const list = new List([1, 2, 3]);
            const result = list.get();
            expect(result[0]).toBe(1);
            expect(result[1]).toBe(2);
            expect(result[2]).toBe(3);
            expect(result.length).toBe(3);
        });

        test('should add elements', () => {
            const list = new List();
            list.add(new Constant(1));
            list.add(new Constant(2));
            const result = list.get();
            expect(result[0]).toBe(1);
            expect(result[1]).toBe(2);
            expect(result.length).toBe(2);
        });

        test('should bind element values', () => {
            const list = new List([new Constant('a'), new Constant('b')]);
            const result = list.value();
            expect(result[0]).toBe('a');
            expect(result[1]).toBe('b');
        });

        test('should handle empty list', () => {
            const list = new List();
            const result = list.get();
            expect(result.length).toBe(0);
            expect(list.value().length).toBe(0);
        });
    });

    describe('Case', () => {
        test('should evaluate when condition is true', () => {
            const caseExpr = new Case();
            caseExpr.when(new Constant(true));
            caseExpr.then(new Constant('yes'));
            caseExpr.else(new Constant('no'));

            expect(caseExpr.value()).toBe('yes');
        });

        test('should evaluate else when all when conditions are false', () => {
            const caseExpr = new Case();
            caseExpr.when(new Constant(false));
            caseExpr.then(new Constant('first'));
            caseExpr.when(new Constant(false));
            caseExpr.then(new Constant('second'));
            caseExpr.else(new Constant('default'));

            expect(caseExpr.value()).toBe('default');
        });

        test('should evaluate first matching when', () => {
            const caseExpr = new Case();
            caseExpr.when(new Constant(false));
            caseExpr.then(new Constant('first'));
            caseExpr.when(new Constant(true));
            caseExpr.then(new Constant('second'));
            caseExpr.else(new Constant('default'));

            expect(caseExpr.value()).toBe('second');
        });
    });

    describe('FString', () => {
        test('should combine string parts', () => {
            const str = new FString();
            str.string('Hello, ');
            str.string('World!');
            expect(str.value()).toBe('Hello, World!');
        });

        test('should evaluate expressions in string', () => {
            const str = new FString();
            str.string('Value: ');
            str.expression(new Constant(42));
            str.string(' is the answer');
            expect(str.value()).toBe('Value: 42 is the answer');
        });

        test('should handle mixed parts', () => {
            const str = new FString();
            str.string('The sum of ');
            str.expression(new Constant(2));
            str.string(' and ');
            str.expression(new Constant(3));
            str.string(' is ');
            str.expression(new Constant(5));
            expect(str.value()).toBe('The sum of 2 and 3 is 5');
        });
    });

    describe('LinkedList', () => {
        test('should add elements', () => {
            const list = new LinkedList();
            list.add(1);
            list.add(2);
            list.add(3);
            expect(list.size()).toBe(3);
        });

        test('should convert to array', () => {
            const list = new LinkedList();
            list.add('a');
            list.add('b');
            list.add('c');
            expect(list.toArray()).toEqual(['a', 'b', 'c']);
        });

        test('should remove last element', () => {
            const list = new LinkedList();
            list.add(1);
            list.add(2);
            list.add(3);
            list.removeLast();
            expect(list.size()).toBe(2);
            expect(list.toArray()).toEqual([1, 2]);
        });

        test('should get head element', () => {
            const list = new LinkedList();
            list.add('first');
            list.add('second');
            expect(list.head().get()).toBe('first');
        });

        test('should handle empty list', () => {
            const list = new LinkedList();
            expect(list.size()).toBe(0);
            expect(list.head()).toBeNull();
            expect(list.toArray()).toEqual([]);
        });

        test('should allow iteration', () => {
            const list = new LinkedList();
            list.add(1);
            list.add(2);
            list.add(3);

            const result = [];
            let node = list.head();
            while (node) {
                result.push(node.get());
                node = node.next();
            }
            expect(result).toEqual([1, 2, 3]);
        });
    });

    describe('Predicate', () => {
        test('should be creatable', () => {
            const pred = new Predicate();
            expect(pred).toBeDefined();
        });

        test('should have required methods', () => {
            const pred = new Predicate();
            expect(typeof pred.setPredicateFunctionName).toBe('function');
            expect(typeof pred.variable).toBe('function');
            expect(typeof pred.list).toBe('function');
            expect(typeof pred.where).toBe('function');
            expect(typeof pred.value).toBe('function');
        });
    });

    describe('Table and TableColumn', () => {
        test('should be creatable with mock DB', () => {
            const mockDb = {
                addTable: function() {}
            };
            const table = new Table(mockDb, 'test_table');
            expect(table).toBeDefined();
            expect(table.name()).toBe('test_table');
        });

        test('should add columns with mock DB', () => {
            const mockDb = {
                addTable: function() {}
            };
            const table = new Table(mockDb, 'test');
            const col = table.addColumn('name');
            expect(col).toBeDefined();
            expect(col.name()).toBe('name');
        });

        test('TableColumn should use run-length encoding', () => {
            const col = new TableColumn(null, 'values');
            col.addValue(1);
            col.addValue(1);
            col.addValue(2);
            col.addValue(2);
            col.addValue(2);

            // First two values should be 1 (same run)
            expect(col.value()).toBe(1);
            expect(col.value()).toBe(1);

            // Next value should be 2 (new run)
            expect(col.value()).toBe(2);
        });
    });

    describe('Utils', () => {
        describe('StringRecoder', () => {
            test('should assign codes to strings', () => {
                const recoder = new StringRecoder();
                const code1 = recoder.recode('hello');
                const code2 = recoder.recode('world');
                expect(typeof code1).toBe('number');
                expect(typeof code2).toBe('number');
                expect(code1).not.toBe(code2);
            });

            test('should return same code for same string', () => {
                const recoder = new StringRecoder();
                const code1 = recoder.recode('test');
                const code2 = recoder.recode('test');
                expect(code1).toBe(code2);
            });

            test('should return null/undefined unchanged', () => {
                const recoder = new StringRecoder();
                expect(recoder.recode(null)).toBeNull();
                expect(recoder.recode(undefined)).toBeUndefined();
            });

            test('should handle non-string values', () => {
                const recoder = new StringRecoder();
                const code1 = recoder.recode(123);
                const code2 = recoder.recode(123);
                expect(code1).toBe(code2);
            });
        });

        describe('IDFactory', () => {
            test('should generate sequential IDs', () => {
                const factory = new IDFactory();
                expect(factory.getId()).toBe(-1);
                expect(factory.getId()).toBe(0);
                expect(factory.getId()).toBe(1);
            });
        });

        describe('addArrayFunctions', () => {
            test('should add contains method', () => {
                const arr = addArrayFunctions([1, 2, 3]);
                expect(arr.contains(2)).toBe(true);
                expect(arr.contains(4)).toBe(false);
            });

            test('should add toLowerCase method', () => {
                const arr = addArrayFunctions(['A', 'B', 'C']);
                expect(arr.toLowerCase()).toEqual(['a', 'b', 'c']);
            });

            test('should add toUpperCase method', () => {
                const arr = addArrayFunctions(['a', 'b', 'c']);
                expect(arr.toUpperCase()).toEqual(['A', 'B', 'C']);
            });

            test('should add last method', () => {
                const arr = addArrayFunctions([1, 2, 3]);
                expect(arr.last()).toBe(3);
            });

            test('should add beforeLast method', () => {
                const arr = addArrayFunctions([1, 2, 3]);
                expect(arr.beforeLast()).toBe(2);
            });
        });

        describe('addAssociativeArrayFunctions', () => {
            test('should add getKeys method', () => {
                const obj = addAssociativeArrayFunctions({ a: 1, b: 2 });
                const keys = obj.getKeys();
                expect(keys).toContain('a');
                expect(keys).toContain('b');
            });

            test('should add getProperty method', () => {
                const obj = addAssociativeArrayFunctions({ a: 1, b: 2 });
                expect(obj.getProperty('a')).toBe(1);
            });

            test('should return self from getProperties', () => {
                const obj = addAssociativeArrayFunctions({ a: 1, b: 2 });
                const props = obj.getProperties();
                expect(props.a).toBe(1);
                expect(props.b).toBe(2);
            });
        });

        describe('clean', () => {
            test('should remove null characters from strings', () => {
                expect(clean('hello\0world')).toBe('helloworld');
            });

            test('should recursively clean objects', () => {
                const obj = {
                    a: 'test\0',
                    b: {
                        c: 'nested\0'
                    }
                };
                const cleaned = clean(obj);
                expect(cleaned.a).toBe('test');
                expect(cleaned.b.c).toBe('nested');
            });

            test('should remove functions from objects', () => {
                const obj = {
                    a: 1,
                    fn: function() {}
                };
                const cleaned = clean(obj);
                expect(cleaned.a).toBe(1);
                expect(cleaned.fn).toBeUndefined();
            });
        });
    });
});
