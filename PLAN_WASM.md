# Plan: WASM-based Documentation Generation

> **Status**: Alternative approach. See PLAN_MICRO.md for recommended approach.

Replace the `deno doc` subprocess with `tsdoc-extractor`, a WASM build of `deno_doc` for Node.js.

## Package

- **npm**: `tsdoc-extractor`
- **Size**: 2.8MB WASM + ~25KB JS
- **Last updated**: July 2023
- **Output**: Same JSON format as `deno doc --json`

## Test Results

```
ufo@1.5.0:  58 nodes (works)
vue@3.5.0:   4 nodes (re-exports not followed - WASM limitation)
```

## Key Finding

esm.sh serves types URL in the `x-typescript-types` header, not at the main URL:

```bash
$ curl -sI 'https://esm.sh/ufo@1.5.0' | grep x-typescript-types
x-typescript-types: https://esm.sh/ufo@1.5.0/dist/index.d.ts
```

## Architecture

```
Current:  [Request] -> [subprocess: deno doc --json] -> [parse JSON]
New:      [Request] -> [fetch types] -> [tsdoc-extractor WASM] -> [parse JSON]
```

## Implementation

### 1. Install

```bash
pnpm add tsdoc-extractor
```

### 2. Create `server/utils/docs-wasm.ts`

```typescript
import { doc, defaultResolver } from 'tsdoc-extractor'
import type { DenoDocNode, DocsGenerationResult } from '#shared/types/deno-doc'

async function getTypesUrl(packageName: string, version: string): Promise<string | null> {
  const url = `https://esm.sh/${packageName}@${version}`
  const response = await fetch(url, { method: 'HEAD' })
  return response.headers.get('x-typescript-types')
}

function createResolver() {
  return (specifier: string, referrer: string): string => {
    if (specifier.startsWith('.')) {
      return new URL(specifier, referrer).toString()
    }
    if (specifier.startsWith('https://esm.sh/')) {
      return specifier
    }
    if (!specifier.startsWith('http')) {
      return `https://esm.sh/${specifier}`
    }
    return defaultResolver(specifier, referrer)
  }
}

export async function generateDocsWithWasm(
  packageName: string,
  version: string,
): Promise<DocsGenerationResult | null> {
  const typesUrl = await getTypesUrl(packageName, version)

  if (!typesUrl) {
    return null
  }

  const nodes = (await doc(typesUrl, {
    resolve: createResolver(),
  })) as DenoDocNode[]

  if (!nodes || nodes.length === 0) {
    return null
  }

  const flattenedNodes = flattenNamespaces(nodes)
  const mergedSymbols = mergeOverloads(flattenedNodes)
  const symbolLookup = buildSymbolLookup(flattenedNodes)

  const html = await renderDocNodes(mergedSymbols, symbolLookup)
  const toc = renderToc(mergedSymbols)

  return { html, toc, nodes: flattenedNodes }
}
```

## Limitations

- **WASM from 2023**: Known issues with `export *` re-exports
- **Rebuild requires Rust**: Need wasm-pack and deno_doc source to update

## Pros/Cons

**Pros**: No external dependency, single deployment, faster cold starts

**Cons**: Old WASM with known issues, complex packages may fail, 2.8MB bundle increase
