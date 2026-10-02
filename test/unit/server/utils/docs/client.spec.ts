import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoader, createResolver, getModules } from '#server/utils/docs/client'

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

  it('leaves node builtins unchanged', () => {
    expect(resolve('node:fs', referrer)).toBe('node:fs')
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
  const load = createLoader()

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns undefined for source map files', async () => {
    expect(await load('index.d.ts.map')).toBeUndefined()
    expect(await load('https://esm.sh/foo.js.map')).toBeUndefined()
    expect(await load('index.d.ts.map?v=123')).toBeUndefined()
    expect(await load('https://esm.sh/foo.js.map#hash')).toBeUndefined()
  })

  it('returns undefined for invalid or non-HTTP URLs', async () => {
    expect(await load('not-a-valid-url')).toBeUndefined()
    expect(await load('node:fs')).toBeUndefined()
    expect(await load('file:///etc/passwd')).toBeUndefined()
  })

  it('fetches and returns module content for valid URLs', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      url: 'https://esm.sh/foo@1.0.0/index.d.ts',
      headers: new Headers({ 'content-type': 'application/typescript' }),
      _data: { text: async () => 'export const foo = 1;' },
    })
    vi.stubGlobal('$fetch', { raw: mockFetch })

    const result = await load('https://esm.sh/foo@1.0.0/index.d.ts')

    expect(result).toEqual({
      kind: 'module',
      specifier: 'https://esm.sh/foo@1.0.0/index.d.ts',
      headers: { 'content-type': 'application/typescript' },
      content: 'export const foo = 1;',
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('returns undefined if the fetch fails (non-200 status)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 404 })
    vi.stubGlobal('$fetch', { raw: mockFetch })

    expect(await load('https://esm.sh/foo@1.0.0/missing.d.ts')).toBeUndefined()
  })
})

describe('getModules', () => {
  const $fetchMock = vi.fn()

  beforeEach(() => {
    $fetchMock.mockReset()
    vi.stubGlobal('$fetch', $fetchMock)
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

  it('ignores ./package.json and wildcard submodules', async () => {
    $fetchMock.mockResolvedValue({
      name: 'pkg',
      exports: {
        '.': './index.mjs',
        './package.json': './package.json',
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
