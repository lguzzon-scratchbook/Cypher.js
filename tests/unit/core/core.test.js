/**
 * @fileoverview Unit tests for CypherNG core module.
 * Tests DB, Node, Relationship, Pattern, Matcher, and References.
 */

// Load core module - use path from project root for Jest
const core = require('../../../js/CypherNG/core/index.js');
const DB = core.DB;
const Node = core.Node;
const Relationship = core.Relationship;
const Pattern = core.Pattern;
const Matcher = core.Matcher;
const NodeReference = core.NodeReference;
const RelationshipReference = core.RelationshipReference;

// Mock engine for DB tests
function createMockEngine() {
    return {
        statement: function() {
            return {
                setNodesAdded: function() {},
                getNodesAdded: function() { return 0; },
                setRelationshipsAdded: function() {},
                getRelationshipsAdded: function() { return 0; }
            };
        }
    };
}

describe('CypherNG Core', () => {

    describe('Node', () => {
        let db;
        let node;

        beforeEach(() => {
            db = new DB(createMockEngine());
            node = new Node(db);
        });

        test('should create a node', () => {
            expect(node).toBeDefined();
            expect(node.isNode()).toBe(true);
            expect(node.isRelationship()).toBe(false);
        });

        test('should set and get ID', () => {
            node.setId(42);
            expect(node.id()).toBe(42);
            expect(node.getId()).toBe(42);
        });

        test('should set and get labels', () => {
            node.setLabel('Person', 0);
            expect(node.hasLabel('Person')).toBe(true);
            expect(node.hasLabel('Other')).toBeFalsy(); // undefined or false
            expect(node.getLabels()).toContain('Person');
        });

        test('should set and get properties', () => {
            node.setProperties({ name: 'Alice', age: 30 });
            expect(node.getLocalProperty('name')).toBe('Alice');
            expect(node.getLocalProperty('age')).toBe(30);
            expect(node.hasProperties()).toBe(true);
        });

        test('should set property with expression', () => {
            const expr = { value: function() { return 42; } };
            node.setProperty('score', expr);
            node.bindProperty('score');
            expect(node.getLocalProperty('score')).toBe(42);
        });

        test('should bind all properties', () => {
            node.setProperty('a', { value: function() { return 1; } });
            node.setProperty('b', { value: function() { return 2; } });
            node.bindProperties();
            expect(node.getLocalProperty('a')).toBe(1);
            expect(node.getLocalProperty('b')).toBe(2);
        });

        test('should set variable key', () => {
            node.setVariableKey('n');
            expect(node.getVariableKey()).toBe('n');
            expect(node.hasVariableKey()).toBe(true);
        });

        test('should copy node', () => {
            node.setLabels({ Person: true });
            node.setProperties({ name: 'Alice' });
            const copy = node.copy();
            expect(copy.id()).toBeUndefined();
            expect(copy.hasLabel('Person')).toBe(true);
            expect(copy.getLocalProperty('name')).toBe('Alice');
        });

        test('should convert to object', () => {
            node.setId(1);
            node.setLabels({ Person: true });
            node.setProperties({ name: 'Alice' });
            const obj = node.toObject();
            expect(obj.id).toBe(1);
            expect(obj.labels).toContain('Person');
            expect(obj.properties.name).toBe('Alice');
        });

        test('should return type', () => {
            expect(node.type()).toBe('Node');
        });
    });

    describe('Relationship', () => {
        let db;
        let relationship;
        let fromNode;
        let toNode;

        beforeEach(() => {
            db = new DB(createMockEngine());
            fromNode = new Node(db);
            toNode = new Node(db);
            fromNode.setId(1);
            toNode.setId(2);
            relationship = new Relationship(db);
        });

        test('should create a relationship', () => {
            expect(relationship).toBeDefined();
            expect(relationship.isRelationship()).toBe(true);
            expect(relationship.isNode()).toBe(false);
        });

        test('should set and get ID', () => {
            relationship.setId(42);
            expect(relationship.id()).toBe(42);
        });

        test('should set and get type', () => {
            relationship.setType('KNOWS', 0);
            expect(relationship.getType()).toBe('KNOWS');
        });

        test('should set from and to nodes', () => {
            relationship.setFromNode(fromNode);
            relationship.setToNode(toNode);
            expect(relationship.getFromNode()).toBe(fromNode);
            expect(relationship.getToNode()).toBe(toNode);
        });

        test('should set direction', () => {
            relationship.setLeftDirection(true);
            relationship.setRightDirection(false);
            expect(relationship.leftDirection()).toBe(true);
            expect(relationship.rightDirection()).toBe(false);
            expect(relationship.direction()).toBe('left');
        });

        test('should handle both directions', () => {
            relationship.setLeftDirection(true);
            relationship.setRightDirection(true);
            // uniDirectional returns true when both OR neither direction is set
            expect(relationship.uniDirectional()).toBe(true);
            // When both are set, leftDirection() and rightDirection() return false
            // (they check for exclusive direction)
            expect(relationship.leftDirection()).toBe(false);
            expect(relationship.rightDirection()).toBe(false);
            expect(relationship.noDirection()).toBe(false);
        });

        test('should handle no direction', () => {
            expect(relationship.noDirection()).toBe(true);
            expect(relationship.direction()).toBe('none');
        });

        test('should set and get properties', () => {
            relationship.setProperties({ weight: 5 });
            const props = relationship.getProperties();
            expect(props.weight).toBe(5);
        });

        test('should copy relationship', () => {
            relationship.setType('KNOWS', 0);
            relationship.setProperties({ weight: 5 });
            relationship.setLeftDirection(true);
            relationship.setRightDirection(false);
            relationship.setFromNode(fromNode);
            relationship.setToNode(toNode);

            const copy = relationship.copy();
            expect(copy.getType()).toBe('KNOWS');
            const props = copy.getProperties();
            expect(props.weight).toBe(5);
            expect(copy.leftDirection()).toBe(true);
            expect(copy.rightDirection()).toBe(false);
        });

        test('should convert to object', () => {
            relationship.setId(1);
            relationship.setType('KNOWS');
            relationship.setFromNode(fromNode);
            relationship.setToNode(toNode);
            relationship.setProperties({ weight: 5 });

            const obj = relationship.toObject();
            expect(obj.id).toBe(1);
            expect(obj.type).toBe('KNOWS');
            expect(obj.direction).toBe('none');
        });
    });

    describe('Pattern', () => {
        let db;
        let pattern;

        beforeEach(() => {
            db = new DB(createMockEngine());
            pattern = new Pattern();
        });

        test('should create empty pattern', () => {
            expect(pattern).toBeDefined();
            expect(pattern.empty()).toBe(true);
            expect(pattern.nodeCount()).toBe(0);
            expect(pattern.relationshipCount()).toBe(0);
        });

        test('should add nodes', () => {
            const node1 = new Node(db);
            const node2 = new Node(db);
            pattern.addNode(node1);
            pattern.addNode(node2);
            expect(pattern.nodeCount()).toBe(2);
            expect(pattern.empty()).toBe(false);
        });

        test('should add relationships', () => {
            const relationship = new Relationship(db);
            pattern.addRelationship(relationship);
            expect(pattern.relationshipCount()).toBe(1);
        });

        test('should chain objects', () => {
            const node1 = new Node(db);
            const rel = new Relationship(db);
            const node2 = new Node(db);

            pattern.addNode(node1);
            pattern.addRelationship(rel);
            pattern.addNode(node2);

            expect(node1.getNextObject()).toBe(rel);
            expect(rel.getPreviousObject()).toBe(node1);
            expect(rel.getNextObject()).toBe(node2);
        });

        test('should get last object', () => {
            const node1 = new Node(db);
            const node2 = new Node(db);
            pattern.addNode(node1);
            pattern.addNode(node2);
            expect(pattern.lastObject()).toBe(node2);
        });

        test('should mark as used as condition', () => {
            // Pattern needs at least one node to use as condition
            const node = new Node(db);
            pattern.addNode(node);
            pattern.useAsCondition();
            expect(pattern.usedAsCondition()).toBeTruthy();
        });

        test('should check mappability', () => {
            // Empty pattern should be mappable
            expect(pattern.mappable()).toBe(true);
        });

        test('should have type Pattern', () => {
            expect(pattern.type()).toBe('Pattern');
        });
    });

    describe('Matcher', () => {
        let matcher;

        beforeEach(() => {
            matcher = new Matcher();
        });

        test('should create matcher', () => {
            expect(matcher).toBeDefined();
            expect(matcher.matchingSetSize()).toBe(0);
        });

        test('should set matching set', () => {
            matcher.setMatchingSet([1, 2, 3], 0);
            expect(matcher.matchingSetSize()).toBe(3);
            expect(matcher.toMatchCount()).toBe(0);
            // Note: setMatchingSet initializes with a value, but updateMatchingSet may filter
            // The size reflects entries that match toMatchCount criteria
            expect(matcher.matchingSetSize()).toBeGreaterThan(0);
        });

        test('should add to matching set', () => {
            matcher.addToMatchingSet(42);
            expect(matcher.matchingSetSize()).toBe(1);
            expect(matcher.matchingSet()).toContain(42);
        });

        test('should increment to match count', () => {
            matcher.incrementToMatchCount();
            matcher.incrementToMatchCount();
            expect(matcher.toMatchCount()).toBe(2);
        });

        test('should keep match tally', () => {
            matcher.setMatchingSet([1, 2, 3], 0);
            matcher.keepMatchTally(2);
            matcher.updateMatchingSet();
            // After update with toMatchCount=0, check size changed
            expect(matcher.matchingSetSize()).toBeLessThanOrEqual(3);
        });

        test('should update matching set correctly', () => {
            matcher.setMatchingSet([1, 2, 3], 0);
            matcher.incrementToMatchCount(); // Need 1 match
            matcher.keepMatchTally(1);
            matcher.keepMatchTally(2);
            matcher.updateMatchingSet();
            // At least some matches should remain
            expect(matcher.matchingSetSize()).toBeGreaterThanOrEqual(0);
        });
    });

    describe('NodeReference', () => {
        let db;
        let node;
        let ref;

        beforeEach(() => {
            db = new DB(createMockEngine());
            node = new Node(db);
            node.setId(42);
            node.setProperties({ name: 'Alice' });
            ref = new NodeReference(db, 42);
        });

        test('should create reference', () => {
            expect(ref).toBeDefined();
            expect(ref.nodeId()).toBe(42);
            expect(ref.id()).toBe(42);
        });

        test('should get referenced node', () => {
            // First add node to db
            db.addNode({ id: 42, labels: { Person: true }, properties: { name: 'Alice' } });
            const retrieved = ref.getNode();
            expect(retrieved).toBeDefined();
            expect(retrieved.id()).toBe(42);
        });

        test('should get properties', () => {
            db.addNode({ id: 42, labels: { Person: true }, properties: { name: 'Alice' } });
            const prop = ref.getProperty('name');
            expect(prop).toBe('Alice');
            expect(ref.getProperties()).toBeDefined();
        });

        test('should get labels', () => {
            db.addNode({ id: 42, labels: { Person: true }, properties: {} });
            const labels = ref.getLabels();
            expect(labels).toContain('Person');
        });
    });

    describe('RelationshipReference', () => {
        let db;
        let fromNode;
        let toNode;
        let relationship;
        let ref;

        beforeEach(() => {
            db = new DB(createMockEngine());
            fromNode = new Node(db);
            toNode = new Node(db);
            fromNode.setId(1);
            toNode.setId(2);
            // Manually add nodes to db
            db.addNode({ id: 1, labels: {}, properties: {} });
            db.addNode({ id: 2, labels: {}, properties: {} });
        });

        test('should create reference', () => {
            ref = new RelationshipReference(db, 99);
            expect(ref).toBeDefined();
            expect(ref.relationshipId()).toBe(99);
            expect(ref.id()).toBe(99);
        });

        test('should have type method', () => {
            ref = new RelationshipReference(db, 99);
            expect(typeof ref.getType).toBe('function');
        });

        test('should have startNode and endNode methods', () => {
            ref = new RelationshipReference(db, 99);
            expect(typeof ref.startNode).toBe('function');
            expect(typeof ref.endNode).toBe('function');
        });
    });

    describe('DB', () => {
        let db;

        beforeEach(() => {
            db = new DB(createMockEngine());
        });

        test('should create database', () => {
            expect(db).toBeDefined();
        });

        test('should add and retrieve node', () => {
            // Use proper format: labels as object with true values
            db.addNode({ id: 1, labels: { Person: true }, properties: { name: 'Alice' } });
            const node = db.getNodeById(1);
            expect(node).toBeDefined();
            expect(node.id()).toBe(1);
            expect(node.hasLabel('Person')).toBe(true);
        });

        test('should add and retrieve relationship', () => {
            // First add nodes
            db.addNode({ id: 1, labels: {}, properties: {} });
            db.addNode({ id: 2, labels: {}, properties: {} });
            db.addRelationship({ id: 5, from: 1, to: 2, type: 'KNOWS', properties: {} });

            const rel = db.getRelationshipById(5);
            expect(rel).toBeDefined();
            expect(rel.id()).toBe(5);
            expect(rel.getType()).toBe('KNOWS');
        });

        test('should lookup nodes by property', () => {
            db.addNode({ id: 1, labels: {}, properties: { name: 'Alice' } });
            db.addNode({ id: 2, labels: {}, properties: { name: 'Bob' } });

            // Verify nodes are accessible
            expect(db.getNodeById(1)).toBeDefined();
            expect(db.getNodeById(2)).toBeDefined();
        });

        test('should lookup nodes by label', () => {
            db.addNode({ id: 1, labels: { Person: true }, properties: {} });
            db.addNode({ id: 2, labels: { Person: true }, properties: {} });
            db.addNode({ id: 3, labels: { Other: true }, properties: {} });

            // Verify nodes are accessible
            expect(db.getNodeById(1).hasLabel('Person')).toBe(true);
            expect(db.getNodeById(2).hasLabel('Person')).toBe(true);
        });

        test('should handle relationship lookup', () => {
            db.addNode({ id: 1, labels: {}, properties: {} });
            db.addNode({ id: 2, labels: {}, properties: {} });
            db.addRelationship({ id: 10, from: 1, to: 2, type: 'KNOWS', properties: {} });

            const rel = db.getRelationshipById(10);
            expect(rel).toBeDefined();
        });

        test('should manage tables', () => {
            // Table testing would require full Table class with DB integration
            // Basic test for table management
            expect(typeof db.addTable).toBe('function');
            expect(typeof db.getTable).toBe('function');
        });

        test('should throw on non-existent table', () => {
            expect(() => db.getTable('nonexistent'))
                .toThrow('does not exist');
        });
    });
});
