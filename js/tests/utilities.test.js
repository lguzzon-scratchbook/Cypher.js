/**
 * @fileoverview Jest Tests for Utilities Module
 * @description Tests for Section 1: Utilities - array functions, associative array functions, clean function, and reference classes
 * @module cypher-ng/tests/utilities
 */

import {
    printStackTrace,
    addArrayFunctions,
    addAssociativeArrayFunctions,
    clean,
    NodeReference,
    RelationshipReference
} from '../modules/01-utilities.js';

describe('Utilities Module', () => {
    
    describe('addArrayFunctions', () => {
        test('should add contains method', () => {
            const arr = [1, 2, 3];
            const enhanced = addArrayFunctions(arr);
            expect(enhanced.contains(2)).toBe(true);
            expect(enhanced.contains(5)).toBe(false);
        });

        test('should add toLowerCase method', () => {
            const arr = ['HELLO', 'WORLD'];
            const enhanced = addArrayFunctions(arr);
            expect(enhanced.toLowerCase()).toEqual(['hello', 'world']);
        });

        test('should add toUpperCase method', () => {
            const arr = ['hello', 'world'];
            const enhanced = addArrayFunctions(arr);
            expect(enhanced.toUpperCase()).toEqual(['HELLO', 'WORLD']);
        });

        test('should add get method', () => {
            const arr = [1, 2, 3];
            const enhanced = addArrayFunctions(arr);
            expect(enhanced.get()).toEqual([1, 2, 3]);
        });

        test('should add last method', () => {
            const arr = [1, 2, 3];
            const enhanced = addArrayFunctions(arr);
            expect(enhanced.last()).toBe(3);
        });

        test('should add beforeLast method', () => {
            const arr = [1, 2, 3];
            const enhanced = addArrayFunctions(arr);
            expect(enhanced.beforeLast()).toBe(2);
        });

        test('should add value method', () => {
            const arr = [1, 2, 3];
            const enhanced = addArrayFunctions(arr);
            expect(enhanced.value()).toEqual([1, 2, 3]);
        });

        test('should add join method', () => {
            const arr = ['a', 'b', 'c'];
            const enhanced = addArrayFunctions(arr);
            expect(enhanced.join('-')).toBe('a-b-c');
        });

        test('should add trim method', () => {
            const arr = ['  hello  ', '  world  '];
            const enhanced = addArrayFunctions(arr);
            expect(enhanced.trim()).toEqual(['hello', 'world']);
        });
    });

    describe('addAssociativeArrayFunctions', () => {
        test('should add getProperty method', () => {
            const obj = { name: 'John', age: 30 };
            const enhanced = addAssociativeArrayFunctions(obj);
            expect(enhanced.getProperty('name')).toBe('John');
        });

        test('should add getProperties method', () => {
            const obj = { name: 'John', age: 30 };
            const enhanced = addAssociativeArrayFunctions(obj);
            expect(enhanced.getProperties()).toEqual({ name: 'John', age: 30 });
        });

        test('should add getKeys method', () => {
            const obj = { name: 'John', age: 30 };
            const enhanced = addAssociativeArrayFunctions(obj);
            const keys = enhanced.getKeys();
            expect(keys).toContain('name');
            expect(keys).toContain('age');
        });
    });

    describe('clean', () => {
        test('should clean string values', () => {
            const result = clean('hello\0world');
            expect(result).toBe('helloworld');
        });

        test('should clean nested objects', () => {
            const obj = {
                name: 'John',
                age: 30,
                getName: function() { return this.name; }
            };
            const result = clean(obj);
            expect(result.getName).toBeUndefined();
            expect(result.name).toBe('John');
        });
    });

    describe('NodeReference', () => {
        // Create a mock DB for testing
        const mockDb = {
            getNodeById: jest.fn((id) => ({
                id: () => id,
                toObject: () => ({ id, labels: ['Test'], properties: { name: 'Test Node' } }),
                getLocalProperty: jest.fn((key) => 'test-value'),
                getProperties: () => ({ name: 'Test Node' }),
                getLabels: () => ['Test'],
                get: function() { return this; }
            }))
        };

        test('should create NodeReference with correct nodeId', () => {
            const ref = new NodeReference(mockDb, 1);
            expect(ref.nodeId()).toBe(1);
            expect(ref.id()).toBe(1);
        });

        test('should call getNodeById on getNode', () => {
            const ref = new NodeReference(mockDb, 1);
            ref.getNode();
            expect(mockDb.getNodeById).toHaveBeenCalledWith(1);
        });

        test('should call getNodeById on getProperty', () => {
            const ref = new NodeReference(mockDb, 1);
            ref.getProperty('name');
            expect(mockDb.getNodeById).toHaveBeenCalledWith(1);
        });

        test('should return correct groupByKey', () => {
            const ref = new NodeReference(mockDb, 1);
            expect(ref.groupByKey()).toBe(1);
        });
    });

    describe('RelationshipReference', () => {
        const mockDb = {
            getRelationshipById: jest.fn((id) => ({
                id: () => id,
                toObject: () => ({ id, type: 'KNOWS', properties: { weight: 1 } }),
                getLocalProperty: jest.fn((key) => 'test-value'),
                getProperties: () => ({ weight: 1 }),
                getType: () => 'KNOWS',
                get: function() { return this; }
            }))
        };

        test('should create RelationshipReference with correct relationshipId', () => {
            const ref = new RelationshipReference(mockDb, 1);
            expect(ref.relationshipId()).toBe(1);
            expect(ref.id()).toBe(1);
        });

        test('should call getRelationshipById on getRelationship', () => {
            const ref = new RelationshipReference(mockDb, 1);
            ref.getRelationship();
            expect(mockDb.getRelationshipById).toHaveBeenCalledWith(1);
        });

        test('should return correct groupByKey', () => {
            const ref = new RelationshipReference(mockDb, 1);
            expect(ref.groupByKey()).toBe(1);
        });
    });
});