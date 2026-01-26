# Plan: WASM-based Documentation Generation

> **Status**: ✅ Working! Uses official `@deno/doc` v0.189.1 with patches for Node.js compatibility.

## Summary

Successfully replaced the `deno doc` subprocess with WASM-based documentation generation that runs directly in Node.js/Vercel serverless, using the official `@deno/doc` package from JSR.

## Package Used

- **Package**: `@deno/doc` (JSR - official Deno package)
- **Version**: 0.189.1 (latest, Jan 2026)
- **WASM size**: 4.7MB
- **Install**: `pnpm install jsr:@deno/doc`

## Compatibility Issues & Fixes

We encountered three issues when running `@deno/doc` in Node.js. All were resolved with a single patch file.

### Issue 1: Invalid JavaScript exports ✅ Fixed

```js
// In mod.js - this is invalid JS, only works in Deno
export * from './types.d.ts'
export * from './html_types.d.ts'
```

**Fix**: Patch removes these lines.

### Issue 2: WASM loader doesn't support Node.js ✅ Fixed

```js
// Original code throws error for Node.js + file:// URLs
if (isFile && typeof Deno !== 'object') {
  throw new Error('Loading local files are not supported in this environment')
}
```

**Fix**: Patch adds Node.js fs support:

```js
if (isNode && isFile) {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const wasmCode = readFileSync(fileURLToPath(url))
  return WebAssembly.instantiate(decompress ? decompress(wasmCode) : wasmCode, imports)
}
```

### Issue 3: Bundler rewrites WASM paths ✅ Fixed

When Nitro inlines the package, `import.meta.url` gets rewritten and WASM path becomes invalid.

**Fix**: Don't inline `@deno/doc` in Nitro config - let it load from `node_modules/`:

```ts
// nuxt.config.ts - do NOT add @deno/doc to nitro.externals.inline
```

## Patch File

All fixes are in `patches/@jsr__deno__doc@0.189.1.patch` (managed by pnpm).

## Key Finding

esm.sh serves types URL in the `x-typescript-types` header:

```bash
$ curl -sI 'https://esm.sh/ufo@1.5.0' | grep x-typescript-types
x-typescript-types: https://esm.sh/ufo@1.5.0/dist/index.d.ts
```

## Architecture

```
[Request] -> [fetch x-typescript-types header] -> [@deno/doc WASM] -> [HTML]
```

## Files Changed

- `server/utils/docs.ts` - Uses `@deno/doc` with custom loader/resolver
- `server/utils/docs-text.ts` - Extracted text utilities
- `patches/@jsr__deno__doc@0.189.1.patch` - Node.js compatibility patch

## Verified Working

- ✅ `ufo@1.5.0` - Generates full docs
- ✅ `react@19.0.0` - Large package, generates full docs
- ✅ All 361 tests pass
- ✅ Dev server runs without errors

## Pros/Cons

**Pros**:

- Single deployment (no microservice)
- Uses official, maintained `@deno/doc` (latest version)
- In-process, no network latency
- 4.7MB WASM loaded once, cached

**Cons**:

- Requires patch for Node.js compatibility (may need updates per version)
- 4.7MB added to server bundle
- Patch maintenance burden

## Alternative: Microservice Approach

See `PLAN_MICRO.md` for the microservice approach that runs actual Deno in a separate Vercel project. That approach:

- Requires no patches
- Has network latency
- Requires managing two deployments
