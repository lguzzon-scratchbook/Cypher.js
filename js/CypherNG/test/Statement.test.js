/**
 * Test suite for Statement and Variable classes
 * @fileoverview Tests for Statement and Variable classes
 */

import { describe, test, expect, beforeEach } from 'bun:test';

// First, let's test the Statement class
const Statement = require('../parser/Statement.js').Statement;
const Variable = require('../query/Variable.js');

describe('CypherNG Statement Class', () => {
    /** @type {Statement} */
    let statement;
    /** @type {Object} */
    let mockEngine;

    beforeEach(() => {
        mockEngine = {};
        statement = new Statement(mockEngine);
    });

    describe('Constructor', () => {
        test('should create empty statement', () => {
            expect(statement.operations()).toEqual([]);
            expect(statement.variables()).toEqual([]);
        });
    });

    describe('addOperation', () => {
        test('should add operation to statement', () => {
            const mockOp = {
                setNextOperation: () => {}
            };
            statement.addOperation(mockOp);
            expect(statement.operations()).toHaveLength(1);
        });

        test('should throw when adding RETURN after RETURN', () => {
            const mockReturnOp = {
                type: () => 'Return',
                setNextOperation: () => {}
            };
            statement.addOperation(mockReturnOp);
            expect(() => {
                statement.addOperation(mockReturnOp);
            }).toThrow();
        });

        test('should chain operations', () => {
            let chainCalled = false;
            const op1 = {
                setNextOperation: (op) => {
                    chainCalled = true;
                }
            };
            const op2 = { setNextOperation: () => {} };
            statement.addOperation(op1);
            statement.addOperation(op2);
            expect(chainCalled).toBe(true);
        });
    });

    describe('property key', () => {
        test('should set and get property key', () => {
            statement.setPropertyKey('name');
            expect(statement.getPropertyKey()).toBe('name');
        });
    });

    describe('context operations', () => {
        test('should get context', () => {
            const mockOp = { type: () => 'Match' };
            statement.addOperation(mockOp);
            expect(statement.context()).toBe(mockOp);
        });

        test('should set and reset context', () => {
            const mockOp1 = { type: () => 'Match' };
            const mockOp2 = { type: () => 'Return' };
            statement.addOperation(mockOp1);
            statement.setContext(mockOp2);
            expect(statement.context()).toBe(mockOp2);
            statement.resetContext();
            expect(statement.context()).toBe(mockOp1);
        });
    });

    describe('clear', () => {
        test('should clear statement state', () => {
            const mockOp = {};
            statement.addOperation(mockOp);
            statement.setPropertyKey('key');
            statement.clear();
            expect(statement.operations()).toEqual([]);
            expect(statement.context()).toBeUndefined();
            expect(statement.getPropertyKey()).toBeUndefined();
        });
    });

    describe('engine', () => {
        test('should get engine', () => {
            expect(statement.engine()).toBe(mockEngine);
        });
    });

    describe('output operations', () => {
        test('should add output record', () => {
            statement.addOutputRecord();
            const results = statement.results();
            expect(results.output).toHaveLength(1);
        });
    });

    describe('success callback', () => {
        test('should set and call success callback', () => {
            let called = false;
            statement.setSuccessCallback((results) => {
                called = true;
            });
            statement.success();
            expect(called).toBe(true);
        });
    });
});

describe('CypherNG Variable Class (from query/Variable)', () => {
    /** @type {Variable} */
    let variable;

    beforeEach(() => {
        variable = new Variable({ id: 1 }, 'n');
    });

    describe('Constructor', () => {
        test('should create variable', () => {
            expect(variable.getObjectKey()).toBe('n');
        });
    });

    describe('getObject', () => {
        test('should return object', () => {
            expect(variable.getObject()).toEqual({ id: 1 });
        });

        test('should return overridden value when set', () => {
            variable.setOverriddenValue({ id: 999 });
            expect(variable.getObject()).toEqual({ id: 999 });
        });
    });

    describe('value', () => {
        test('should return null when no getData method', () => {
            const v = new Variable({ test: 'value' }, 'n');
            expect(v.value()).toBeNull();
        });

        test('should return overridden value', () => {
            variable.setOverriddenValue('override');
            expect(variable.value()).toBe('override');
        });
    });

    describe('type', () => {
        test('should return type name', () => {
            expect(variable.type()).toBe('Variable');
        });
    });
});