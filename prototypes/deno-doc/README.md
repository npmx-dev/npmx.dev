# @deno/doc Prototype Findings

## Summary

This prototype explored using `@deno/doc` to generate TypeScript documentation for npm packages.

## Key Discovery: Use esm.sh Instead of jsDelivr!

**esm.sh properly resolves module imports**, while jsDelivr serves files as-is without resolution.

```javascript
// WORKS - esm.sh resolves imports
deno doc --json "https://esm.sh/zod@4?target=deno"  // 380 nodes!

// FAILS - jsDelivr doesn't resolve relative imports
deno doc --json "https://cdn.jsdelivr.net/npm/zod@4/index.d.ts"  // Error
```

## Approaches Tested

### 1. Direct `@deno/doc` JSR Package in Node.js/Bun

**Result: Does not work**

- The JSR package (`@deno/doc`) can be installed via `npx jsr add @deno/doc`
- However, the WASM loading mechanism requires `file://` URLs which are blocked outside Deno
- The package throws: `"Loading local files are not supported in this environment"`

### 2. `deno doc --json` CLI with esm.sh

**Result: Works excellently!**

```javascript
import { spawn } from "node:child_process";

async function denoDoc(packageName, version) {
  const url = `https://esm.sh/${packageName}@${version}?target=deno`;
  return new Promise((resolve, reject) => {
    const proc = spawn("deno", ["doc", "--json", url]);
    // ... collect stdout, parse JSON
  });
}

const result = await denoDoc("zod", "4.3.6");
// Returns: { version: 1, nodes: [...] } with 380 nodes!
```

## Test Results with esm.sh

| Package | Nodes | Breakdown |
|---------|-------|-----------|
| **zod@4** | 380 | 112 functions, 82 interfaces, 87 variables, 11 type aliases |
| **vue@3** | 408 | Full Vue API documented |
| **date-fns@3** | 364 | All date functions |
| **axios@1** | 80 | 4 classes, 36 interfaces, 8 functions |
| **react@18** | 30 | 7 interfaces, 19 type aliases |
| **ufo** | 63 | 52 functions, 5 interfaces |

### Packages Using @types/* (DefinitelyTyped)

| Package | Direct | @types/* | Notes |
|---------|--------|----------|-------|
| express | 4 nodes | 4 nodes + 30 in namespace | Uses `export default namespace` pattern |
| lodash-es | 0 nodes | N/A | No bundled types |

For packages like express that use namespace patterns, the documentation IS available - it's just nested inside the namespace node.

## Limitations

### 1. Packages Without Bundled Types
- Packages relying solely on `@types/*` may have limited results
- Can fall back to documenting the `@types/*` package directly
- Namespace patterns need flattening in the UI

### 2. Server Requirements
- Requires Deno installed on the server
- Subprocess spawning has overhead (~200-500ms per call)
- Would need caching strategy (by package@version)

### 3. esm.sh Dependency
- Relies on esm.sh for module resolution
- esm.sh is reliable but is a third-party service
- Could self-host esm.sh if needed

## Recommended Architecture

```
                     ┌─────────────────────────┐
                     │    npmx.dev Server      │
                     │       (Nitro)           │
                     └───────────┬─────────────┘
                                 │
                     ┌───────────▼─────────────┐
                     │   Doc Generation API    │
                     │  GET /api/docs/[pkg]    │
                     └───────────┬─────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │                     │                     │
  ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
  │ Check Cache     │  │ Build esm.sh    │  │ Subprocess      │
  │ (KV/Redis)      │  │ URL             │  │ deno doc --json │
  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### URL Strategy

```javascript
function getDocUrl(packageName, version) {
  // esm.sh handles module resolution
  return `https://esm.sh/${packageName}@${version}?target=deno`;
}

// For @types/* fallback
function getTypesUrl(packageName, version) {
  const typesName = packageName.startsWith("@") 
    ? `@types/${packageName.slice(1).replace("/", "__")}`
    : `@types/${packageName}`;
  return `https://esm.sh/${typesName}@${version}?target=deno`;
}
```

### Caching Strategy

1. Cache by `{package}@{version}` (immutable - versions don't change)
2. Store in KV/Redis with 30-day TTL
3. Generate on first request, return cached thereafter
4. Pre-warm cache for popular packages

### Handling Namespace Patterns

For packages like express that use `export default namespace`:

```javascript
function flattenNamespaces(nodes) {
  return nodes.flatMap(node => {
    if (node.kind === "namespace" && node.namespaceDef?.elements) {
      // Include both the namespace and its flattened elements
      return [node, ...node.namespaceDef.elements.map(el => ({
        ...el,
        namespacePath: node.name
      }))];
    }
    return [node];
  });
}
```

## Alternative: TypeDoc

If the Deno dependency is undesirable, TypeDoc is the main alternative:

```javascript
import { Application } from "typedoc";

const app = await Application.bootstrap({
  entryPoints: ["./index.d.ts"],
  skipErrorChecking: true,
});

const project = await app.convert();
const json = app.serializer.projectToObject(project, cwd);
```

**Pros**: Native npm package, no Deno dependency
**Cons**: Heavier, requires TypeScript compiler, slower

## Files

- `src/test-deno-cli.js` - Working Deno CLI integration test
- `src/test.js` - Failed direct @deno/doc import test  
- `src/test-direct-wasm.js` - Failed direct WASM loading test

## Conclusion

**Recommendation**: Use `deno doc --json` CLI with esm.sh URLs

- **Works reliably** - esm.sh resolves module imports correctly
- **High quality output** - Same format as JSR documentation
- **Good coverage** - Works for most packages with bundled types
- **Fallback available** - Can use @types/* for packages without bundled types
- **Server requirement** - Needs Deno installed (acceptable for Vercel)
- **Caching essential** - Doc generation takes ~1-3 seconds, cache by version
