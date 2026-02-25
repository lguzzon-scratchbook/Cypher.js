/**
 * Test suite for Node class
 * @fileoverview Node.js tests for CypherNG Node class
 */

import { describe, test, expect, beforeEach, beforeAll } from 'bun:test';
import Node from '../data/Node.js';
import Database from '../data/Database.js';

describe('CypherNG Node Class', () => {
    /** @type {Database} */
    let db;
    /** @type {Node} */
    let node;

    beforeEach(() => {
        db = new Database();
        node = new Node(db);
    });

    describe('Constructor', () => {
        test('should create node with null id', () => {
            expect(node.id()).toBeNull();
        });

        test('should create node with empty labels', () => {
            expect(node.getLabels()).toEqual([]);
        });

        test('should create node with empty properties', () => {
            expect(node.hasProperties()).toBe(false);
        });

        test('should create node without variable key', () => {
            expect(node.hasVariableKey()).toBe(false);
        });
    });

    describe('ID operations', () => {
        test('should set and get id', () => {
            node.setId(42);
            expect(node.id()).toBe(42);
            expect(node.getId()).toBe(42);
        });

        test('should return null id when not set', () => {
            expect(node.id()).toBeNull();
        });
    });

    describe('Property operations', () => {
        test('should set single property', () => {
            node.setProperty('name', { value: () => 'TestNode' });
            node.bindProperty('name');
            expect(node.getLocalProperty('name')).toBe('TestNode');
        });

        test('should set multiple properties', () => {
            node.setProperties({ name: 'Node1', age: 25 });
            expect(node.getProperties()).toEqual({ name: 'Node1', age: 25 });
        });

        test('should bind all properties', () => {
            node.setProperty('prop1', { value: () => 'value1' });
            node.setProperty('prop2', { value: () => 42 });
            node.bindProperties();
            expect(node.getProperties()).toEqual({ prop1: 'value1', prop2: 42 });
        });

        test('should get raw properties', () => {
            node.setProperties({ name: 'Test' });
            const raw = node.getRawProperties();
            expect(raw).toEqual({ name: 'Test' });
            raw.name = 'Modified';
            expect(node.getProperties().name).toBe('Modified');
        });

        test('should check hasProperties', () => {
            expect(node.hasProperties()).toBe(false);
            node.setProperty('key', { value: () => 'val' });
            expect(node.hasProperties()).toBe(true);
        });
    });

    describe('Label operations', () => {
        test('should set label', () => {
            node.setId(1);
            node.setLabel('Person', 1);
            expect(node.hasLabel('Person')).toBe(true);
            expect(node.getLabels()).toContain('Person');
        });

        test('should set multiple labels', () => {
            node.setLabels({ Person: true, Developer: true });
            expect(node.hasLabel('Person')).toBe(true);
            expect(node.hasLabel('Developer')).toBe(true);
        });

        test('should check hasLabels', () => {
            expect(node.hasLabels()).toBe(false);
            node.setLabel('Test', 1);
            expect(node.hasLabels()).toBe(true);
        });

        test('should get labels as object', () => {
            node.setLabel('Person', 1);
            node.setLabel('Developer', 1);
            const labels = node.labels();
            expect(labels.Person).toBe(true);
            expect(labels.Developer).toBe(true);
        });
    });

    describe('Variable key operations', () => {
        test('should set and get variable key', () => {
            node.setVariableKey('n');
            expect(node.getVariableKey()).toBe('n');
            expect(node.hasVariableKey()).toBe(true);
        });
    });

    describe('Path navigation', () => {
        /** @type {Node} */
        let node2;
        /** @type {Node} */
        let rel;

        beforeEach(() => {
            node2 = new Node(db);
            node2.setId(2);
            rel = { /* mock relationship */ };
        });

        test('should get next node when nextObject is a node', () => {
            node.setNextObject(node2);
            expect(node.nextNode()).toBe(node2);
        });

        test('should get previous node when previousObject is a node', () => {
            node.setPreviousObject(node2);
            expect(node.previousNode()).toBe(node2);
        });

        test('should return null when no next object', () => {
            expect(node.nextNode()).toBeNull();
        });

        test('should return null when no previous object', () => {
            expect(node.previousNode()).toBeNull();
        });

        test('should get outgoing relationship', () => {
            node.setNextObject({ isRelationship: () => true, getNextObject: () => null });
            expect(node.outgoingRelationship()).not.toBeNull();
        });

        test('should get incoming relationship', () => {
            node.setPreviousObject({ isRelationship: () => true });
            expect(node.incomingRelationship()).not.toBeNull();
        });
    });

    describe('Pattern operations', () => {
        test('should set and get pattern', () => {
            node.setPattern('(n:Label)');
            expect(node.getPattern()).toBe('(n:Label)');
        });
    });

    describe('Referenced node operations', () => {
        /** @type {Node} */
        let referredNode;

        beforeEach(() => {
            referredNode = new Node(db);
            referredNode.setId(100);
        });

        test('should set referred node', () => {
            node.setReferredNode(referredNode);
            expect(node.isReferred()).toBe(true);
            expect(node.getReferredNode()).toBe(referredNode);
        });
    });

    describe('Type checking', () => {
        test('should identify as node', () => {
            expect(node.isNode()).toBe(true);
            expect(node.isRelationship()).toBe(false);
        });

        test('should return correct type', () => {
            expect(node.type()).toBe('Node');
        });
    });

    describe('Object conversion', () => {
        test('should convert to object', () => {
            node.setId(1);
            node.setLabel('Person', 1);
            node.setProperties({ name: 'John', age: 30 });

            const obj = node.toObject();
            expect(obj.id).toBe(1);
            expect(obj.labels).toContain('Person');
            expect(obj.properties.name).toBe('John');
            expect(obj.properties.age).toBe(30);
            expect(obj.getProperty('name')).toBe('John');
        });

        test('should convert to string', () => {
            node.setId(42);
            const str = node.toString();
            expect(str).toContain('42');
        });
    });

    describe('Grouping operations', () => {
        test('should provide groupByKey', () => {
            node.setId(5);
            expect(node.groupByKey()).toBe(5);
        });

        test('should provide groupByValue', () => {
            expect(node.groupByValue()).toBe(node);
        });
    });

    describe('Data operations', () => {
        test('should get data', () => {
            expect(node.getData()).toBe(node);
        });
    });

    describe('Previous/Next object operations', () => {
        test('should set and get previous object', () => {
            const prev = { test: 'value' };
            node.setPreviousObject(prev);
            expect(node.getPreviousObject()).toBe(prev);
        });

        test('should set and get next object', () => {
            const next = { test: 'value' };
            node.setNextObject(next);
            expect(node.getNextObject()).toBe(next);
        });
    });
});