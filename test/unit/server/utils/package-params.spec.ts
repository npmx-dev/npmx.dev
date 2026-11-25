import type { H3Event } from 'h3'
import { describe, expect, it } from 'vite-plus/test'
import {
  INVALID_PACKAGE_PARAM_CACHE_CONTROL,
  validPackageParams,
} from '#server/utils/package-params'

function makeEvent() {
  const headers: Record<string, string> = {}
  return {
    event: {
      node: {
        res: {
          setHeader: (name: string, value: string) => {
            headers[name] = value
          },
        },
      },
    } as unknown as H3Event,
    headers,
  }
}

const REJECTED = [
  { packageName: 'foo bar' },
  { packageName: '.env' },
  { packageName: '%E0%A4%A' },
  { packageName: 'vue', version: '1.0.0 beta' },
  { packageName: 'vue', version: '1.0.0', filePath: '../secrets' },
  { packageName: 'vue', version: '1.0.0', filePath: '/etc/passwd' },
]

describe('validPackageParams', () => {
  it('decodes an encoded scoped name and version', () => {
    expect(
      validPackageParams(makeEvent().event, {
        packageName: '@nuxt%2Fkit',
        version: '2.0.0-beta.1%2Bsha.abc',
      }),
    ).toEqual({ packageName: '@nuxt/kit', version: '2.0.0-beta.1+sha.abc' })
  })

  it('leaves absent coordinates out', () => {
    expect(validPackageParams(makeEvent().event, { packageName: 'vue' })).toEqual({
      packageName: 'vue',
    })
  })

  it('accepts a file path below the package root', () => {
    expect(
      validPackageParams(makeEvent().event, {
        packageName: 'vue',
        version: '3.5.0',
        filePath: 'dist/vue.runtime.esm-bundler.js',
      }),
    ).toEqual({
      packageName: 'vue',
      version: '3.5.0',
      filePath: 'dist/vue.runtime.esm-bundler.js',
    })
  })

  it.each(REJECTED)('rejects %j with a cacheable 404', raw => {
    const { event, headers } = makeEvent()
    let thrown: unknown
    try {
      validPackageParams(event, raw)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toMatchObject({ statusCode: 404 })
    expect(headers['Cache-Control']).toBe(INVALID_PACKAGE_PARAM_CACHE_CONTROL)
  })
})
