/**
 * Test suite for Relationship class
 * @fileoverview Tests for CypherNG Relationship class
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import Relationship from '../data/Relationship.js';
import Database from '../data/Database.js';
import Node from '../data/Node.js';

describe('CypherNG Relationship Class', () => {
    /** @type {Database} */
    let db;
    /** @type {Relationship} */
    let rel;
    /** @type {Node} */
    let fromNode;
    /** @type {Node} */
    let toNode;

    beforeEach(() => {
        db = new Database();
        fromNode = new Node(db);
        fromNode.setId(1);
        toNode = new Node(db);
        toNode.setId(2);
        rel = new Relationship(db);
    });

    describe('Constructor', () => {
        test('should create relationship with null id', () => {
            expect(rel.id()).toBeNull();
        });

        test('should create relationship without type', () => {
            expect(rel.getType()).toBeNull();
        });

        test('should create relationship without direction', () => {
            expect(rel.leftDirection()).toBe(false);
            expect(rel.rightDirection()).toBe(false);
        });

        test('should create relationship as not added', () => {
            expect(rel.isAdded()).toBe(false);
        });
    });

    describe('ID operations', () => {
        test('should set and get id', () => {
            rel.setId(42);
            expect(rel.id()).toBe(42);
        });

        test('should return null id when not set', () => {
            expect(rel.id()).toBeNull();
        });
    });

    describe('Type operations', () => {
        test('should set and get type', () => {
            rel.setType('KNOWS');
            expect(rel.getType()).toBe('KNOWS');
        });
    });

    describe('Node operations', () => {
        test('should set from node', () => {
            rel.setFromNode(fromNode);
            expect(rel.getFromNode()).toBe(fromNode);
        });

        test('should set to node', () => {
            rel.setToNode(toNode);
            expect(rel.getToNode()).toBe(toNode);
        });

        test('should set both nodes', () => {
            rel.setFromNode(fromNode);
            rel.setToNode(toNode);
            expect(rel.getFromNode().id()).toBe(1);
            expect(rel.getToNode().id()).toBe(2);
        });
    });

    describe('Direction operations', () => {
        test('should set left direction', () => {
            rel.setLeftDirection();
            expect(rel.leftDirection()).toBe(true);
        });

        test('should set right direction', () => {
            rel.setRightDirection();
            expect(rel.rightDirection()).toBe(true);
        });

        test('should get direction string', () => {
            rel.setFromNode(fromNode);
            rel.setToNode(toNode);
            rel.setLeftDirection();
            expect(rel.direction()).toBe('left');
        });

        test('should check right direction string', () => {
            rel.setFromNode(fromNode);
            rel.setToNode(toNode);
            rel.setRightDirection();
            expect(rel.direction()).toBe('right');
        });

        test('should check uniDirectional', () => {
            // uniDirectional means no direction is set OR both directions are set
            // It represents an undirected relationship that can be traversed either way
            expect(rel.uniDirectional()).toBe(true);  // initially neither direction is set
            rel.setRightDirection();
            rel.setLeftDirection();
            expect(rel.uniDirectional()).toBe(true);  // both directions set
        });

        test('should check noDirection', () => {
            rel.setLeftDirection(false);
            rel.setRightDirection(false);
            expect(rel.noDirection()).toBe(true);
        });
    });

    describe('Property operations', () => {
        test('should set properties', () => {
            rel.setProperties({ weight: 5, active: true });
            const props = rel.getProperties();
            expect(props.weight).toBe(5);
            expect(props.active).toBe(true);
        });

        test('should get single property', () => {
            rel.setProperties({ name: 'rel1' });
            expect(rel.getProperty('name')).toBe('rel1');
        });

        test('should return undefined for non-existent property', () => {
            expect(rel.getProperty('nonexistent')).toBeUndefined();
        });
    });

    describe('Type checking', () => {
        test('should identify as relationship', () => {
            expect(rel.isRelationship()).toBe(true);
            expect(rel.isNode()).toBe(false);
        });
    });

    describe('Object conversion', () => {
        test('should convert to string', () => {
            rel.setId(1);
            rel.setType('KNOWS');
            rel.setFromNode(fromNode);
            rel.setToNode(toNode);
            rel.setRightDirection();
            rel.setProperties({ weight: 10 });

            const str = rel.toString();
            expect(str).toContain('1');
            expect(str).toContain('KNOWS');
        });
    });

    describe('Added state', () => {
        test('should set isAdded', () => {
            rel.setIsAdded(true);
            expect(rel.isAdded()).toBe(true);
        });
    });

    describe('Variable path length', () => {
        test('should check hasVariablePathLength', () => {
            rel._hasVariablePathLength = true;
            expect(rel.hasVariablePathLength()).toBe(true);
        });
    });

    describe('Grouping operations', () => {
        test('should provide groupByKey', () => {
            rel.setId(5);
            expect(rel.groupByKey()).toBe(5);
        });

        test('should provide groupByValue', () => {
            expect(rel.groupByValue()).toBe(rel);
        });
    });
});