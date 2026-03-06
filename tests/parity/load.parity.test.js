const { runTwinQuery } = require('./helpers/engines');
const { normalizeExecution } = require('./helpers/normalizeResult');

describe('Cypher parity: LOAD behavior', () => {
    const originalXMLHttpRequest = global.XMLHttpRequest;

    class MockXMLHttpRequest {
        open(method, url, async) {
            this.method = method;
            this.url = url;
            this.async = async;
        }

        setRequestHeader(key, value) {
            this.headers = this.headers || {};
            this.headers[key] = value;
        }

        send() {
            const routes = {
                'http://example.test/json': { status: 200, responseText: '[{"a":1},{"a":2}]' },
                'http://example.test/text': { status: 200, responseText: 'hello' },
                'http://example.test/object': { status: 200, responseText: '{"a":1}' },
                'http://example.test/csv': { status: 200, responseText: 'name,age\nAlice,30\nBob,40\n' },
                'http://example.test/post': { status: 200, responseText: 'posted' },
                'http://example.test/boom': { status: 500, responseText: 'boom' }
            };
            const route = routes[this.url] || { status: 404, responseText: 'missing' };

            this.status = route.status;
            this.responseText = route.responseText;
            this.readyState = 4;
            this.onreadystatechange();
        }
    }

    beforeEach(() => {
        global.XMLHttpRequest = MockXMLHttpRequest;
    });

    afterEach(() => {
        if (originalXMLHttpRequest === undefined) {
            delete global.XMLHttpRequest;
        } else {
            global.XMLHttpRequest = originalXMLHttpRequest;
        }
    });

    test.each([
        {
            name: 'JSON array loading matches legacy output',
            query: "LOAD JSON FROM 'http://example.test/json' AS row RETURN row AS data"
        },
        {
            name: 'TEXT loading matches legacy output',
            query: "LOAD TEXT FROM 'http://example.test/text' AS row RETURN row AS data"
        },
        {
            name: 'JSON object projection matches legacy output',
            query: "LOAD JSON FROM 'http://example.test/object' AS row RETURN row.a AS a"
        },
        {
            name: 'CSV with headers matches legacy output',
            query: "LOAD CSV WITH HEADERS FROM 'http://example.test/csv' FIELDTERMINATOR ',' AS row RETURN row.name AS name, row.age AS age"
        },
        {
            name: 'TEXT POST loading matches legacy output',
            query: "LOAD TEXT FROM 'http://example.test/post' POST {hello:'world'} AS row RETURN row AS data"
        },
        {
            name: 'failing LOAD request matches legacy error',
            query: "LOAD TEXT FROM 'http://example.test/boom' AS row RETURN row AS data"
        }
    ])('$name', async ({ query }) => {
        const { legacy, ng } = await runTwinQuery(query);

        expect(normalizeExecution(ng)).toEqual(normalizeExecution(legacy));
    });
});