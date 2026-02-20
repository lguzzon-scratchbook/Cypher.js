/**
 * @fileoverview Jest Tests for Data Layer Module
 * @description Tests for Section 2: Data Layer - StringRecoder, IDFactory, StoredNode, StoredRelationship
 * @module cypher-ng/tests/data
 */

import {
    StringRecoder,
    IDFactory,
    StoredNode,
    StoredRelationship,
    PatternNode,
    PatternRelationship,
    Pattern,
    Matcher
} from '../modules/02-data.js';

describe('Data Layer Module', () => {
    
    describe('StringRecoder', () => {
        test('should encode string to unique integer', () => {
            const recoder = new StringRecoder();
            const code1 = recoder.recode('hello');
            const code2 = recoder.recode('world');
            expect(typeof code1).toBe('number');
            expect(typeof code2).toBe('number');
            expect(code1).not.toBe(code2);
        });

        test('should return same code for same string', () => {
            const recoder = new StringRecoder();
            const code1 = recoder.recode('hello');
            const code2 = recoder.recode('hello');
            expect(code1).toBe(code2);
        });

        test('should handle null/undefined values', () => {
            const recoder = new StringRecoder();
            expect(recoder.recode(null)).toBeNull();
            expect(recoder.recode(undefined)).toBeUndefined();
        });

        test('should handle non-string values', () => {
            const recoder = new StringRecoder();
            expect(recoder.recode(123)).toBeDefined();
            expect(recoder.recode({})).toBeDefined();
        });
    });

    describe('IDFactory', () => {
        test('should generate sequential IDs starting from 0', () => {
            const factory = new IDFactory();
            expect(factory.getId()).toBe(0);
            expect(factory.getId()).toBe(1);
            expect(factory.getId()).toBe(2);
        });
    });

    describe('StoredNode', () => {
        let mockDb;
        
        beforeEach(() => {
            mockDb = {
                _addLabelNodeIdLookup: jest.fn()
            };
        });

        test('should create StoredNode with no properties', () => {
            const node = new StoredNode(mockDb);
            expect(node.isNode()).toBe(true);
            expect(node.isRelationship()).toBe(false);
            expect(node.type()).toBe('StoredNode');
        });

        test('should set and get ID', () => {
            const node = new StoredNode(mockDb);
            node.setId(42);
            expect(node.id()).toBe(42);
            expect(node.getId()).toBe(42);
        });

        test('should set and get labels', () => {
            const node = new StoredNode(mockDb);
            node.setLabel('Person');
            node.setLabel('Actor');
            expect(node.hasLabel('Person')).toBe(true);
            expect(node.hasLabel('Actor')).toBe(true);
            expect(node.hasLabel('Unknown')).toBe(false);
            expect(node.getLabels()).toContain('Person');
            expect(node.getLabels()).toContain('Actor');
        });

        test('should set labels from object', () => {
            const node = new StoredNode(mockDb);
            node.setLabelsFromObject({ Person: true, Actor: true });
            expect(node.hasLabel('Person')).toBe(true);
            expect(node.hasLabel('Actor')).toBe(true);
        });

        test('should check hasLabels', () => {
            const node = new StoredNode(mockDb);
            expect(node.hasLabels()).toBe(false);
            node.setLabel('Person');
            expect(node.hasLabels()).toBe(true);
        });

        test('should set and get properties', () => {
            const node = new StoredNode(mockDb);
            node.setProperties({ name: 'John', age: 30 });
            expect(node.getLocalProperty('name')).toBe('John');
            expect(node.getLocalProperty('age')).toBe(30);
            expect(node.getLocalProperty('unknown')).toBeNull();
        });

        test('should check hasProperties', () => {
            const node = new StoredNode(mockDb);
            expect(node.hasProperties()).toBe(false);
            node.setProperties({ name: 'John' });
            expect(node.hasProperties()).toBe(true);
        });

        test('should get raw properties', () => {
            const node = new StoredNode(mockDb);
            node.setProperties({ name: 'John', age: 30 });
            const rawProps = node.getRawProperties();
            expect(rawProps.name).toBe('John');
            expect(rawProps.age).toBe(30);
        });

        test('should convert to serializable format', () => {
            const node = new StoredNode(mockDb);
            node.setId(1);
            node.setLabel('Person');
            node.setProperties({ name: 'John' });
            
            const serializable = node.toSerializable();
            expect(serializable.id).toBe(1);
            expect(serializable.labels).toEqual({ Person: true });
            expect(serializable.properties).toEqual({ name: 'John' });
        });
    });

    describe('StoredRelationship', () => {
        let mockDb;
        let node1, node2;
        
        beforeEach(() => {
            node1 = { id: () => 1 };
            node2 = { id: () => 2 };
            mockDb = {
                getNodeById: jest.fn((id) => id === 1 ? node1 : node2)
            };
        });

        test('should create StoredRelationship', () => {
            const rel = new StoredRelationship(mockDb);
            expect(rel.isRelationship()).toBe(true);
            expect(rel.isNode()).toBe(false);
            expect(rel.type()).toBe('StoredRelationship');
        });

        test('should set and get ID', () => {
            const rel = new StoredRelationship(mockDb);
            rel.setId(42);
            expect(rel.id()).toBe(42);
        });

        test('should set and get type', () => {
            const rel = new StoredRelationship(mockDb);
            rel.setType('KNOWS');
            expect(rel.getType()).toBe('KNOWS');
            rel.setStoredType('LOVES');
            expect(rel.getType()).toBe('LOVES');
        });

        test('should set and get properties', () => {
            const rel = new StoredRelationship(mockDb);
            rel.setProperties({ weight: 1, since: '2020-01-01' });
            expect(rel.getLocalProperty('weight')).toBe(1);
            expect(rel.getLocalProperty('since')).toBe('2020-01-01');
        });

        test('should set directions', () => {
            const rel = new StoredRelationship(mockDb);
            rel.setLeftDirection(true);
            rel.setRightDirection(false);
            expect(rel.leftDirectionRaw()).toBe(true);
            expect(rel.rightDirectionRaw()).toBe(false);
        });

        test('should calculate direction correctly', () => {
            const rel = new StoredRelationship(mockDb);
            rel.setLeftDirection(true);
            rel.setRightDirection(false);
            
            // When viewing from fromNode (id 1)
            expect(rel.leftDirection(1)).toBe(true);
            expect(rel.rightDirection(1)).toBe(false);
            
            // When viewing from toNode (id 2) - direction reverses
            expect(rel.leftDirection(2)).toBe(false);
            expect(rel.rightDirection(2)).toBe(true);
        });

        test('should check uni-directional', () => {
            const rel = new StoredRelationship(mockDb);
            rel.setLeftDirection(true);
            rel.setRightDirection(false);
            expect(rel.uniDirectional()).toBe(true);
        });

        test('should convert to serializable format', () => {
            const rel = new StoredRelationship(mockDb);
            rel.setId(1);
            rel.setStoredType('KNOWS');
            rel.setProperties({ weight: 1 });
            rel.setFromNodeId(1);
            rel.setToNodeId(2);
            rel.setLeftDirection(true);
            rel.setRightDirection(false);
            
            const serializable = rel.toSerializable();
            expect(serializable.id).toBe(1);
            expect(serializable.type).toBe('KNOWS');
            expect(serializable.fromNodeId).toBe(1);
            expect(serializable.toNodeId).toBe(2);
        });
    });

    describe('Matcher', () => {
        test('should initialize with empty matching set', () => {
            const matcher = new Matcher();
            expect(matcher.matchingSetSize()).toBe(0);
        });

        test('should set matching set', () => {
            const matcher = new Matcher();
            matcher.setMatchingSet([1, 2, 3], 1);
            expect(matcher.matchingSetSize()).toBe(3);
            expect(matcher.matchingSet()).toEqual([1, 2, 3]);
        });

        test('should add to matching set', () => {
            const matcher = new Matcher();
            matcher.setMatchingSet([1, 2], 1);
            matcher.addToMatchingSet(3);
            expect(matcher.matchingSetSize()).toBe(3);
        });

        test('should increment toMatchCount', () => {
            const matcher = new Matcher();
            expect(matcher.toMatchCount()).toBe(0);
            matcher.incrementToMatchCount();
            expect(matcher.toMatchCount()).toBe(1);
        });

        test('should keep match tally', () => {
            const matcher = new Matcher();
            matcher.setMatchingSet([1, 2], 1);
            matcher.incrementToMatchCount();
            matcher.keepMatchTally(1);
            matcher.updateMatchingSet();
            expect(matcher.matchingSet()).toEqual([1]);
        });
    });

    describe('Pattern', () => {
        test('should create empty pattern', () => {
            const pattern = new Pattern();
            expect(pattern.empty()).toBe(true);
            expect(pattern.nodeCount()).toBe(0);
            expect(pattern.relationshipCount()).toBe(0);
        });

        test('should add nodes', () => {
            const pattern = new Pattern();
            const node = { isNode: () => true, setPattern: jest.fn() };
            pattern.addNode(node);
            expect(pattern.nodeCount()).toBe(1);
            expect(pattern.empty()).toBe(false);
        });

        test('should add relationships', () => {
            const pattern = new Pattern();
            const rel = { isRelationship: () => true, setPattern: jest.fn() };
            pattern.addRelationship(rel);
            expect(pattern.relationshipCount()).toBe(1);
        });
    });
});