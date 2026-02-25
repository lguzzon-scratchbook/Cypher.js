/**
 * Test suite for Database class
 * @fileoverview Tests for CypherNG Database class
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import Database from '../data/Database.js';
import Node from '../data/Node.js';
import Relationship from '../data/Relationship.js';

describe('CypherNG Database Class', () => {
    /** @type {Database} */
    let db;
    /** @type {Object} */
    let mockEngine;

    beforeEach(() => {
        mockEngine = {
            statement: () => ({
                getNodesAdded: () => 0,
                setNodesAdded: () => {},
                getRelationshipsAdded: () => 0,
                setRelationshipsAdded: () => {}
            })
        };
        db = new Database(mockEngine);
    });

    describe('Constructor', () => {
        test('should create empty database', () => {
            expect(db.nodeCount()).toBe(0);
            expect(db.relationshipCount()).toBe(0);
        });

        test('should accept storage adapter', () => {
            const adapter = { addNode: () => {} };
            const dbWithAdapter = new Database(mockEngine, adapter);
            expect(dbWithAdapter.getStorageAdapter()).toBe(adapter);
        });
    });

    describe('Node operations', () => {
        test('should add node without specific ID', () => {
            const node = new Node(db);
            node.setProperties({ name: 'Test' });
            db.addNode(node);
            expect(db.nodeCount()).toBe(1);
            expect(node.id()).not.toBeNull();
        });

        test('should add node with specific ID', () => {
            const node = new Node(db);
            node.setProperties({ name: 'Test' });
            db.addNode(node, 100);
            expect(db.nodeCount()).toBe(1);
            expect(node.id()).toBe(100);
        });

        test('should throw when adding node with existing ID', () => {
            const node1 = new Node(db);
            db.addNode(node1, 1);
            const node2 = new Node(db);
            expect(() => db.addNode(node2, 1)).toThrow();
        });

        test('should get node by ID', () => {
            const node = new Node(db);
            node.setId(42);
            db.addNode(node);
            expect(db.getNodeById(42)).toBe(node);
        });

        test('should return null for non-existent node', () => {
            expect(db.getNodeById(999)).toBeNull();
        });

        test('should get all nodes', () => {
            const node1 = new Node(db);
            const node2 = new Node(db);
            db.addNode(node1);
            db.addNode(node2);
            const nodes = db.getNodes();
            expect(nodes.filter(n => n)).toHaveLength(2);
        });

        test('should index node by property', () => {
            const node = new Node(db);
            node.setProperties({ name: 'John', age: 30 });
            db.addNode(node);
            const found = db.getNodesByProperty('name', 'John');
            expect(found).toHaveLength(1);
            expect(found[0].id()).toBe(node.id());
        });

        test('should index node by label', () => {
            const node = new Node(db);
            node.setId(1);
            node.setLabel('Person', 1);
            node.setLabel('Developer', 1);
            db.addNode(node);
            const persons = db.getNodesByLabel('Person');
            expect(persons).toHaveLength(1);
            const developers = db.getNodesByLabel('Developer');
            expect(developers).toHaveLength(1);
        });

        test('should get all labels', () => {
            const node = new Node(db);
            node.setId(1);
            node.setLabel('Person', 1);
            db.addNode(node);
            expect(db.getLabels()).toContain('Person');
        });
    });

    describe('Relationship operations', () => {
        /** @type {Node} */
        let node1;
        /** @type {Node} */
        let node2;

        beforeEach(() => {
            node1 = new Node(db);
            node1.setId(1);
            node2 = new Node(db);
            node2.setId(2);
            db.addNode(node1);
            db.addNode(node2);
        });

        test('should add relationship', () => {
            const rel = new Relationship(db);
            rel.setType('KNOWS');
            rel.setFromNode(node1);
            rel.setToNode(node2);
            rel.setRightDirection();
            db.addRelationship(rel);
            expect(db.relationshipCount()).toBe(1);
            expect(rel.id()).not.toBeNull();
        });

        test('should add relationship with specific ID', () => {
            const rel = new Relationship(db);
            rel.setType('KNOWS');
            rel.setFromNode(node1);
            rel.setToNode(node2);
            rel.setRightDirection();
            db.addRelationship(rel, 50);
            expect(db.relationshipCount()).toBe(1);
            expect(rel.id()).toBe(50);
        });

        test('should get relationship by ID', () => {
            const rel = new Relationship(db);
            rel.setType('KNOWS');
            rel.setFromNode(node1);
            rel.setToNode(node2);
            rel.setRightDirection();
            db.addRelationship(rel, 42);
            expect(db.getRelationshipById(42)).toBe(rel);
        });

        test('should return null for non-existent relationship', () => {
            expect(db.getRelationshipById(999)).toBeNull();
        });

        test('should get all relationships', () => {
            const rel1 = new Relationship(db);
            rel1.setType('KNOWS');
            rel1.setFromNode(node1);
            rel1.setToNode(node2);
            rel1.setRightDirection();

            const node3 = new Node(db);
            node3.setId(3);
            db.addNode(node3);

            const rel2 = new Relationship(db);
            rel2.setType('LIKES');
            rel2.setFromNode(node2);
            rel2.setToNode(node3);
            rel2.setRightDirection();

            db.addRelationship(rel1);
            db.addRelationship(rel2);
            const rels = db.getRelationships();
            expect(rels.filter(r => r)).toHaveLength(2);
        });

        test('should get relationships by type', () => {
            const rel = new Relationship(db);
            rel.setType('KNOWS');
            rel.setFromNode(node1);
            rel.setToNode(node2);
            rel.setRightDirection();
            db.addRelationship(rel);

            const found = db.getRelationshipsByType('KNOWS');
            expect(found).toHaveLength(1);
            expect(found[0].getType()).toBe('KNOWS');
        });

        test('should get relationships between nodes', () => {
            const rel = new Relationship(db);
            rel.setType('KNOWS');
            rel.setFromNode(node1);
            rel.setToNode(node2);
            rel.setRightDirection();
            db.addRelationship(rel);

            const found = db.getRelationshipsBetween(1, 2);
            expect(found).toHaveLength(1);
        });

        test('should get all relationship types', () => {
            const rel = new Relationship(db);
            rel.setType('KNOWS');
            rel.setFromNode(node1);
            rel.setToNode(node2);
            rel.setRightDirection();
            db.addRelationship(rel);

            expect(db.getRelationshipTypes()).toContain('KNOWS');
        });

        test('should get relationships by node ID', () => {
            const rel = new Relationship(db);
            rel.setType('KNOWS');
            rel.setFromNode(node1);
            rel.setToNode(node2);
            rel.setRightDirection();
            db.addRelationship(rel);

            const node1Rels = db.getRelationshipsByNodeId(1);
            expect(node1Rels.length).toBeGreaterThan(0);
        });
    });

    describe('Clear operations', () => {
        test('should clear database', () => {
            const node = new Node(db);
            db.addNode(node);
            expect(db.nodeCount()).toBe(1);

            db.clear();
            expect(db.nodeCount()).toBe(0);
            expect(db.relationshipCount()).toBe(0);
        });

        test('should call storage adapter clear', () => {
            let clearCalled = false;
            const adapter = { clear: () => { clearCalled = true; } };
            const dbWithAdapter = new Database(mockEngine, adapter);
            dbWithAdapter.clear();
            expect(clearCalled).toBe(true);
        });
    });

    describe('Storage adapter operations', () => {
        test('should get storage adapter', () => {
            const adapter = { test: 'adapter' };
            const dbWithAdapter = new Database(mockEngine, adapter);
            expect(dbWithAdapter.getStorageAdapter()).toEqual({ test: 'adapter' });
        });

        test('should set storage adapter', () => {
            const adapter1 = { id: 1 };
            const adapter2 = { id: 2 };
            const dbWithAdapter = new Database(mockEngine, adapter1);
            expect(dbWithAdapter.getStorageAdapter()).toEqual({ id: 1 });

            dbWithAdapter.setStorageAdapter(adapter2);
            expect(dbWithAdapter.getStorageAdapter()).toEqual({ id: 2 });
        });

        test('should call storage adapter on addNode', () => {
            let addNodeCalled = false;
            const adapter = {
                addNode: (node) => { addNodeCalled = true; }
            };
            const dbWithAdapter = new Database(mockEngine, adapter);

            const node = new Node(dbWithAdapter);
            node.setId(1);
            dbWithAdapter.addNode(node);

            expect(addNodeCalled).toBe(true);
        });

        test('should call storage adapter on addRelationship', () => {
            let addRelCalled = false;
            const adapter = {
                addRelationship: (rel) => { addRelCalled = true; }
            };
            const dbWithAdapter = new Database(mockEngine, adapter);

            const node1 = new Node(dbWithAdapter);
            const node2 = new Node(dbWithAdapter);
            dbWithAdapter.addNode(node1);
            dbWithAdapter.addNode(node2);

            const rel = new Relationship(dbWithAdapter);
            rel.setType('TEST');
            rel.setFromNode(node1);
            rel.setToNode(node2);
            rel.setRightDirection();
            dbWithAdapter.addRelationship(rel);

            expect(addRelCalled).toBe(true);
        });
    });

    describe('Type operations', () => {
        test('should return type name', () => {
            expect(db.type()).toBe('Database');
        });
    });
});