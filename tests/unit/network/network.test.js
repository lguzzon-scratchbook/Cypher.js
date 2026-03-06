describe('CypherNG network helpers', () => {
    const originalXMLHttpRequest = global.XMLHttpRequest;

    afterEach(() => {
        jest.resetModules();
        if (originalXMLHttpRequest === undefined) {
            delete global.XMLHttpRequest;
        } else {
            global.XMLHttpRequest = originalXMLHttpRequest;
        }
    });

    test('XMLHttpRequestFactory uses the browser implementation when available', () => {
        class MockXMLHttpRequest {}
        global.XMLHttpRequest = MockXMLHttpRequest;

        const { XMLHttpRequestFactory } = require('../../../js/CypherNG/network/XMLHttpRequestFactory.js');
        const xhr = XMLHttpRequestFactory();

        expect(xhr).toBeInstanceOf(MockXMLHttpRequest);
    });

    test('XMLHttpRequestFactory provides a working Node fallback implementation', () => {
        delete global.XMLHttpRequest;
        jest.resetModules();

        jest.doMock('url', () => ({ URL: URL }));
        jest.doMock('http', () => ({
            request: (options, onResponse) => {
                expect(options).toMatchObject({ hostname: 'example.test', path: '/path?q=1', method: 'POST' });
                return {
                    on: jest.fn(),
                    write: jest.fn((payload) => expect(payload).toBe('body')),
                    end: jest.fn(() => {
                        const handlers = {};
                        const response = { statusCode: 201, on: (event, handler) => { handlers[event] = handler; } };
                        onResponse(response);
                        handlers.data('hello');
                        handlers.end();
                    })
                };
            }
        }));

        const { XMLHttpRequestFactory } = require('../../../js/CypherNG/network/XMLHttpRequestFactory.js');
        const xhr = XMLHttpRequestFactory();
        const readyStateChanges = [];
        const onLoad = jest.fn();

        xhr.onreadystatechange = () => readyStateChanges.push([xhr.readyState, xhr.status, xhr.responseText]);
        xhr.onload = onLoad;
        xhr.open('post', 'http://example.test/path?q=1', true);
        xhr.setRequestHeader('X-Test', '1');
        xhr.send('body');

        expect(xhr.method).toBe('POST');
        expect(xhr.headers['X-Test']).toBe('1');
        expect(readyStateChanges.pop()).toEqual([xhr.DONE, 200, 'hello']);
        expect(onLoad).toHaveBeenCalled();
    });

    test('HTTP.get delegates to XMLHttpRequest and resolves success callbacks', (done) => {
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
                this.status = 200;
                this.responseText = '{"ok":true}';
                this.readyState = 4;
                this.onreadystatechange();
            }
        }

        global.XMLHttpRequest = MockXMLHttpRequest;
        const { HTTP } = require('../../../js/CypherNG/network/HTTP.js');
        const http = new HTTP();

        http.get(
            'http://example.com/data',
            { Accept: 'application/json' },
            (response) => {
                expect(response).toBe('{"ok":true}');
                done();
            },
            (error) => done(error)
        );
    });

    test('HTTP.get forwards non-2xx responses to the error callback', (done) => {
        class MockXMLHttpRequest {
            open() {}
            setRequestHeader() {}
            send() {
                this.status = 503;
                this.responseText = 'unavailable';
                this.readyState = 4;
                this.onreadystatechange();
            }
        }

        global.XMLHttpRequest = MockXMLHttpRequest;
        const { HTTP } = require('../../../js/CypherNG/network/HTTP.js');

        new HTTP().get(
            'http://example.com/down',
            null,
            () => done(new Error('expected error callback')),
            (error) => {
                expect(String(error)).toContain('Request failed with status 503');
                done();
            }
        );
    });

    test('HTTP.post delegates to XMLHttpRequest and forwards payload headers', (done) => {
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
            send(body) {
                expect(this.method).toBe('POST');
                expect(this.headers['Content-Type']).toBe('application/json;charset=UTF-8');
                expect(this.headers['Content-Length']).toBe(body.length);
                this.status = 200;
                this.responseText = 'created';
                this.readyState = 4;
                this.onreadystatechange();
            }
        }

        global.XMLHttpRequest = MockXMLHttpRequest;
        const { HTTP } = require('../../../js/CypherNG/network/HTTP.js');
        const http = new HTTP();

        http.post(
            'http://example.com/data',
            { answer: 42 },
            { Accept: 'application/json' },
            (response) => {
                expect(response).toBe('created');
                done();
            },
            (error) => done(error)
        );
    });

    test('HTTP.post forwards synchronous send errors to the error callback', (done) => {
        class MockXMLHttpRequest {
            open() {}
            setRequestHeader() {}
            send() {
                throw new Error('socket closed');
            }
        }

        global.XMLHttpRequest = MockXMLHttpRequest;
        const { HTTP } = require('../../../js/CypherNG/network/HTTP.js');

        new HTTP().post(
            'http://example.com/data',
            'payload',
            null,
            () => done(new Error('expected error callback')),
            (error) => {
                expect(String(error)).toContain('socket closed');
                done();
            }
        );
    });
});