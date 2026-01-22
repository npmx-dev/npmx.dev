import type { Packument, NpmSearchResponse, NpmDownloadCount } from '#shared/types'

const NPM_REGISTRY = 'https://registry.npmjs.org'
const NPM_API = 'https://api.npmjs.org'

function encodePackageName(name: string): string {
  if (name.startsWith('@')) {
    return `@${encodeURIComponent(name.slice(1))}`
  }
  return encodeURIComponent(name)
}

export const fetchNpmPackage = defineCachedFunction(
  async (name: string): Promise<Packument> => {
    const encodedName = encodePackageName(name)
    return await $fetch<Packument>(`${NPM_REGISTRY}/${encodedName}`)
  },
  {
    maxAge: 60 * 5,
    name: 'npm-package',
    getKey: (name: string) => name,
  },
)

export const fetchNpmSearch = defineCachedFunction(
  async (query: string, size: number = 20, from: number = 0): Promise<NpmSearchResponse> => {
    const params = new URLSearchParams({
      text: query,
      size: String(size),
      from: String(from),
    })
    return await $fetch<NpmSearchResponse>(`${NPM_REGISTRY}/-/v1/search?${params.toString()}`)
  },
  {
    maxAge: 60 * 2,
    name: 'npm-search',
    getKey: (query: string, size: number, from: number) => `${query}:${size}:${from}`,
  },
)

export const fetchNpmDownloads = defineCachedFunction(
  async (name: string, period: string = 'last-week'): Promise<NpmDownloadCount> => {
    const encodedName = encodePackageName(name)
    return await $fetch<NpmDownloadCount>(`${NPM_API}/downloads/point/${period}/${encodedName}`)
  },
  {
    maxAge: 60 * 60,
    name: 'npm-downloads',
    getKey: (name: string, period: string) => `${name}:${period}`,
  },
)
