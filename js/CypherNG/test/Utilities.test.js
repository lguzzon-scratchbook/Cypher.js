/**
 * Test suite for utility classes
 * @fileoverview Tests for StringRecoder and GroupBy
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import StringRecoder from '../utils/StringRecoder.js';
import GroupBy from '../query/GroupBy.js';

describe('CypherNG StringRecoder Class', () => {
    /** @type {StringRecoder} */
    let recoder;

    beforeEach(() => {
        recoder = new StringRecoder();
    });

    describe('Constructor', () => {
        test('should create StringRecoder', () => {
            expect(recoder).not.toBeNull();
        });
    });

    describe('recode', () => {
        test('should recode string to hash', () => {
            const code = recoder.recode('test');
            expect(typeof code).toBe('number');
        });

        test('should recode same string to same hash', () => {
            const code1 = recoder.recode('test');
            const code2 = recoder.recode('test');
            expect(code1).toBe(code2);
        });

        test('should recode different strings to different hashes', () => {
            const code1 = recoder.recode('test1');
            const code2 = recoder.recode('test2');
            expect(code1).not.toBe(code2);
        });

        test('should handle null', () => {
            const result = recoder.recode(null);
            expect(result).toBeNull();
        });

        test('should handle undefined', () => {
            const result = recoder.recode(undefined);
            expect(result).toBeUndefined();
        });

        test('should handle numbers', () => {
            const result = recoder.recode(123);
            expect(typeof result).toBe('number');
        });

        test('should handle boolean', () => {
            const result = recoder.recode(true);
            expect(typeof result).toBe('number');
        });

        test('should handle strings without charAt', () => {
            // Test with object that doesn't have charAt method
            const obj = { toString: () => 'test' };
            const result = recoder.recode(obj);
            expect(typeof result).toBe('number');
        });
    });
});

describe('CypherNG GroupBy Class', () => {
    /** @type {GroupBy} */
    let groupBy;
    /** @type {Object} */
    let mockContext;

    beforeEach(() => {
        mockContext = {
            setNextMapValue: () => {},
            moveToPreviousMapValue: () => {},
            addAggregateOutputRecord: () => {}
        };
        groupBy = new GroupBy(mockContext);
    });

    describe('Constructor', () => {
        test('should create GroupBy', () => {
            expect(groupBy).not.toBeNull();
        });

        test('should initialize with null trie root', () => {
            expect(groupBy.getTrieRoot()).toBeNull();
        });
    });

    describe('beginMap', () => {
        test('should initialize trie root', () => {
            groupBy.beginMap();
            expect(groupBy.getTrieRoot()).not.toBeNull();
        });
    });

    describe('map', () => {
        test('should map element', () => {
            groupBy.beginMap();
            const element = {
                groupByKey: () => 'key1',
                groupByValue: () => 'value1'
            };
            // Should not throw
            expect(() => groupBy.map(element)).not.toThrow();
        });

        test('should handle element without groupByKey', () => {
            groupBy.beginMap();
            const element = 'simpleValue';
            groupBy.map(element);
        });
    });

    describe('addReducer', () => {
        test('should return reducer index', () => {
            const idx1 = groupBy.addReducer();
            const idx2 = groupBy.addReducer();
            expect(idx1).toBe(0);
            expect(idx2).toBe(1);
        });

        test('should increment reducers count', () => {
            groupBy.addReducer();
            groupBy.addReducer();
            groupBy.addReducer();
            const idx = groupBy.addReducer();
            expect(idx).toBe(3);
        });
    });

    describe('getReducer', () => {
        test('should create and return reducer', () => {
            const reducerIdx = groupBy.addReducer();
            const reducer = groupBy.getReducer(reducerIdx);
            expect(reducer).toEqual({});
        });
    });

    describe('print', () => {
        test('should not throw when called', () => {
            expect(() => groupBy.print()).not.toThrow();
        });
    });
});