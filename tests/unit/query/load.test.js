describe('CypherNG Load operation', () => {
    const originalSelf = global.self;

    beforeEach(() => {
        jest.resetModules();
    });

    afterEach(() => {
        if (originalSelf === undefined) {
            delete global.self;
        } else {
            global.self = originalSelf;
        }
    });

    function createStatement(proxy) {
        const overrides = [];
        const variableMap = {
            keep: { setOverriddenValue: (value) => overrides.push(['keep', value]) }
        };
        const vars = [{ getObjectKey: () => 'keep', value: () => 'seed' }];
        return {
            statement: {
                engine: () => ({ getDataDownloadProxy: () => proxy || null }),
                addVariable: jest.fn(),
                variables: () => vars,
                getVariable: (key) => variableMap[key]
            },
            overrides
        };
    }

    test('tracks configuration, variable storage, and direct JSON iteration', () => {
        const { Load } = require('../../../js/CypherNG/query/operations/Load.js');
        const { statement, overrides } = createStatement();
        const load = new Load(statement);
        const seen = [];

        load.json();
        load.expression({ value: () => [{ a: 1 }, { a: 2 }] });
        load.variable('row');
        load.setHTTPHeaders({ value: () => ({ Accept: 'application/json' }) });
        expect(load.getHTTPHeaders().value()).toEqual({ Accept: 'application/json' });
        expect(load.loadType()).toBe('JSON');
        expect(load.getRequestType()).toBe('GET');
        expect(load.getLast().value()).toEqual([{ a: 1 }, { a: 2 }]);
        expect(load.from()).toEqual([{ a: 1 }, { a: 2 }]);
        expect(load.statement()).toBe(statement);
        expect(load.getData()).toBe(load);
        expect(load.type()).toBe('Load');
        expect(load.variables()).toBe(statement.variables());
        expect(load.isVariablesEmpty()).toBe(true);
        const key = load.saveVariables();
        expect(load.isVariablesEmpty()).toBe(false);
        load.setVariables(key);
        load.removeVariables(key);
        expect(overrides).toEqual([['keep', 'seed'], ['keep', null]]);
        expect(load.isVariablesEmpty()).toBe(true);

        const nextOperation = { setPreviousOperation: jest.fn(), doIt: jest.fn(() => seen.push(load.get().a)), finish: jest.fn() };
        load.setNextOperation(nextOperation);
        load.run();

        expect(statement.addVariable).toHaveBeenCalledWith('row', load);
        expect(nextOperation.setPreviousOperation).toHaveBeenCalledWith(load);
        expect(seen).toEqual([1, 2]);
        expect(load.value().a).toBe(2);
        expect(load.groupByKey().a).toBe(2);
        expect(load.groupByValue().a).toBe(2);
        expect(nextOperation.finish).not.toHaveBeenCalled();
        expect(load.isVariablesEmpty()).toBe(false);
    });

    test('loads CSV over GET with proxy, headers, and field terminators', () => {
        jest.doMock('../../../js/CypherNG/network/HTTP.js', () => ({
            HTTP: jest.fn().mockImplementation(() => ({
                get: (url, headers, ok) => {
                    expect(url).toBe('/proxy/http://example.test/data.csv');
                    expect(headers).toEqual({ Accept: 'text/csv' });
                    ok('name;age\nAlice;30\nBob;40\n');
                }
            }))
        }));
        const { Load } = require('../../../js/CypherNG/query/operations/Load.js');
        const { statement, overrides } = createStatement('/proxy/');
        const load = new Load(statement);
        const rows = [];

        load.csv();
        load.headers();
        load.setFieldTerminator(';');
        load.setHTTPHeaders({ value: () => ({ Accept: 'text/csv' }) });
        load.expression({ value: () => 'http://example.test/data.csv' });
        expect(() => load.setFieldTerminator('::')).toThrow(/one char/i);

        const nextOperation = {
            setPreviousOperation: jest.fn(),
            doIt: jest.fn(() => rows.push({ name: load.getProperty('name'), age: load.getProperty('age') })),
            finish: jest.fn()
        };
        load.setNextOperation(nextOperation);
        load.run();

        expect(rows).toEqual([{ name: 'Alice', age: '30' }, { name: 'Bob', age: '40' }]);
        expect(nextOperation.finish).toHaveBeenCalled();
        expect(overrides).toEqual([['keep', 'seed'], ['keep', null]]);
        expect(load.isVariablesEmpty()).toBe(true);
    });

    test('loads TEXT over POST and forwards payload and headers', () => {
        jest.doMock('../../../js/CypherNG/network/HTTP.js', () => ({
            HTTP: jest.fn().mockImplementation(() => ({
                post: (url, body, headers, ok) => {
                    expect(url).toBe('/proxy/http://example.test/echo');
                    expect(body).toEqual({ hello: 'world' });
                    expect(headers).toEqual({ Accept: 'text/plain' });
                    ok('done');
                }
            }))
        }));
        const { Load } = require('../../../js/CypherNG/query/operations/Load.js');
        const { statement } = createStatement('/proxy/');
        const load = new Load(statement);
        const seen = [];

        load.text();
        load.post();
        load.expression({ value: () => 'http://example.test/echo' });
        load.expression({ value: () => ({ hello: 'world' }) });
        load.setHTTPHeaders({ value: () => ({ Accept: 'text/plain' }) });
        expect(load.getRequestType()).toBe('POST');
        expect(load.getPayload()).toEqual({ hello: 'world' });

        const nextOperation = { setPreviousOperation: jest.fn(), doIt: jest.fn(() => seen.push(load.get())), finish: jest.fn() };
        load.setNextOperation(nextOperation);
        load.doIt();
        load.finish();

        expect(seen).toEqual(['done']);
        expect(nextOperation.finish).toHaveBeenCalled();
    });

    test('delegates GET errors to self.onerror when available', () => {
        const onerror = jest.fn();
        global.self = { onerror };

        jest.doMock('../../../js/CypherNG/network/HTTP.js', () => ({
            HTTP: jest.fn().mockImplementation(() => ({
                get: (url, headers, ok, fail) => {
                    expect(url).toBe('http://example.test/broken');
                    fail('Request failed with status 500');
                }
            }))
        }));

        const { Load } = require('../../../js/CypherNG/query/operations/Load.js');
        const { statement } = createStatement();
        const load = new Load(statement);
        load.text();
        load.expression({ value: () => 'http://example.test/broken' });
        load.setNextOperation({ setPreviousOperation: jest.fn(), doIt: jest.fn(), finish: jest.fn() });

        load.run();

        expect(onerror).toHaveBeenCalledWith(
            'Error loading data from http://example.test/broken: Request failed with status 500'
        );
    });

    test('throws wrapped POST errors when no global self handler exists', () => {
        delete global.self;

        jest.doMock('../../../js/CypherNG/network/HTTP.js', () => ({
            HTTP: jest.fn().mockImplementation(() => ({
                post: (url, body, headers, ok, fail) => {
                    expect(url).toBe('http://example.test/fail-post');
                    fail('Request failed with status 418');
                }
            }))
        }));

        const { Load } = require('../../../js/CypherNG/query/operations/Load.js');
        const { statement } = createStatement();
        const load = new Load(statement);
        load.text();
        load.post();
        load.expression({ value: () => 'http://example.test/fail-post' });
        load.expression({ value: () => ({ hello: 'world' }) });
        load.setNextOperation({ setPreviousOperation: jest.fn(), doIt: jest.fn(), finish: jest.fn() });

        expect(() => load.run()).toThrow(
            'Error loading data from http://example.test/fail-post: Request failed with status 418'
        );
    });
});