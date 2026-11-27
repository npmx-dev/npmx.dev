import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createLoader, createResolver, getDocNodes, getModules } from '#server/utils/docs/client'

describe('createResolver', () => {
  const resolve = createResolver()
  const referrer = 'https://esm.sh/effect-web-midi@0.2.1/dist-types/index.d.ts'

  it('resolves relative imports', () => {
    expect(resolve('./src/index.d.ts', referrer)).toBe(
      'https://esm.sh/effect-web-midi@0.2.1/dist-types/src/index.d.ts',
    )
  })

  it('resolves absolute paths', () => {
    expect(resolve('/foo.d.ts', referrer)).toBe('https://esm.sh/foo.d.ts')
  })

  it('resolves bare specifiers', () => {
    expect(resolve('effect', referrer)).toBe('https://esm.sh/effect')
  })

  it('leaves absolute URLs unchanged', () => {
    expect(resolve('https://esm.sh/effect', referrer)).toBe('https://esm.sh/effect')
  })

  it('leaves node builtins unchanged and normalizes bare builtins to node:', () => {
    expect(resolve('node:fs', referrer)).toBe('node:fs')
    expect(resolve('node:future-builtin', referrer)).toBe('node:future-builtin')
    expect(resolve('fs', referrer)).toBe('node:fs')
    expect(resolve('fs/promises', referrer)).toBe('node:fs/promises')
    expect(resolve('stream/web', referrer)).toBe('node:stream/web')
  })

  it('leaves non-http runtime and virtual schemes unchanged', () => {
    expect(resolve('bun:sqlite', referrer)).toBe('bun:sqlite')
    expect(resolve('bun:ffi', referrer)).toBe('bun:ffi')
    expect(resolve('cloudflare:workers', referrer)).toBe('cloudflare:workers')
    expect(resolve('deno:std', referrer)).toBe('deno:std')
    expect(resolve('virtual:my-module', referrer)).toBe('virtual:my-module')
    expect(resolve('jsr:@std/path', referrer)).toBe('jsr:@std/path')
    expect(resolve('npm:lodash', referrer)).toBe('npm:lodash')
  })

  it('marks unresolvable bare specifiers and subpath aliases as external', () => {
    expect(resolve('bun', referrer)).toBe('external:bun')
    expect(resolve('node', referrer)).toBe('external:node')
    expect(resolve('#internal/foo', referrer)).toBe('external:#internal/foo')
    expect(resolve('~/utils', referrer)).toBe('external:~/utils')
    expect(resolve('@/lib', referrer)).toBe('external:@/lib')
  })

  it('does not resolve source map references', () => {
    expect(resolve('index.d.ts.map', referrer)).toBe('index.d.ts.map')
    expect(resolve('./index.d.ts.map', referrer)).toBe('./index.d.ts.map')
  })

  it('does not falsely flag packages containing the word map', () => {
    expect(resolve('source-map', referrer)).toBe('https://esm.sh/source-map')
    expect(resolve('my.package.map', referrer)).toBe('https://esm.sh/my.package.map')
  })
})

describe('createLoader', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns undefined for source map files', async () => {
    const load = createLoader()
    expect(await load('index.d.ts.map')).toBeUndefined()
    expect(await load('https://esm.sh/foo.js.map')).toBeUndefined()
    expect(await load('index.d.ts.map?v=123')).toBeUndefined()
    expect(await load('https://esm.sh/foo.js.map#hash')).toBeUndefined()
  })

  it('returns undefined for invalid or non-HTTP URLs', async () => {
    const load = createLoader()
    expect(await load('not-a-valid-url')).toBeUndefined()
    expect(await load('node:fs')).toBeUndefined()
    expect(await load('file:///etc/passwd')).toBeUndefined()
  })

  it('returns external without fetching for runtime and virtual schemes', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('$fetch', { raw: mockFetch })
    const load = createLoader()

    expect(await load('bun:sqlite')).toEqual({ kind: 'external', specifier: 'bun:sqlite' })
    expect(await load('cloudflare:workers')).toEqual({
      kind: 'external',
      specifier: 'cloudflare:workers',
    })
    expect(await load('virtual:my-module')).toEqual({
      kind: 'external',
      specifier: 'virtual:my-module',
    })
    expect(await load('external:bun')).toEqual({ kind: 'external', specifier: 'external:bun' })
    expect(await load('external:#internal')).toEqual({
      kind: 'external',
      specifier: 'external:#internal',
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches and returns module content for valid URLs', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      url: 'https://esm.sh/foo@1.0.0/index.d.ts',
      headers: new Headers({ 'content-type': 'application/typescript' }),
      _data: { text: async () => 'export const foo = 1;' },
    })
    vi.stubGlobal('$fetch', { raw: mockFetch })
    const load = createLoader()

    const result = await load('https://esm.sh/foo@1.0.0/index.d.ts')

    expect(result).toEqual({
      kind: 'module',
      specifier: 'https://esm.sh/foo@1.0.0/index.d.ts',
      headers: { 'content-type': 'application/typescript' },
      content: 'export const foo = 1;',
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('memoizes fetched modules and coalesces concurrent requests', async () => {
    let resolveFetch!: (value: unknown) => void
    const mockFetch = vi.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('$fetch', { raw: mockFetch })
    const load = createLoader()

    const p1 = load('https://esm.sh/foo@1.0.0/shared.d.ts')
    const p2 = load('https://esm.sh/foo@1.0.0/shared.d.ts')

    resolveFetch({
      status: 200,
      url: 'https://esm.sh/foo@1.0.0/shared.d.ts',
      headers: new Headers({ 'content-type': 'application/typescript' }),
      _data: { text: async () => 'export type Shared = string;' },
    })

    const [r1, r2] = await Promise.all([p1, p2])
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(r1).toEqual(r2)

    if (r1?.kind === 'module') {
      ;(r1 as { content: unknown }).content = [1, 2, 3]
    }
    const r3 = await load('https://esm.sh/foo@1.0.0/shared.d.ts')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(r3).toEqual({
      kind: 'module',
      specifier: 'https://esm.sh/foo@1.0.0/shared.d.ts',
      headers: { 'content-type': 'application/typescript' },
      content: 'export type Shared = string;',
    })
  })

  it('returns undefined and memoizes failures without logging per fetch', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockFetch = vi.fn().mockResolvedValue({ status: 404 })
    vi.stubGlobal('$fetch', { raw: mockFetch })
    const load = createLoader()

    expect(await load('https://esm.sh/foo@1.0.0/missing.d.ts')).toBeUndefined()
    expect(await load('https://esm.sh/foo@1.0.0/missing.d.ts')).toBeUndefined()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('enforces maxFetches while still serving cached URLs', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => ({
      status: 200,
      url,
      headers: new Headers({ 'content-type': 'application/typescript' }),
      _data: { text: async () => 'export const x = 1;' },
    }))
    vi.stubGlobal('$fetch', { raw: mockFetch })

    const onTruncate = vi.fn()
    const load = createLoader({ maxFetches: 1, onTruncate })

    const first = await load('https://esm.sh/foo@1.0.0/a.d.ts')
    expect(first?.kind).toBe('module')

    const cached = await load('https://esm.sh/foo@1.0.0/a.d.ts')
    expect(cached?.kind).toBe('module')

    const capped = await load('https://esm.sh/foo@1.0.0/b.d.ts')
    expect(capped).toEqual({ kind: 'external', specifier: 'https://esm.sh/foo@1.0.0/b.d.ts' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(onTruncate).toHaveBeenCalledWith('fetch-limit')
  })

  it('stops fetching once the deadline has passed', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('$fetch', { raw: mockFetch })

    const onTruncate = vi.fn()
    const load = createLoader({ deadline: Date.now() - 1, onTruncate })

    const result = await load('https://esm.sh/foo@1.0.0/a.d.ts')
    expect(result).toEqual({ kind: 'external', specifier: 'https://esm.sh/foo@1.0.0/a.d.ts' })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(onTruncate).toHaveBeenCalledWith('timeout')
  })
})

describe('getModules', () => {
  const $fetchMock = vi.fn()

  beforeEach(() => {
    $fetchMock.mockReset()
    vi.stubGlobal('$fetch', $fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to root when esm.sh resolves an empty body', async () => {
    $fetchMock.mockResolvedValue(undefined)

    await expect(getModules('ufo', '1.6.3')).resolves.toEqual(['.'])
  })

  it('falls back to root when the manifest fetch throws', async () => {
    $fetchMock.mockRejectedValue(new Error('network'))

    await expect(getModules('ufo', '1.6.3')).resolves.toEqual(['.'])
  })

  it('falls back to root when there is no exports field', async () => {
    $fetchMock.mockResolvedValue({ name: 'is-odd' })

    await expect(getModules('is-odd', '3.0.1')).resolves.toEqual(['.'])
  })

  it('treats a bare conditions map (no submodules) as root-only', async () => {
    $fetchMock.mockResolvedValue({
      name: 'ufo',
      exports: { import: './dist/index.mjs', require: './dist/index.cjs' },
    })

    await expect(getModules('ufo', '1.6.3')).resolves.toEqual(['.'])
  })

  it('resolves a root entry alongside submodules, root first', async () => {
    $fetchMock.mockResolvedValue({
      name: 'unstorage',
      exports: {
        '.': './dist/index.mjs',
        './server': './dist/server.mjs',
        './drivers/fs': './dist/drivers/fs.mjs',
      },
    })

    await expect(getModules('unstorage', '1.10.2')).resolves.toEqual([
      '.',
      './drivers/fs',
      './server',
    ])
  })

  it('resolves submodule-only packages without a root entry', async () => {
    $fetchMock.mockResolvedValue({
      name: 'tctx',
      exports: {
        './traceparent': { types: './traceparent.d.mts', default: './traceparent.mjs' },
        './tracestate': { types: './tracestate.d.mts', default: './tracestate.mjs' },
        './package.json': './package.json',
      },
    })

    await expect(getModules('tctx', '0.2.5')).resolves.toEqual(['./traceparent', './tracestate'])
  })

  it('ignores ./package.json, asset exports, and wildcard submodules', async () => {
    $fetchMock.mockResolvedValue({
      name: 'pkg',
      exports: {
        '.': './index.mjs',
        './package.json': './package.json',
        './styles.css': './styles.css',
        './features/*': './features/*.mjs',
      },
    })

    await expect(getModules('pkg', '1.0.0')).resolves.toEqual(['.'])
  })

  it('url-encodes scoped package names when fetching the manifest', async () => {
    $fetchMock.mockResolvedValue({ name: '@scope/pkg' })

    await getModules('@scope/pkg', '1.0.0')

    expect($fetchMock).toHaveBeenCalledWith(
      'https://esm.sh/@scope%2Fpkg@1.0.0/package.json',
      expect.anything(),
    )
  })
})

function stubEsmSh(files: Record<string, string>, headTypes: Record<string, string | number>) {
  const headCalls: string[] = []
  const getCalls: string[] = []

  const fetchFn = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith('/package.json')) {
      const raw = files[url]
      if (!raw) throw new Error('404')
      return JSON.parse(raw)
    }
    throw new Error(`Unexpected $fetch: ${url}`)
  })

  const rawFn = vi.fn().mockImplementation(async (url: string, opts?: { method?: string }) => {
    if (opts?.method === 'HEAD') {
      headCalls.push(url)
      const entry = headTypes[url]
      if (typeof entry === 'number') {
        return { status: entry, headers: new Headers() }
      }
      return {
        status: 200,
        headers: new Headers(entry ? { 'x-typescript-types': entry } : {}),
      }
    }

    getCalls.push(url)
    const content = files[url]
    if (content === undefined) {
      return { status: 404, url, headers: new Headers() }
    }
    return {
      status: 200,
      url,
      headers: new Headers({ 'content-type': 'application/typescript' }),
      _data: { text: async () => content },
    }
  })

  vi.stubGlobal('$fetch', Object.assign(fetchFn, { raw: rawFn }))
  return { headCalls, getCalls }
}

describe('getDocNodes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shares one memoized loader across entry points and skips runtime builtins', async () => {
    const { getCalls } = stubEsmSh(
      {
        'https://esm.sh/multi@1.0.0/package.json': JSON.stringify({
          name: 'multi',
          exports: { '.': './index.mjs', './sub': './sub.mjs' },
        }),
        'https://esm.sh/multi@1.0.0/index.d.ts': [
          `import type { Database } from 'bun:sqlite';`,
          `import type { DurableObject } from 'cloudflare:workers';`,
          `import type { Stats } from 'fs';`,
          `import type { Shared } from './shared.d.ts';`,
          `export declare function main(s: Shared, d: Database, o: DurableObject, st: Stats): void;`,
        ].join('\n'),
        'https://esm.sh/multi@1.0.0/sub.d.ts': [
          `import type { Shared } from './shared.d.ts';`,
          `export declare function sub(s: Shared): void;`,
        ].join('\n'),
        'https://esm.sh/multi@1.0.0/shared.d.ts': `export interface Shared { id: string }`,
      },
      {
        'https://esm.sh/multi@1.0.0': 'https://esm.sh/multi@1.0.0/index.d.ts',
        'https://esm.sh/multi@1.0.0/sub': 'https://esm.sh/multi@1.0.0/sub.d.ts',
      },
    )

    const result = await getDocNodes('multi', '1.0.0')

    expect(result.truncated).toBeUndefined()
    expect(result.entries.map(e => e.entryPoint)).toEqual(['.', './sub'])
    expect(getCalls.filter(u => u === 'https://esm.sh/multi@1.0.0/shared.d.ts')).toHaveLength(1)
    expect(
      getCalls.some(u => u.includes('bun') || u.includes('cloudflare') || u.includes('fs')),
    ).toBe(false)
  })

  it('caps entry points before HEAD requests and flags truncation', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { headCalls } = stubEsmSh(
      {
        'https://esm.sh/many@1.0.0/package.json': JSON.stringify({
          name: 'many',
          exports: {
            '.': './index.mjs',
            './a': './a.mjs',
            './b': './b.mjs',
            './c': './c.mjs',
          },
        }),
        'https://esm.sh/many@1.0.0/index.d.ts': `export declare const root: number;`,
        'https://esm.sh/many@1.0.0/a.d.ts': `export declare const a: number;`,
      },
      {
        'https://esm.sh/many@1.0.0': 'https://esm.sh/many@1.0.0/index.d.ts',
        'https://esm.sh/many@1.0.0/a': 'https://esm.sh/many@1.0.0/a.d.ts',
        'https://esm.sh/many@1.0.0/b': 'https://esm.sh/many@1.0.0/b.d.ts',
        'https://esm.sh/many@1.0.0/c': 'https://esm.sh/many@1.0.0/c.d.ts',
      },
    )

    const result = await getDocNodes('many', '1.0.0', { maxEntryPoints: 2 })

    expect(headCalls).toHaveLength(2)
    expect(result.entries.map(e => e.entryPoint)).toEqual(['.', './a'])
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('entry-limit')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('logs a single summary line instead of one error per failed fetch', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubEsmSh(
      {
        'https://esm.sh/partial@1.0.0/package.json': JSON.stringify({
          name: 'partial',
          exports: { '.': './index.mjs', './broken1': './b1.mjs', './broken2': './b2.mjs' },
        }),
        'https://esm.sh/partial@1.0.0/index.d.ts': `export declare const ok: boolean;`,
      },
      {
        'https://esm.sh/partial@1.0.0': 'https://esm.sh/partial@1.0.0/index.d.ts',
        'https://esm.sh/partial@1.0.0/broken1': 404,
        'https://esm.sh/partial@1.0.0/broken2': 404,
      },
    )

    const result = await getDocNodes('partial', '1.0.0')

    expect(result.entries.map(e => e.entryPoint)).toEqual(['.'])
    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('throws on transient upstream failures instead of returning missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubEsmSh(
      {
        'https://esm.sh/down@1.0.0/package.json': JSON.stringify({ name: 'down' }),
      },
      {
        'https://esm.sh/down@1.0.0': 503,
      },
    )

    await expect(getDocNodes('down', '1.0.0')).rejects.toThrow(/Failed to resolve/)
  })

  it('caps module fetches and returns partial docs with fetch-limit truncation', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getCalls } = stubEsmSh(
      {
        'https://esm.sh/deep@1.0.0/package.json': JSON.stringify({
          name: 'deep',
          exports: { '.': './index.mjs', './a': './a.mjs', './b': './b.mjs' },
        }),
        'https://esm.sh/deep@1.0.0/index.d.ts': `export declare const root: number;`,
        'https://esm.sh/deep@1.0.0/a.d.ts': `export declare const a: number;`,
        'https://esm.sh/deep@1.0.0/b.d.ts': `export declare const b: number;`,
      },
      {
        'https://esm.sh/deep@1.0.0': 'https://esm.sh/deep@1.0.0/index.d.ts',
        'https://esm.sh/deep@1.0.0/a': 'https://esm.sh/deep@1.0.0/a.d.ts',
        'https://esm.sh/deep@1.0.0/b': 'https://esm.sh/deep@1.0.0/b.d.ts',
      },
    )

    const result = await getDocNodes('deep', '1.0.0', { maxModuleFetches: 1 })

    expect(getCalls).toHaveLength(1)
    expect(result.entries).toHaveLength(1)
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('fetch-limit')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('aborts and throws when the overall time budget expires before any entry completes', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchFn = vi.fn().mockImplementation(async () => ({ name: 'slow' }))
    const rawFn = vi.fn().mockImplementation(
      async (_url: string, opts?: { signal?: AbortSignal }) =>
        await new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            reject(opts.signal?.reason ?? new DOMException('Aborted', 'AbortError'))
          })
        }),
    )
    vi.stubGlobal('$fetch', Object.assign(fetchFn, { raw: rawFn }))

    await expect(getDocNodes('slow', '1.0.0', { timeBudgetMs: 30 })).rejects.toThrow(
      /Failed to resolve/,
    )
  })

  it.each([429, 503])(
    'throws rather than reporting missing when module GET returns %s',
    async status => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const fetchManifest = vi.fn().mockResolvedValue({ name: 'module-down' })
      const raw = vi.fn(async (url: string, opts?: { method?: string }) => {
        if (opts?.method === 'HEAD') {
          return {
            status: 200,
            headers: new Headers({
              'x-typescript-types': 'https://esm.sh/module-down@1.0.0/index.d.ts',
            }),
          }
        }
        return { status, url, headers: new Headers() }
      })
      vi.stubGlobal('$fetch', Object.assign(fetchManifest, { raw }))

      await expect(getDocNodes('module-down', '1.0.0')).rejects.toThrow(
        /Failed to generate documentation nodes/,
      )
      expect(raw).toHaveBeenCalledWith(
        'https://esm.sh/module-down@1.0.0/index.d.ts',
        expect.objectContaining({ method: 'GET' }),
      )
    },
  )

  it('marks partial results with upstream-error when some entries hit transient failures', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubEsmSh(
      {
        'https://esm.sh/flaky@1.0.0/package.json': JSON.stringify({
          name: 'flaky',
          exports: { '.': './index.mjs', './sub': './sub.mjs' },
        }),
        'https://esm.sh/flaky@1.0.0/index.d.ts': `export declare const ok: boolean;`,
      },
      {
        'https://esm.sh/flaky@1.0.0': 'https://esm.sh/flaky@1.0.0/index.d.ts',
        'https://esm.sh/flaky@1.0.0/sub': 503,
      },
    )

    const result = await getDocNodes('flaky', '1.0.0')

    expect(result.entries.map(e => e.entryPoint)).toEqual(['.'])
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('upstream-error')
  })

  it('preserves completed entries and marks a pure overall budget timeout as timeout', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const base = 'https://esm.sh/partial-timeout@1.0.0'
    const manifest = vi.fn().mockResolvedValue({
      name: 'partial-timeout',
      exports: { '.': './index.js', './slow': './slow.js' },
    })
    const raw = vi.fn(async (url: string, opts?: { method?: string; signal?: AbortSignal }) => {
      if (opts?.method === 'HEAD') {
        return {
          status: 200,
          headers: new Headers({
            'x-typescript-types': url === base ? `${base}/index.d.ts` : `${base}/slow.d.ts`,
          }),
        }
      }
      if (url === `${base}/slow.d.ts`) {
        return await new Promise<never>((_resolve, reject) => {
          const abort = () => reject(opts?.signal?.reason)
          if (opts?.signal?.aborted) abort()
          else opts?.signal?.addEventListener('abort', abort, { once: true })
        })
      }
      return {
        status: 200,
        url,
        headers: new Headers({ 'content-type': 'application/typescript' }),
        _data: { text: async () => 'export declare const completed: number;' },
      }
    })
    vi.stubGlobal('$fetch', Object.assign(manifest, { raw }))

    const result = await getDocNodes('partial-timeout', '1.0.0', {
      timeBudgetMs: 120,
      fetchTimeoutMs: 5_000,
    })

    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('timeout')
    expect(result.entries.map(e => e.entryPoint)).toEqual(['.'])
    expect(result.entries[0]!.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'completed' })]),
    )
  })

  it('marks partial results as upstream-error when a per-fetch timeout fires', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const base = 'https://esm.sh/per-fetch-timeout@1.0.0'
    const manifest = vi.fn().mockResolvedValue({
      name: 'per-fetch-timeout',
      exports: { '.': './index.js', './hung': './hung.js' },
    })
    const raw = vi.fn(async (url: string, opts?: { method?: string; signal?: AbortSignal }) => {
      if (opts?.method === 'HEAD') {
        return {
          status: 200,
          headers: new Headers({
            'x-typescript-types': url === base ? `${base}/index.d.ts` : `${base}/hung.d.ts`,
          }),
        }
      }
      if (url === `${base}/hung.d.ts`) {
        return await new Promise<never>((_resolve, reject) => {
          const abort = () => reject(opts?.signal?.reason)
          if (opts?.signal?.aborted) abort()
          else opts?.signal?.addEventListener('abort', abort, { once: true })
        })
      }
      return {
        status: 200,
        url,
        headers: new Headers({ 'content-type': 'application/typescript' }),
        _data: { text: async () => 'export declare const ok: number;' },
      }
    })
    vi.stubGlobal('$fetch', Object.assign(manifest, { raw }))

    const result = await getDocNodes('per-fetch-timeout', '1.0.0', {
      timeBudgetMs: 2_000,
      fetchTimeoutMs: 60,
    })

    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('upstream-error')
    expect(result.entries.map(e => e.entryPoint)).toEqual(['.'])
  })

  it('keeps upstream-error priority when both an upstream 503 and overall timeout occur', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const base = 'https://esm.sh/mixed-fault@1.0.0'
    const manifest = vi.fn().mockResolvedValue({
      name: 'mixed-fault',
      exports: { '.': './index.js', './bad': './bad.js', './slow': './slow.js' },
    })
    const raw = vi.fn(async (url: string, opts?: { method?: string; signal?: AbortSignal }) => {
      if (opts?.method === 'HEAD') {
        if (url === `${base}/bad`) {
          return { status: 503, headers: new Headers() }
        }
        return {
          status: 200,
          headers: new Headers({
            'x-typescript-types': url === base ? `${base}/index.d.ts` : `${base}/slow.d.ts`,
          }),
        }
      }
      if (url === `${base}/slow.d.ts`) {
        return await new Promise<never>((_resolve, reject) => {
          const abort = () => reject(opts?.signal?.reason)
          if (opts?.signal?.aborted) abort()
          else opts?.signal?.addEventListener('abort', abort, { once: true })
        })
      }
      return {
        status: 200,
        url,
        headers: new Headers({ 'content-type': 'application/typescript' }),
        _data: { text: async () => 'export declare const ok: number;' },
      }
    })
    vi.stubGlobal('$fetch', Object.assign(manifest, { raw }))

    const result = await getDocNodes('mixed-fault', '1.0.0', {
      timeBudgetMs: 120,
      fetchTimeoutMs: 5_000,
    })

    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('upstream-error')
    expect(result.entries.map(e => e.entryPoint)).toEqual(['.'])
  })

  it.each([429, 503, 'network'] as const)(
    'throws rather than reporting missing after a transient manifest failure (%s)',
    async failure => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const manifest = vi
        .fn()
        .mockRejectedValue(
          failure === 'network'
            ? new TypeError('fetch failed')
            : Object.assign(new Error('Manifest unavailable'), { statusCode: failure }),
        )
      const raw = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
      })
      vi.stubGlobal('$fetch', Object.assign(manifest, { raw }))

      await expect(getDocNodes('manifest-down', '1.0.0')).rejects.toThrow(
        /Failed to resolve documentation entry points/,
      )
    },
  )

  it('preserves truncation metadata through generateDocsWithDeno', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const base = 'https://esm.sh/generator-partial@1.0.0'
    stubEsmSh(
      {
        [`${base}/package.json`]: JSON.stringify({
          name: 'generator-partial',
          exports: { '.': './index.js', './broken': './broken.js' },
        }),
        [`${base}/index.d.ts`]: 'export declare const completed: number;',
      },
      {
        [base]: `${base}/index.d.ts`,
        [`${base}/broken`]: 503,
      },
    )
    const { generateDocsWithDeno } = await import('#server/utils/docs')

    const result = await generateDocsWithDeno('generator-partial', '1.0.0')

    expect(result).toMatchObject({
      truncated: true,
      truncationReason: 'upstream-error',
    })
    expect(result?.html).toContain('completed')
    expect(result?.toc).toContain('completed')
  })

  it('returns empty entries when a package genuinely has no types header', async () => {
    stubEsmSh(
      {
        'https://esm.sh/notypes@1.0.0/package.json': JSON.stringify({ name: 'notypes' }),
      },
      {
        'https://esm.sh/notypes@1.0.0': '',
      },
    )

    await expect(getDocNodes('notypes', '1.0.0')).resolves.toEqual({
      version: 1,
      entries: [],
    })
  })
})
