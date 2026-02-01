import { withoutTrailingSlash } from 'ufo'

export type ProviderId =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'gitea'
  | 'forgejo'
  | 'codeberg'
  | 'sourcehut'
  | 'gitee'
  | 'tangled'
  | 'radicle'

export interface RepoRef {
  provider: ProviderId
  owner: string
  repo: string
  host?: string
}

export interface RepositoryInfo extends RepoRef {
  /** Raw file URL base (e.g., https://raw.githubusercontent.com/owner/repo/HEAD) */
  rawBaseUrl: string
  /** Subdirectory within repo where package lives (e.g., packages/ai) */
  directory?: string
}

/** Known GitLab instances (self-hosted) */
export const GITLAB_HOSTS = [
  'gitlab.com',
  'gitlab.gnome.org',
  'gitlab.freedesktop.org',
  'invent.kde.org',
  'salsa.debian.org',
  'framagit.org',
]

interface ProviderConfig {
  id: ProviderId
  /** Check if hostname matches this provider */
  matchHost(host: string): boolean
  /** Parse URL path into owner/repo, returns null if invalid */
  parsePath(parts: string[]): { owner: string; repo: string } | null
  /** Get raw file URL base for resolving relative paths */
  getRawBaseUrl(ref: RepoRef, branch?: string): string
  /** Convert blob URLs to raw URLs (for images) */
  blobToRaw?(url: string): string
}

const providers: ProviderConfig[] = [
  {
    id: 'github',
    matchHost: host => host === 'github.com' || host === 'www.github.com',
    parsePath: parts => {
      if (parts.length < 2) return null
      const owner = decodeURIComponent(parts[0] ?? '').trim()
      const repo = decodeURIComponent(parts[1] ?? '')
        .trim()
        .replace(/\.git$/i, '')
      if (!owner || !repo) return null
      return { owner, repo }
    },
    getRawBaseUrl: (ref, branch = 'HEAD') =>
      `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${branch}`,
    blobToRaw: url => url.replace('/blob/', '/raw/'),
  },
  {
    id: 'gitlab',
    matchHost: host => GITLAB_HOSTS.some(h => host === h || host === `www.${h}`),
    parsePath: parts => {
      if (parts.length < 2) return null
      // GitLab supports nested groups
      const repo = decodeURIComponent(parts[parts.length - 1] ?? '')
        .trim()
        .replace(/\.git$/i, '')
      const owner = parts
        .slice(0, -1)
        .map(p => decodeURIComponent(p).trim())
        .join('/')
      if (!owner || !repo) return null
      return { owner, repo }
    },
    getRawBaseUrl: (ref, branch = 'HEAD') => {
      const host = ref.host ?? 'gitlab.com'
      return `https://${host}/${ref.owner}/${ref.repo}/-/raw/${branch}`
    },
    blobToRaw: url => url.replace('/-/blob/', '/-/raw/'),
  },
  {
    id: 'bitbucket',
    matchHost: host => host === 'bitbucket.org' || host === 'www.bitbucket.org',
    parsePath: parts => {
      if (parts.length < 2) return null
      const owner = decodeURIComponent(parts[0] ?? '').trim()
      const repo = decodeURIComponent(parts[1] ?? '')
        .trim()
        .replace(/\.git$/i, '')
      if (!owner || !repo) return null
      return { owner, repo }
    },
    getRawBaseUrl: (ref, branch = 'HEAD') =>
      `https://bitbucket.org/${ref.owner}/${ref.repo}/raw/${branch}`,
    blobToRaw: url => url.replace('/src/', '/raw/'),
  },
  {
    id: 'codeberg',
    matchHost: host => host === 'codeberg.org' || host === 'www.codeberg.org',
    parsePath: parts => {
      if (parts.length < 2) return null
      const owner = decodeURIComponent(parts[0] ?? '').trim()
      const repo = decodeURIComponent(parts[1] ?? '')
        .trim()
        .replace(/\.git$/i, '')
      if (!owner || !repo) return null
      return { owner, repo }
    },
    getRawBaseUrl: (ref, branch = 'HEAD') =>
      `https://codeberg.org/${ref.owner}/${ref.repo}/raw/branch/${branch === 'HEAD' ? 'main' : branch}`,
    blobToRaw: url => url.replace('/src/', '/raw/'),
  },
  {
    id: 'gitee',
    matchHost: host => host === 'gitee.com' || host === 'www.gitee.com',
    parsePath: parts => {
      if (parts.length < 2) return null
      const owner = decodeURIComponent(parts[0] ?? '').trim()
      const repo = decodeURIComponent(parts[1] ?? '')
        .trim()
        .replace(/\.git$/i, '')
      if (!owner || !repo) return null
      return { owner, repo }
    },
    getRawBaseUrl: (ref, branch = 'master') =>
      `https://gitee.com/${ref.owner}/${ref.repo}/raw/${branch}`,
    blobToRaw: url => url.replace('/blob/', '/raw/'),
  },
  {
    id: 'sourcehut',
    matchHost: host => host === 'sr.ht' || host === 'git.sr.ht',
    parsePath: parts => {
      if (parts.length < 2) return null
      // Sourcehut uses ~username/repo format
      const owner = decodeURIComponent(parts[0] ?? '').trim()
      const repo = decodeURIComponent(parts[1] ?? '')
        .trim()
        .replace(/\.git$/i, '')
      if (!owner || !repo) return null
      return { owner, repo }
    },
    getRawBaseUrl: (ref, branch = 'HEAD') =>
      `https://git.sr.ht/${ref.owner}/${ref.repo}/blob/${branch}`,
  },
  {
    id: 'tangled',
    matchHost: host =>
      host === 'tangled.sh' ||
      host === 'www.tangled.sh' ||
      host === 'tangled.org' ||
      host === 'www.tangled.org',
    parsePath: parts => {
      if (parts.length < 2) return null
      // Tangled uses owner/repo format (owner is a domain-like identifier, e.g., nonbinary.computer)
      const owner = decodeURIComponent(parts[0] ?? '').trim()
      const repo = decodeURIComponent(parts[1] ?? '')
        .trim()
        .replace(/\.git$/i, '')
      if (!owner || !repo) return null
      return { owner, repo }
    },
    getRawBaseUrl: (ref, branch = 'main') =>
      `https://tangled.sh/${ref.owner}/${ref.repo}/raw/branch/${branch}`,
    blobToRaw: url => url.replace('/blob/', '/raw/branch/'),
  },
  {
    id: 'radicle',
    matchHost: host =>
      host === 'radicle.at' || host === 'app.radicle.at' || host === 'seed.radicle.at',
    parsePath: parts => {
      // Radicle URLs: app.radicle.at/nodes/seed.radicle.at/rad:z3nP4yT1PE3m1PxLEzr173sZtJVnT
      // We extract the rad:... identifier as the "repo" with no owner
      const path = parts.join('/')
      const radMatch = path.match(/rad:[a-zA-Z0-9]+/)
      if (!radMatch?.[0]) return null
      // Use empty owner, store full rad: ID as repo
      return { owner: '', repo: radMatch[0] }
    },
    getRawBaseUrl: (ref, branch = 'HEAD') =>
      `https://seed.radicle.at/api/v1/projects/${ref.repo}/blob/${branch}`,
  },
  {
    id: 'forgejo',
    matchHost: host => {
      // Match explicit Forgejo instances
      const forgejoPatterns = [/^forgejo\./i, /\.forgejo\./i]
      // Known Forgejo instances
      const knownInstances = ['next.forgejo.org', 'try.next.forgejo.org']
      if (knownInstances.some(h => host === h)) return true
      return forgejoPatterns.some(p => p.test(host))
    },
    parsePath: parts => {
      if (parts.length < 2) return null
      const owner = decodeURIComponent(parts[0] ?? '').trim()
      const repo = decodeURIComponent(parts[1] ?? '')
        .trim()
        .replace(/\.git$/i, '')
      if (!owner || !repo) return null
      return { owner, repo }
    },
    getRawBaseUrl: (ref, branch = 'HEAD') => {
      const host = ref.host ?? 'codeberg.org'
      return `https://${host}/${ref.owner}/${ref.repo}/raw/branch/${branch === 'HEAD' ? 'main' : branch}`
    },
    blobToRaw: url => url.replace('/src/', '/raw/'),
  },
  {
    id: 'gitea',
    matchHost: host => {
      // Match common Gitea hosting patterns (Forgejo has its own adapter)
      const giteaPatterns = [/^git\./i, /^gitea\./i, /^code\./i, /^src\./i, /gitea\.io$/i]
      // Skip known providers (including Forgejo patterns)
      const skipHosts = [
        'github.com',
        'gitlab.com',
        'codeberg.org',
        'bitbucket.org',
        'gitee.com',
        'sr.ht',
        'git.sr.ht',
        'tangled.sh',
        'tangled.org',
        'next.forgejo.org',
        'try.next.forgejo.org',
        ...GITLAB_HOSTS,
      ]
      if (skipHosts.some(h => host === h || host.endsWith(`.${h}`))) return false
      // Skip Forgejo patterns
      if (/^forgejo\./i.test(host) || /\.forgejo\./i.test(host)) return false
      return giteaPatterns.some(p => p.test(host))
    },
    parsePath: parts => {
      if (parts.length < 2) return null
      const owner = decodeURIComponent(parts[0] ?? '').trim()
      const repo = decodeURIComponent(parts[1] ?? '')
        .trim()
        .replace(/\.git$/i, '')
      if (!owner || !repo) return null
      return { owner, repo }
    },
    getRawBaseUrl: (ref, branch = 'HEAD') => {
      const host = ref.host ?? 'gitea.io'
      return `https://${host}/${ref.owner}/${ref.repo}/raw/branch/${branch === 'HEAD' ? 'main' : branch}`
    },
    blobToRaw: url => url.replace('/src/', '/raw/'),
  },
]

/**
 * Normalize various git URL formats to a standard HTTPS URL.
 * Handles: git+https://, git://, git@host:path, ssh://git@host/path
 */
export function normalizeGitUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  const normalized = raw.replace(/^git\+/, '')

  // Handle ssh:// URLs by converting to https://
  if (/^ssh:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized)
      const path = url.pathname.replace(/^\/*/, '')
      return `https://${url.hostname}/${path}`
    } catch {
      // Fall through to SCP handling
    }
  }

  if (!/^https?:\/\//i.test(normalized)) {
    // Handle SCP-style URLs: git@host:path
    const scp = normalized.match(/^(?:git@)?([^:/]+):(.+)$/i)
    if (scp?.[1] && scp?.[2]) {
      const host = scp[1]
      const path = scp[2].replace(/^\/*/, '')
      return `https://${host}/${path}`
    }
  }

  return normalized
}

export function parseRepoUrl(input: string): RepoRef | null {
  const normalized = normalizeGitUrl(input)
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    const host = url.hostname.toLowerCase()
    const parts = url.pathname.split('/').filter(Boolean)

    for (const provider of providers) {
      if (!provider.matchHost(host)) continue
      const parsed = provider.parsePath(parts)
      if (parsed) {
        const needsHost = ['gitlab', 'gitea', 'forgejo', 'radicle'].includes(provider.id)
        return {
          provider: provider.id,
          owner: parsed.owner,
          repo: parsed.repo,
          host: needsHost ? host : undefined,
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Parse repository field from package.json into repository info.
 * Supports both full objects and shorthand strings.
 */
export function parseRepositoryInfo(
  repository?: { type?: string; url?: string; directory?: string } | string,
): RepositoryInfo | undefined {
  if (!repository) return undefined

  let url: string | undefined
  let directory: string | undefined

  if (typeof repository === 'string') {
    url = repository
  } else {
    url = repository.url
    directory = repository.directory
  }

  if (!url) return undefined

  const ref = parseRepoUrl(url)
  if (!ref) return undefined

  const provider = providers.find(p => p.id === ref.provider)
  if (!provider) return undefined

  return {
    ...ref,
    rawBaseUrl: provider.getRawBaseUrl(ref),
    directory: directory ? withoutTrailingSlash(directory) : undefined,
  }
}

export function getProviderConfig(providerId: ProviderId): ProviderConfig | undefined {
  return providers.find(p => p.id === providerId)
}

export function convertBlobToRawUrl(url: string, providerId: ProviderId): string {
  const provider = providers.find(p => p.id === providerId)
  if (provider?.blobToRaw) {
    return provider.blobToRaw(url)
  }
  return url
}

export function isKnownGitProvider(url: string): boolean {
  return parseRepoUrl(url) !== null
}
