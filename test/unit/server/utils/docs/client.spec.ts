import { describe, expect, it } from 'vitest'
import { createResolver } from '#server/utils/docs/client'

// =============================================================================
// Issue #2739: sourceMappingURL specifiers resolved as package names
// https://github.com/npmx-dev/npmx.dev/issues/2739
// =============================================================================

describe('issue #2739 - source map specifiers', () => {
  const resolve = createResolver()
  const referrer = 'https://esm.sh/effect-web-midi@0.2.1/dist-types/index.d.ts'

  it('does not resolve source map references', () => {
    expect(resolve('index.d.ts.map', referrer)).toBe('index.d.ts.map')
  })

  it('does not resolve relative source map references', () => {
    expect(resolve('./index.d.ts.map', referrer)).toBe('./index.d.ts.map')
  })
})

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
})
