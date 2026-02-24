# Cross-Platform JavaScript Module Patterns Research

## Overview

This document research module patterns for writing JavaScript that runs in both browser and Node.js environments.

## Current Codebase Analysis

The existing `js/Cypher.js` uses:
- **Browser version**: IIFE-style global namespace pattern (`function CypherJS() { ... }`)
- **Node.js version**: CommonJS via `require()` in `node/index.js`

## Module Pattern Options

### 1. ES Modules (ESM)
Modern standard, supported in:
- Node.js 12+ (experimental), 14+ (stable), 18+ (full support)
- All modern browsers

```javascript
// Named exports
export class CypherNG { }

// Default export
export default CypherNG;
```

**Pros**: Native browser support, tree-shaking, static analysis
**Cons**: Requires build step for older browsers, Node.js needs `.mjs` or `"type": "module"`

### 2. CommonJS
Node.js default, works in browsers with bundlers.

```javascript
module.exports = CypherNG;
```

**Pros**: Node.js native, familiar syntax
**Cons**: Not native in browsers (needs bundler), no tree-shaking

### 3. UMD (Universal Module Definition)
Combines CommonJS, AMD, and global exports.

```javascript
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CypherNG = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    return CypherNG;
}));
```

**Pros**: Works everywhere
**Cons**: Legacy pattern, verbose, harder to maintain

### 4. Hybrid Approach (Recommended)
Using ES modules with conditional CommonJS export for Node.js compatibility.

```javascript
// src/CypherNG.js
class CypherNG { }

// ESM export
export { CypherNG, default as CypherNG };

// CommonJS fallback (for Node.js without ESM)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CypherNG;
}
```

Or using package.json exports field:

```json
{
  "name": "cypherng",
  "type": "module",
  "exports": {
    "import": "./dist/esm/index.js",
    "require": "./dist/cjs/index.js"
  }
}
```

## Recommendations

### Approach: ES Modules with Build Output

For CypherNG, recommend:
1. **Use ES modules as source** — modern, clean, tree-shakeable
2. **Build to both ESM and CommonJS** — via Bun or esbuild
3. **Use package.json exports field** — for proper dual package support

```javascript
// In src/index.js
export class CypherNG {
    // Implementation
}

export default CypherNG;
```

### Implementation with Bun

Bun supports ESM natively. Build configuration:

```javascript
// build.mjs
import { build } from 'bun';

await build({
    entries: ['src/index.js'],
    outdir: 'dist',
    format: ['esm', 'cjs'],
    target: ['node', 'browser'],
});
```

### For Browser + Node.js Without Build

If avoiding build step entirely:

```javascript
// CypherNG.js
class CypherNG { }

// Detect environment
if (typeof module !== 'undefined' && module.exports) {
    // Node.js / CommonJS
    module.exports = CypherNG;
} else if (typeof define === 'function' && define.amd) {
    // AMD
    define([], function() { return CypherNG; });
} else {
    // Browser global
    window.CypherNG = CypherNG;
}
```

## ES2020+ Features

ES2020+ features to leverage:
- **Optional chaining** (`?.`): `obj?.prop?.nested`
- **Nullish coalescing** (`??`): `value ?? default`
- **Dynamic imports**: `await import('./module')`
- **BigInt**: For large数值
- **Promise.allSettled**: For error handling

Note: ES2020 features have good support in modern browsers and Node.js 14+.

## References

- [Node.js ESM Documentation](https://nodejs.org/api/esm.html)
- [MDN ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [ Bun Module Documentation](https://bun.sh/docs/runtime/modules)
- [Dual Package Hazards](https://nodejs.org/api/packages.html#dual-package-hazard)