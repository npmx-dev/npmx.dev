import { describe, expect, it, vi, afterEach } from 'vitest'
import { createResolver, createLoader } from '#server/utils/docs/client'

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

  // Issue #2739: Prevent sourceMappingURL specifiers from being resolved as package names
  // https://github.com/npmx-dev/npmx.dev/issues/2739
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
