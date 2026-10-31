import type { ForgeWeb, WebOptions } from 'forges/web'
import {
  bitbucket,
  forgejo,
  gitea,
  gitee,
  github,
  gitlab,
  pushin,
  sourcehut,
  tangled,
} from 'forges/web'
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
  | 'pushin'

export interface RepoRef {
  provider: ProviderId
  owner: string
  repo: string
  host?: string
}

export interface RepositoryInfo extends RepoRef {
  /** Subdirectory within repo where package lives (e.g., packages/ai) */
  directory?: string
}

/** Known GitLab instances (self-hosted) */
const GITLAB_HOSTS = [
  'gitlab.com',
  'gitlab.gnome.org',
  'gitlab.freedesktop.org',
  'invent.kde.org',
  'salsa.debian.org',
  'framagit.org',
]

/**
 * Repo URLs come from npm package metadata, so package publishers can specify any hostname. As this
 * is effectively user-controlled input that can point at a malicious user-controlled server, this
 * would put us at risk of Server-Side Request Forgery (SSRF). Thus we only support allowlisted hosts.
 */
const FORGEJO_HOSTS = ['next.forgejo.org', 'try.next.forgejo.org', 'code.haverbeke.berlin']

/**
 * No open-ended Gitea host detection for the same reason as Forgejo above.
 */
const GITEA_HOSTS = ['gitea.com']

interface ProviderConfig {
  id: ProviderId
  /** Hosts the provider is recognised on; the first is its public instance. */
  hosts: readonly string[]
  /** The forge's web entry, which reads a repository path with the forge's own rules. */
  web?: (options: WebOptions) => ForgeWeb
  /** The ref carries its host, because the provider has self-hosted instances. */
  carryHost?: boolean
  /**
   * The instance base URL, where the forge's own default is not the one npmx
   * serves. Omitted for a forge whose public instance is its default.
   */
  baseUrl?: (ref: RepoRef) => string | undefined
  /** The host an npm shorthand (`forgejo:owner/repo`) expands to, where it is not the first host. */
  shorthandHost?: string
}

/** The ref's own instance, which `forges` needs to tell apart from the default. */
const selfHosted = (ref: RepoRef) => (ref.host ? `https://${ref.host}` : undefined)

const PROVIDERS: readonly ProviderConfig[] = [
  { id: 'github', hosts: ['github.com'], web: github },
  { id: 'gitlab', hosts: GITLAB_HOSTS, web: gitlab, carryHost: true, baseUrl: selfHosted },
  { id: 'bitbucket', hosts: ['bitbucket.org'], web: bitbucket },
  // Codeberg is a Forgejo instance.
  { id: 'codeberg', hosts: ['codeberg.org'], web: forgejo, baseUrl: () => 'https://codeberg.org' },
  { id: 'gitee', hosts: ['gitee.com'], web: gitee },
  { id: 'sourcehut', hosts: ['git.sr.ht', 'sr.ht'], web: sourcehut },
  { id: 'tangled', hosts: ['tangled.org', 'tangled.sh'], web: tangled },
  // Radicle has no `forges/web` entry: refs keep the `rad:` id as the repo.
  { id: 'radicle', hosts: ['radicle.at', 'app.radicle.at', 'seed.radicle.at'], carryHost: true },
  // Pushin serves the web UI and API on pushin.eu, but clone URLs use git.pushin.eu.
  { id: 'pushin', hosts: ['pushin.eu', 'git.pushin.eu'], web: pushin },
  {
    id: 'forgejo',
    hosts: FORGEJO_HOSTS,
    web: forgejo,
    carryHost: true,
    baseUrl: selfHosted,
    shorthandHost: 'code.forgejo.org',
  },
  { id: 'gitea', hosts: GITEA_HOSTS, web: gitea, carryHost: true, baseUrl: selfHosted },
]

function configFor(provider: ProviderId) {
  return PROVIDERS.find(providerConfig => providerConfig.id === provider)
}

/** Whether a host is one the provider is recognised on, ignoring the `www.` prefix. */
function matchesHost(config: ProviderConfig, host: string) {
  return config.hosts.some(known => host === known || host === `www.${known}`)
}

/** The instance base URL for a ref, or `undefined` for the forge's own default. */
export function instanceBaseUrl(ref: RepoRef): string | undefined {
  return configFor(ref.provider)?.baseUrl?.(ref)
}

/** The `forges/web` entry for a provider, or `undefined` where it has none (radicle). */
export function providerWeb(provider: ProviderId): ((options: WebOptions) => ForgeWeb) | undefined {
  return configFor(provider)?.web
}

/** Whether the provider has self-hosted instances, whose host a ref carries. */
export function providerNeedsHost(provider: ProviderId): boolean {
  return configFor(provider)?.carryHost === true
}

/**
 * Normalize various git URL formats to a standard HTTPS URL.
 * Handles: git+https://, git://, git@host:path, ssh://git@host/path, github:owner/repo
 */
export function normalizeGitUrl(input: string): string | null {
  let url = input.trim()
  if (!url) return null

  // Expand shorthand provider prefixes (e.g. "github:owner/repo" -> "https://github.com/owner/repo")
  for (const provider of PROVIDERS) {
    const prefix = `${provider.id}:`
    if (!url.startsWith(prefix)) continue
    url = `https://${provider.shorthandHost ?? provider.hosts[0]}/${url.slice(prefix.length)}`
    break
  }

  url = url
    .replace(/^git\+/, '')
    .replace(/\.git(?=[/#?]|$)/i, '')
    .replace(/(^|\/)[^/]+?@/, '$1') // remove "user@" from "ssh://user@host.com:..."
    .replace(/(\.[^./]+?):/, '$1/') // change ".com:" to ".com/" from "ssh://user@host.com:..."
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\//, 'https://')
  // SCP-style shorthand with a dotless host (e.g. "git@localhost:owner/repo"); hosts with a
  // dot (e.g. "git@github.com:user/repo") are already handled by the replacements above
  if (!url.includes('://')) {
    const scpMatch = /^(?:[^@/]+@)?([^/:]+):(.+)$/.exec(url)
    const host = scpMatch?.[1]
    const path = scpMatch?.[2]
    if (host && path) {
      url = `https://${host}/${path}`
    }
  }

  // Bare GitHub shorthand (e.g. "repository": "owner/repo"), following npm's convention;
  // host-prefixed paths (e.g. "git.sr.ht/~user/repo") are preserved as-is
  if (!url.includes('://')) {
    const shorthandMatch = /^([^./?#]+)\/([^?#]*)([?#].*)?$/.exec(url)
    const owner = shorthandMatch?.[1]
    const repo = shorthandMatch?.[2]
    const suffix = shorthandMatch?.[3] ?? ''
    if (owner && repo) {
      return `https://github.com/${owner}/${repo}${suffix}`
    }
  }

  if (!url) return null
  return url.includes('://') ? url : `https://${url}`
}

/** Reads `owner/repo` with the forge's own URL rules, so nested groups and `~user` parse. */
function parseRepoPath(config: ProviderConfig, host: string, url: URL) {
  const repo = config.web?.({ baseUrl: `https://${host}` }).parseUrl(url)?.repo
  return repo ? { owner: repo.owner, repo: repo.name } : null
}

/** Radicle has no web entry; the `rad:` id is the repo, with no owner. */
function parseRadiclePath(url: URL) {
  const rad = /rad:[a-zA-Z0-9]+/.exec(url.pathname)
  return rad ? { owner: '', repo: rad[0] } : null
}

export function parseRepoUrl(input: string): RepoRef | null {
  const normalized = normalizeGitUrl(input)
  if (!normalized) return null

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  const config = PROVIDERS.find(providerConfig => matchesHost(providerConfig, host))
  if (!config) return null

  const repo = config.web ? parseRepoPath(config, host, url) : parseRadiclePath(url)
  if (!repo) return null

  return {
    provider: config.id,
    owner: repo.owner,
    repo: repo.repo,
    host: config.carryHost ? host : undefined,
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

  return {
    ...ref,
    directory: directory ? withoutTrailingSlash(directory) : undefined,
  }
}

/**
 * API origins used by each provider for client-side repo metadata fetches.
 * Self-hosted providers are excluded because their origins can be anything.
 */
export const GIT_PROVIDER_API_ORIGINS = {
  github: 'https://ungh.cc', // via UNGH proxy to avoid rate limits
  bitbucket: 'https://api.bitbucket.org',
  codeberg: 'https://codeberg.org',
  gitee: 'https://gitee.com',
  radicle: 'https://seed.radicle.at',
  pushin: 'https://pushin.eu',
} as const satisfies Partial<Record<ProviderId, string>>

/**
 * All known external API origins that git provider adapters may fetch from.
 * Includes both the per-provider origins and known self-hosted instances.
 */
export const ALL_KNOWN_GIT_API_ORIGINS: readonly string[] = [
  ...Object.values(GIT_PROVIDER_API_ORIGINS),
  ...GITLAB_HOSTS.map(host => `https://${host}`),
  ...FORGEJO_HOSTS.map(host => `https://${host}`),
  ...GITEA_HOSTS.map(host => `https://${host}`),
]

/**
 * validates whether the given host is part of the known hosts of a provider
 */
export function validateHost(provider: ProviderId, host: string) {
  const config = configFor(provider)
  return !!config && matchesHost(config, host)
}
