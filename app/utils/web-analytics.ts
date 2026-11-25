/**
 * Share of sessions that report page views to Vercel Web Analytics. Dashboards have to divide
 * their counts by this number to estimate real traffic. Set to `1` to report every session.
 */
const SAMPLE_RATE = 0.5

const SAMPLE_STORAGE_KEY = 'npmx:analytics-sample'
const PACKAGE_CODE_PREFIXES = ['/package-code/', '/package/code/']
const URL_BASE = 'https://npmx.dev'

export interface WebAnalyticsEvent {
  type: string
  url: string
}

export interface WebAnalyticsFilterOptions {
  sampleRate?: number
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  random?: () => number
  /** Whether the browser reports itself as automated, i.e. `navigator.webdriver`. */
  webdriver?: boolean
}

/**
 * Whether the path points at a file or folder inside a package's source tree rather than at the
 * package itself, e.g. `/package-code/nuxt/v/4.2.0/package.json` versus `/package-code/nuxt/v/4.2.0`.
 */
export function isPackageFileView(pathname: string): boolean {
  for (const prefix of PACKAGE_CODE_PREFIXES) {
    if (!pathname.startsWith(prefix)) continue
    const segments = pathname.slice(prefix.length).split('/')
    const versionIndex = segments[0]?.startsWith('@') ? 2 : 1
    if (segments[versionIndex] !== 'v') return false
    return segments.slice(versionIndex + 2).some(Boolean)
  }
  return false
}

function pathnameOf(url: string): string {
  try {
    return new URL(url, URL_BASE).pathname
  } catch {
    return url
  }
}

/**
 * Builds the `beforeSend` function passed to Vercel Web Analytics. It returns `null` for events
 * that should not be reported: anything from an automated browser, repeat views of the page that
 * is already open (query and hash only changes), views inside the package source viewer below the
 * package root, and sessions outside the sample.
 */
export function createWebAnalyticsFilter(options: WebAnalyticsFilterOptions = {}) {
  const {
    sampleRate = SAMPLE_RATE,
    storage = null,
    random = Math.random,
    webdriver = false,
  } = options
  let lastPath: string | null = null
  let sessionSampled: boolean | undefined

  function isSampledSession(): boolean {
    if (sampleRate >= 1) return true
    if (sampleRate <= 0) return false
    if (sessionSampled !== undefined) return sessionSampled

    const stored = storage?.getItem(SAMPLE_STORAGE_KEY)
    if (stored === '1') sessionSampled = true
    else if (stored === '0') sessionSampled = false
    else {
      sessionSampled = random() < sampleRate
      try {
        storage?.setItem(SAMPLE_STORAGE_KEY, sessionSampled ? '1' : '0')
      } catch {}
    }
    return sessionSampled
  }

  return function filterEvent<T extends WebAnalyticsEvent>(event: T): T | null {
    if (webdriver) return null
    if (event.type !== 'pageview') return event

    const pathname = pathnameOf(event.url)
    if (isPackageFileView(pathname)) return null

    const isRepeatView = pathname === lastPath
    lastPath = pathname

    if (isRepeatView) return null
    return isSampledSession() ? event : null
  }
}

/**
 * `sessionStorage` is unavailable when storage is blocked, in which case sampling falls back to
 * one decision per page load.
 */
export function getAnalyticsStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}
