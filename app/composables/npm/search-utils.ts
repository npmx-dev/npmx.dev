import type { NpmSearchResponse, NpmSearchResult, PackageMetaResponse } from '#shared/types'

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

export interface SearchSuggestion {
  type: 'user' | 'org'
  name: string
  exists: boolean
}

export type SuggestionIntent = 'user' | 'org' | 'both' | null

export function isValidNpmName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 214) return false
  if (!/^[a-z0-9]/i.test(name)) return false
  return /^[\w-]+$/.test(name)
}

/** Parse a search query into a suggestion intent (`~user`, `@org`, or plain `both`). */
export function parseSuggestionIntent(query: string): { intent: SuggestionIntent; name: string } {
  const q = query.trim()
  if (!q) return { intent: null, name: '' }

  if (q.startsWith('~')) {
    const name = q.slice(1)
    return isValidNpmName(name) ? { intent: 'user', name } : { intent: null, name: '' }
  }

  if (q.startsWith('@')) {
    if (q.includes('/')) return { intent: null, name: '' }
    const name = q.slice(1)
    return isValidNpmName(name) ? { intent: 'org', name } : { intent: null, name: '' }
  }

  return isValidNpmName(q) ? { intent: 'both', name: q } : { intent: null, name: '' }
}
