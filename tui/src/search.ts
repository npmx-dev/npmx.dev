export interface PackageLinks {
  npm?: string
  homepage?: string
  repository?: string
  bugs?: string
}

export interface PackagePerson {
  name?: string
  username?: string
  email?: string
  url?: string
}

export interface PackageSearchResult {
  name: string
  version: string
  description: string
  weeklyDownloads?: number
  keywords: string[]
  license?: string
  links?: PackageLinks
  maintainers: PackagePerson[]
}

export interface PackageDetails extends PackageSearchResult {
  date?: string
  modified?: string
  created?: string
  distTags?: Record<string, string>
  versionCount?: number
  deprecated?: string
  unpackedSize?: number
  author?: PackagePerson
  entryPoints?: {
    type?: string
    main?: string
    module?: string
    types?: string
    hasExports?: boolean
    binNames?: string[]
    engines?: Record<string, string>
    dependenciesCount?: number
    peerDependenciesCount?: number
  }
}

interface NpmSearchPackage {
  name: string
  version: string
  description?: string
  keywords?: string[]
  license?: string
  links?: PackageLinks
  maintainers?: PackagePerson[]
}

interface NpmSearchResult {
  package: NpmSearchPackage
  downloads?: {
    weekly?: number
  }
}

interface NpmSearchResponse {
  objects: NpmSearchResult[]
  total: number
}

type PackageDetailsResponse = Partial<PackageDetails> & Pick<PackageDetails, 'name' | 'version'>

export interface PackageSearchResponse {
  results: PackageSearchResult[]
  total: number
}

export interface SearchPackagesOptions {
  baseUrl: string
  query: string
  size?: number
  from?: number
  signal?: AbortSignal
}

export interface GetPackageDetailsOptions {
  baseUrl: string
  name: string
  signal?: AbortSignal
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function encodePackagePath(name: string): string {
  return name.split('/').map(encodeURIComponent).join('/')
}

export function getDefaultApiBaseUrl(): string {
  return process.env.NPMX_API_BASE_URL ?? 'http://127.0.0.1:3000'
}

function normalizePackageDetails(data: PackageDetailsResponse): PackageDetails {
  return {
    name: data.name,
    version: data.version,
    description: data.description ?? 'No description provided.',
    weeklyDownloads: data.weeklyDownloads,
    keywords: data.keywords ?? [],
    license: data.license,
    links: data.links,
    maintainers: data.maintainers ?? [],
    date: data.date,
    modified: data.modified,
    created: data.created,
    distTags: data.distTags,
    versionCount: data.versionCount,
    deprecated: data.deprecated,
    unpackedSize: data.unpackedSize,
    author: data.author,
    entryPoints: data.entryPoints,
  }
}

export async function searchPackages({
  baseUrl,
  query,
  size = 12,
  from = 0,
  signal,
}: SearchPackagesOptions): Promise<PackageSearchResponse> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { results: [], total: 0 }
  }

  const url = new URL('api/registry/search', normalizeBaseUrl(baseUrl))
  url.searchParams.set('q', trimmed)
  url.searchParams.set('size', String(size))
  url.searchParams.set('from', String(Math.max(0, from)))

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Package search failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as NpmSearchResponse
  return {
    total: data.total,
    results: data.objects.map(result => ({
      name: result.package.name,
      version: result.package.version,
      description: result.package.description ?? 'No description provided.',
      weeklyDownloads: result.downloads?.weekly,
      keywords: result.package.keywords ?? [],
      license: result.package.license,
      links: result.package.links,
      maintainers: result.package.maintainers ?? [],
    })),
  }
}

export async function getPackageDetails({
  baseUrl,
  name,
  signal,
}: GetPackageDetailsOptions): Promise<PackageDetails> {
  const url = new URL(
    `api/registry/package-meta/${encodePackagePath(name)}`,
    normalizeBaseUrl(baseUrl),
  )

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Package details failed: ${response.status} ${response.statusText}`)
  }

  return normalizePackageDetails((await response.json()) as PackageDetailsResponse)
}
