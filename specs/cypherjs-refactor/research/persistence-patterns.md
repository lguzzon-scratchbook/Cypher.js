# Persistence Layer Patterns Research

## Overview

This document research patterns for implementing a flexible persistence layer that supports multiple storage backends (localStorage, IndexedDB, Node.js fs) with clean abstraction for future extensibility.

## Current Requirements

- **Goal**: Prepare architecture for future persistence integration
- **Storage backends**: localStorage (browser), IndexedDB (browser), Node.js fs
- **Data types**: Flexible for any data (queries, results, config)
- **Approach**: Keep architecture general and open-ended

## Pattern Options

### 1. Adapter Pattern

Converts a standard interface to different storage implementations.

```javascript
// Storage Adapter Interface
class StorageAdapter {
    async get(key) { throw new Error('Not implemented'); }
    async set(key, value) { throw new Error('Not implemented'); }
    async delete(key) { throw new Error('Not implemented'); }
    async clear() { throw new Error('Not implemented'); }
    async keys() { throw new Error('Not implemented'); }
}

// LocalStorage Adapter
class LocalStorageAdapter extends StorageAdapter {
    get(key) { return Promise.resolve(localStorage.getItem(key)); }
    set(key, value) { return Promise.resolve(localStorage.setItem(key, value)); }
    delete(key) { return Promise.resolve(localStorage.removeItem(key)); }
    clear() { return Promise.resolve(localStorage.clear()); }
    keys() { return Promise.resolve(Object.keys(localStorage)); }
}

// Node.js FS Adapter
class FileSystemAdapter extends StorageAdapter {
    constructor(basePath = './data') {
        super();
        this.basePath = basePath;
    }

    async get(key) {
        const fs = await import('fs/promises');
        const data = await fs.readFile(`${this.basePath}/${key}.json`, 'utf8');
        return data;
    }

    async set(key, value) {
        const fs = await import('fs/promises');
        await fs.mkdir(this.basePath, { recursive: true });
        await fs.writeFile(`${this.basePath}/${key}.json`, JSON.stringify(value));
    }
    // ... etc
}
```

**Pros**: Clean separation, easy to add new backends
**Cons**: Interface may need adaptation per backend

### 2. Strategy Pattern

Select different storage strategies at runtime.

```javascript
class StorageStrategy {
    async save(key, data) { }
    async load(key) { }
    async remove(key) { }
}

class InMemoryStrategy extends StorageStrategy {
    constructor() { this.store = new Map(); }
    async save(key, data) { this.store.set(key, data); }
    async load(key) { return this.store.get(key); }
    async remove(key) { this.store.delete(key); }
}

class CypherNG {
    constructor(options = {}) {
        this.storageStrategy = options.storageStrategy || new InMemoryStrategy();
    }
}
```

**Pros**: Runtime flexibility, easy to swap strategies
**Cons**: May lead to many small strategy classes

### 3. Repository Pattern

Abstracts data access, providing a clean API for the domain layer.

```javascript
class QueryRepository {
    constructor(storageAdapter) {
        this.storage = storageAdapter;
    }

    async saveQuery(id, query) {
        return this.storage.set(`query:${id}`, query);
    }

    async getQuery(id) {
        return this.storage.get(`query:${id}`);
    }

    async listQueries() {
        const allKeys = await this.storage.keys();
        return Promise.all(
            allKeys.filter(k => k.startsWith('query:'))
                   .map(k => this.storage.get(k))
        );
    }
}

class CypherNG {
    constructor(options = {}) {
        this.queries = new QueryRepository(options.storage || new InMemoryStrategy());
    }
}
```

**Pros**: Domain-focused API, clean abstraction
**Cons**: May be overkill for simple use cases

### 4. Plugin/Provider Pattern

Allows registering storage providers dynamically.

```javascript
class StorageProviderRegistry {
    #providers = new Map();

    register(name, provider) {
        this.#providers.set(name, provider);
    }

    get(name) {
        const provider = this.#providers.get(name);
        if (!provider) throw new Error(`Storage provider "${name}" not registered`);
        return provider;
    }

    getDefault() {
        // Auto-detect based on environment
        if (typeof window !== 'undefined') {
            if (typeof indexedDB !== 'undefined') return this.get('indexeddb');
            return this.get('localstorage');
        }
        return this.get('filesystem');
    }
}

// Usage
const registry = new StorageProviderRegistry();
registry.register('localstorage', new LocalStorageAdapter());
registry.register('indexeddb', new IndexedDBAdapter());
registry.register('filesystem', new FileSystemAdapter());

const cypher = new CypherNG({
    storage: registry.getDefault()
});
```

**Pros**: Most flexible, auto-detection, extensible
**Cons**: More complex initial setup

## Recommendation

### Use Plugin/Provider Pattern with Adapter Foundation

For CypherNG, recommend combining approaches:

1. **Base StorageAdapter interface** — defines contract
2. **Concrete adapters** — LocalStorageAdapter, IndexedDBAdapter, FileSystemAdapter
3. **Storage registry** — for registration and auto-detection
4. **Repository classes** (optional) — for domain-specific data access

## Architecture Sketch

```javascript
// src/storage/
//   ├── index.js          # Main exports
//   ├── adapter.js        # Base adapter interface
//   ├── adapters/
//   │   ├── localstorage.js
//   │   ├── indexeddb.js
//   │   └── filesystem.js
//   └── registry.js       # Provider registration

// Usage
import { StorageRegistry, LocalStorageAdapter } from './storage';

const registry = new StorageRegistry();
registry.register('local', new LocalStorageAdapter());

const cypher = new CypherNG({
    storage: registry.get('local')
});
```

## IndexedDB Notes

IndexedDB is async, uses events/promises. Consider using a wrapper:

```javascript
class IndexedDBAdapter {
    constructor(dbName = 'cypherng', storeName = 'default') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    async #getDB() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(this.storeName);
            };
        });
    }

    async get(key) {
        const db = await this.#getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ... set, delete, clear, keys
}
```

## References

- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Node.js fs/promises](https://nodejs.org/api/fs.html#fspromises)
- [LocalStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Repository Pattern](https://docs.microsoft.com/en-us/aspnet/mvc/overview/older-versions/getting-started-with-ef-5-using-mvc-4/implementing-the-repository-and-unit-of-work-patterns-in-an-asp-net-mvc-application)