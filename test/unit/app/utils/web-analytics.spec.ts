import { describe, expect, it, vi } from 'vite-plus/test'
import { createWebAnalyticsFilter, isPackageFileView } from '~/utils/web-analytics'

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
  }
}

describe('isPackageFileView', () => {
  it('treats the package source tree as a page view', () => {
    expect(isPackageFileView('/package-code/nuxt')).toBe(false)
    expect(isPackageFileView('/package-code/nuxt/v/4.2.0')).toBe(false)
    expect(isPackageFileView('/package-code/@nuxt/kit/v/1.0.0/')).toBe(false)
  })

  it('treats files and folders inside the tree as file views', () => {
    expect(isPackageFileView('/package-code/nuxt/v/4.2.0/package.json')).toBe(true)
    expect(isPackageFileView('/package-code/@nuxt/kit/v/1.0.0/src/index.ts')).toBe(true)
    expect(isPackageFileView('/package-code/nuxt/v/4.2.0/src')).toBe(true)
    expect(isPackageFileView('/package-code/nuxt/v/4.2.0/src/v/')).toBe(true)
  })

  it('handles percent-encoded segments', () => {
    expect(isPackageFileView('/package-code/%40nuxt/kit/v/1.0.0')).toBe(false)
    expect(isPackageFileView('/package-code/%40nuxt/kit/v/1.0.0/src/index.ts')).toBe(true)
    expect(isPackageFileView('/package-code/nuxt/v/1.0.0/src/my%20file.ts')).toBe(true)
  })

  it('does not throw on malformed percent-encoding', () => {
    expect(isPackageFileView('/package-code/nuxt/v/1.0.0/%E0%A4%A')).toBe(true)
  })

  it('handles the legacy /package/code path and unrelated routes', () => {
    expect(isPackageFileView('/package/code/nuxt/v/4.2.0/package.json')).toBe(true)
    expect(isPackageFileView('/package/nuxt/v/4.2.0')).toBe(false)
    expect(isPackageFileView('/package-docs/nuxt/v/4.2.0/api')).toBe(false)
  })
})

const pageview = (url: string) => ({ type: 'pageview' as const, url })

describe('createWebAnalyticsFilter', () => {
  it('reports every page view when every session is sampled', () => {
    const filter = createWebAnalyticsFilter({ sampleRate: 1 })

    expect(filter(pageview('https://npmx.dev/package/nuxt'))).toEqual(
      pageview('https://npmx.dev/package/nuxt'),
    )
    expect(filter(pageview('https://npmx.dev/search?q=vue'))).toEqual(
      pageview('https://npmx.dev/search?q=vue'),
    )
  })

  it('drops views that only change the query or hash', () => {
    const filter = createWebAnalyticsFilter({ sampleRate: 1 })

    expect(filter(pageview('/package/nuxt'))).not.toBeNull()
    expect(filter(pageview('/package/nuxt#readme'))).toBeNull()
    expect(filter(pageview('/package/nuxt?tab=versions'))).toBeNull()
    expect(filter(pageview('/search?q=nuxt'))).not.toBeNull()
    expect(filter(pageview('/search?q=nuxt&page=2'))).toBeNull()
  })

  it('reports a known route again once another page has been viewed', () => {
    const filter = createWebAnalyticsFilter({ sampleRate: 1 })

    expect(filter(pageview('/search?q=nuxt'))).not.toBeNull()
    expect(filter(pageview('/package/nuxt'))).not.toBeNull()
    expect(filter(pageview('/search?q=vue'))).not.toBeNull()
  })

  it('drops file views in the package source viewer', () => {
    const filter = createWebAnalyticsFilter({ sampleRate: 1 })

    expect(filter(pageview('/package-code/nuxt/v/4.2.0'))).not.toBeNull()
    expect(filter(pageview('/package-code/nuxt/v/4.2.0/package.json'))).toBeNull()
    expect(filter(pageview('/package-code/nuxt/v/4.2.0/src/index.ts'))).toBeNull()
    expect(filter(pageview('/package-code/nuxt/v/4.2.0'))).toBeNull()
    expect(filter(pageview('/package/vue'))).not.toBeNull()
    expect(filter(pageview('/package-code/nuxt/v/4.2.0'))).not.toBeNull()
  })

  it('leaves custom events alone', () => {
    const filter = createWebAnalyticsFilter({ sampleRate: 0 })

    expect(filter({ type: 'event', url: '/package/nuxt' })).not.toBeNull()
  })

  it('drops every event from an automated browser', () => {
    const filter = createWebAnalyticsFilter({ sampleRate: 1, webdriver: true })

    expect(filter(pageview('/package/nuxt'))).toBeNull()
    expect(filter({ type: 'event', url: '/package/nuxt' })).toBeNull()
  })

  it('drops page views when no session is sampled', () => {
    const filter = createWebAnalyticsFilter({ sampleRate: 0 })

    expect(filter(pageview('/package/nuxt'))).toBeNull()
  })

  it('decides once per session and reuses the stored decision', () => {
    const storage = createStorage()
    const random = vi.fn(() => 0.9)

    const first = createWebAnalyticsFilter({ sampleRate: 0.5, storage, random })
    expect(first(pageview('/package/nuxt'))).toBeNull()
    expect(first(pageview('/package/vue'))).toBeNull()
    expect(random).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenCalledTimes(1)

    const second = createWebAnalyticsFilter({ sampleRate: 0.5, storage, random })
    expect(second(pageview('/package/nuxt'))).toBeNull()
    expect(random).toHaveBeenCalledTimes(1)
  })

  it('reports every page view of a sampled session and reuses the stored decision', () => {
    const storage = createStorage()
    const random = vi.fn(() => 0.1)
    const first = createWebAnalyticsFilter({ sampleRate: 0.5, storage, random })

    expect(first(pageview('/package/nuxt'))).not.toBeNull()
    expect(first(pageview('/package/vue'))).not.toBeNull()

    const second = createWebAnalyticsFilter({ sampleRate: 0.5, storage, random: () => 0.9 })
    expect(second(pageview('/package/vue'))).not.toBeNull()
    expect(random).toHaveBeenCalledTimes(1)
  })

  it('samples by default', () => {
    expect(createWebAnalyticsFilter({ random: () => 0 })(pageview('/package/nuxt'))).not.toBeNull()
    expect(createWebAnalyticsFilter({ random: () => 0.999 })(pageview('/package/nuxt'))).toBeNull()
  })

  it('keeps sampling when sessionStorage cannot be written', () => {
    const storage = createStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const filter = createWebAnalyticsFilter({ sampleRate: 0.5, storage, random: () => 0.1 })

    expect(filter(pageview('/package/nuxt'))).not.toBeNull()
    expect(filter(pageview('/package/vue'))).not.toBeNull()
  })
})
