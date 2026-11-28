import { describe, expect, it } from 'vite-plus/test'
import { getLanguageFromPath } from '#server/utils/code-highlight'
import { isBinaryContentType } from '~/utils/file-types'

describe('isBinaryContentType', () => {
  it.each(['svelte', 'astro', 'typescript', 'jsonc'])(
    'previews recognized %s source served as octet-stream',
    language => {
      expect(isBinaryContentType('application/octet-stream', language)).toBe(false)
      expect(isBinaryContentType('application/octet-stream; charset=utf-8', language)).toBe(false)
    },
  )

  it.each([undefined, '', 'text'])('keeps unknown octet-stream files binary (%s)', language => {
    expect(isBinaryContentType('application/octet-stream', language)).toBe(true)
  })

  it.each([
    'android/src/rn86/java/com/unistyles/NativePlatform+extraWindows.kt',
    'android/build.gradle',
  ])('previews %s when a CDN serves it as octet-stream', filePath => {
    const language = getLanguageFromPath(filePath)
    expect(language).not.toBe('text')
    expect(isBinaryContentType('application/octet-stream', language)).toBe(false)
    expect(isBinaryContentType('application/octet-stream; charset=utf-8', language)).toBe(false)
  })

  it.each(['image/svg+xml', 'application/wasm', 'application/zip', 'font/woff2'])(
    'keeps explicit binary MIME type %s binary even with a recognized language',
    contentType => {
      expect(isBinaryContentType(contentType, 'xml')).toBe(true)
    },
  )

  it.each(['text/plain', 'text/javascript', 'application/json'])(
    'previews text MIME type %s without a recognized language',
    contentType => {
      expect(isBinaryContentType(contentType)).toBe(false)
    },
  )
})
