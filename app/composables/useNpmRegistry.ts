import type {
  Packument,
  NpmSearchResponse,
  NpmDownloadCount,
  NpmDownloadRange,
} from '#shared/types'

const NPM_REGISTRY = 'https://registry.npmjs.org'
const NPM_API = 'https://api.npmjs.org'

export function useNpmRegistry() {
  async function fetchPackage(name: string): Promise<Packument> {
    const encodedName = encodePackageName(name)
    return await $fetch<Packument>(`${NPM_REGISTRY}/${encodedName}`)
  }

  async function searchPackages(
    query: string,
    options: {
      size?: number
      from?: number
      quality?: number
      popularity?: number
      maintenance?: number
    } = {},
  ): Promise<NpmSearchResponse> {
    const params = new URLSearchParams()
    params.set('text', query)
    if (options.size) params.set('size', String(options.size))
    if (options.from) params.set('from', String(options.from))
    if (options.quality !== undefined) params.set('quality', String(options.quality))
    if (options.popularity !== undefined) params.set('popularity', String(options.popularity))
    if (options.maintenance !== undefined) params.set('maintenance', String(options.maintenance))

    return await $fetch<NpmSearchResponse>(`${NPM_REGISTRY}/-/v1/search?${params.toString()}`)
  }

  async function fetchDownloads(
    packageName: string,
    period: 'last-day' | 'last-week' | 'last-month' | 'last-year' = 'last-week',
  ): Promise<NpmDownloadCount> {
    const encodedName = encodePackageName(packageName)
    return await $fetch<NpmDownloadCount>(`${NPM_API}/downloads/point/${period}/${encodedName}`)
  }

  async function fetchDownloadRange(
    packageName: string,
    period: 'last-week' | 'last-month' | 'last-year' = 'last-month',
  ): Promise<NpmDownloadRange> {
    const encodedName = encodePackageName(packageName)
    return await $fetch<NpmDownloadRange>(`${NPM_API}/downloads/range/${period}/${encodedName}`)
  }

  return {
    fetchPackage,
    searchPackages,
    fetchDownloads,
    fetchDownloadRange,
  }
}

function encodePackageName(name: string): string {
  if (name.startsWith('@')) {
    return `@${encodeURIComponent(name.slice(1))}`
  }
  return encodeURIComponent(name)
}

export function usePackage(name: MaybeRefOrGetter<string>) {
  const registry = useNpmRegistry()

  return useLazyAsyncData(
    () => `package:${toValue(name)}`,
    () => registry.fetchPackage(toValue(name)),
  )
}

export function usePackageDownloads(
  name: MaybeRefOrGetter<string>,
  period: MaybeRefOrGetter<'last-day' | 'last-week' | 'last-month' | 'last-year'> = 'last-week',
) {
  const registry = useNpmRegistry()

  return useLazyAsyncData(
    () => `downloads:${toValue(name)}:${toValue(period)}`,
    () => registry.fetchDownloads(toValue(name), toValue(period)),
  )
}

const emptySearchResponse = { objects: [], total: 0, time: new Date().toISOString() } satisfies NpmSearchResponse

export function useNpmSearch(
  query: MaybeRefOrGetter<string>,
  options: MaybeRefOrGetter<{
    size?: number
    from?: number
  }> = {},
) {
  const registry = useNpmRegistry()
  let lastSearch: NpmSearchResponse | undefined = undefined

  return useLazyAsyncData(
    () => `search:${toValue(query)}:${JSON.stringify(toValue(options))}`,
    async () => {
      const q = toValue(query)
      if (!q.trim()) {
        return Promise.resolve(emptySearchResponse)
      }
      return lastSearch = await registry.searchPackages(q, toValue(options))
    },
    { default: () => lastSearch || emptySearchResponse },
  )
}
