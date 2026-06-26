import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodePackageName } from '#shared/utils/npm'

// Mock Nitro/auto-imported globals before importing the module under test.
const $fetchMock = vi.fn()
vi.stubGlobal('$fetch', $fetchMock)
vi.stubGlobal('encodePackageName', encodePackageName)

const { getModules } = await import('#server/utils/docs/client')

describe('getModules', () => {
  beforeEach(() => {
    $fetchMock.mockReset()
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
