# Plan: Deno Microservice for Documentation Generation

> **Status**: Recommended approach. Uses official `@deno/doc` with full feature support.

Deploy a separate Vercel project using `vercel-deno` runtime that exposes a docs generation API.

## Architecture

```
npmx.dev (Nuxt/Node.js)          docs-api.npmx.dev (Deno)
┌─────────────────────┐          ┌─────────────────────┐
│ /api/registry/docs  │  HTTP    │ /api/generate       │
│         │           │ ──────>  │         │           │
│         ▼           │          │         ▼           │
│ generateDocsWithDeno│          │ @deno/doc           │
└─────────────────────┘          └─────────────────────┘
```

## Implementation

### Part 1: Deno Microservice

#### Project Structure

```
docs-api/
├── api/
│   └── generate.ts
├── vercel.json
└── README.md
```

#### `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "api/**/*.[jt]s": {
      "runtime": "vercel-deno@3.1.0"
    }
  }
}
```

#### `api/generate.ts`

```typescript
#!/usr/bin/env deno run --allow-net --allow-env

import { doc } from 'jsr:@deno/doc'

interface GenerateRequest {
  package: string
  version: string
}

function validateAuth(req: Request): boolean {
  const authHeader = req.headers.get('Authorization')
  const expectedToken = Deno.env.get('API_SECRET')
  if (!expectedToken) return true
  return authHeader === `Bearer ${expectedToken}`
}

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    'Access-Control-Allow-Origin': 'https://npmx.dev',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers })
  }

  if (!validateAuth(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers })
  }

  try {
    const body: GenerateRequest = await req.json()

    if (!body.package || !body.version) {
      return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers })
    }

    const specifier = `https://esm.sh/${body.package}@${body.version}?target=deno`
    const nodes = await doc(specifier)

    return new Response(JSON.stringify({ nodes }), { status: 200, headers })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('Could not find')) {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers })
    }

    return new Response(JSON.stringify({ error: 'generation_failed', message }), {
      status: 500,
      headers,
    })
  }
}
```

### Part 2: Update Main App

#### Environment Variables

```bash
DOCS_API_URL=https://docs-api.npmx.dev/api/generate
DOCS_API_SECRET=your-secret-token
```

#### Update `server/utils/docs.ts`

```typescript
const DOCS_API_URL = process.env.DOCS_API_URL || 'https://docs-api.npmx.dev/api/generate'
const DOCS_API_SECRET = process.env.DOCS_API_SECRET

async function runDenoDoc(packageName: string, version: string): Promise<DenoDocResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (DOCS_API_SECRET) {
    headers['Authorization'] = `Bearer ${DOCS_API_SECRET}`
  }

  const response = await fetch(DOCS_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ package: packageName, version }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }))
    if (response.status === 404) {
      return { nodes: [] }
    }
    throw new Error(`Docs API error: ${error.message}`)
  }

  return (await response.json()) as DenoDocResult
}

export async function generateDocsWithDeno(
  packageName: string,
  version: string,
): Promise<DocsGenerationResult | null> {
  const result = await runDenoDoc(packageName, version)

  if (!result.nodes || result.nodes.length === 0) {
    return null
  }

  // Rest remains the same
  const flattenedNodes = flattenNamespaces(result.nodes)
  const mergedSymbols = mergeOverloads(flattenedNodes)
  const symbolLookup = buildSymbolLookup(flattenedNodes)

  const html = await renderDocNodes(mergedSymbols, symbolLookup)
  const toc = renderToc(mergedSymbols)

  return { html, toc, nodes: flattenedNodes }
}
```

#### Remove Unused Code

Delete from `server/utils/docs.ts`:

- `execFileAsync` import
- `DENO_DOC_TIMEOUT_MS`, `DENO_DOC_MAX_BUFFER` constants
- `denoCheckPromise`, `isDenoInstalled()`, `verifyDenoInstalled()`
- `buildEsmShUrl()` (moved to microservice)
- Old `runDenoDoc()` implementation

### Local Development

Keep subprocess as fallback for local dev:

```typescript
async function runDenoDoc(packageName: string, version: string): Promise<DenoDocResult> {
  if (process.dev && (await isDenoInstalled())) {
    return runLocalDenoDoc(packageName, version)
  }
  return runRemoteDenoDoc(packageName, version)
}
```

## Pros/Cons

**Pros**: Uses official `@deno/doc`, exact parity with `deno doc` CLI, actively maintained, clean separation

**Cons**: Two deployments, +100-200ms latency, CORS/auth setup, more complex local dev
