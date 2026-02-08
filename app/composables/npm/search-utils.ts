import type { NpmSearchResponse, NpmSearchResult, PackageMetaResponse } from '#shared/types'

/**
 * Convert a lightweight package-meta API response to a search result for display.
 */
export function metaToSearchResult(meta: PackageMetaResponse): NpmSearchResult {
  return {
    package: {
      name: meta.name,
      version: meta.version,
      description: meta.description,
      keywords: meta.keywords,
      license: meta.license,
      date: meta.date,
      links: meta.links,
      author: meta.author,
      maintainers: meta.maintainers,
    },
    score: { final: 0, detail: { quality: 0, popularity: 0, maintenance: 0 } },
    searchScore: 0,
    downloads: meta.weeklyDownloads !== undefined ? { weekly: meta.weeklyDownloads } : undefined,
    updated: meta.date,
  }
}

export function emptySearchResponse(): NpmSearchResponse {
  return {
    objects: [],
    total: 0,
    isStale: false,
    time: new Date().toISOString(),
  }
}
