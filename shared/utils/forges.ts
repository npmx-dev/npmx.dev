import type {
  FetchLike,
  ForgeProvider,
  RepoRef as ForgeRepoRef,
  TokenAuth,
  UrlTarget,
} from 'forges'
import type { ForgeWeb } from 'forges/web'
import {
  instanceBaseUrl,
  providerWeb,
  type ProviderId,
  type RepoRef,
} from '#shared/utils/git-providers'

/**
 * Adapter between npmx's own git provider registry (`git-providers.ts`) and the
 * unified `forges` client.
 *
 * The registry holds the provider ids, hosts and web links. This module only
 * says which `forges` API client serves each provider: Codeberg is a Forgejo
 * instance, and not every forge has a client npmx can use.
 */

/** The options npmx passes to a `forges` factory. */
interface ForgeBase {
  /** A `fetch` to route through, for example npmx's stale-while-revalidate cache. */
  fetch?: FetchLike
  /** Request timeout in milliseconds. */
  timeout?: number
  /** The API base URL. `forges` derives the website, its raw host and the instance from it. */
  baseUrl?: string
  /** Credentials. npmx only has a GitHub token today. */
  auth?: TokenAuth
}

/**
 * The `forges` API client for each provider npmx can read without extra setup.
 * Each client is imported on first use: together they are ~140 KB gzipped, and
 * the browser only ever needs the one forge of the repo on screen.
 */
const PROVIDER_FACTORIES: Partial<
  Record<ProviderId, (base: ForgeBase) => Promise<ForgeProvider | undefined>>
> = {
  github: async base => (await import('forges/github')).github(base),
  gitlab: async base => (await import('forges/gitlab')).gitlab(base),
  bitbucket: async base => (await import('forges/bitbucket')).bitbucket(base),
  // Codeberg is a Forgejo instance.
  codeberg: async base => (await import('forges/forgejo')).forgejo(base),
  forgejo: async base => (await import('forges/forgejo')).forgejo(base),
  gitea: async base => (await import('forges/gitea')).gitea(base),
  gitee: async base => (await import('forges/gitee')).gitee(base),
  pushin: async base => (await import('forges/pushin')).pushin(base),
  // Every sr.ht read needs a token, so there is no client without one.
  sourcehut: async base =>
    base.auth
      ? (await import('forges/sourcehut')).sourcehut({ ...base, auth: base.auth })
      : undefined,
  // Tangled takes an app password or an OAuth client, not a token.
  tangled: async ({ fetch, timeout, baseUrl }) =>
    (await import('forges/tangled')).tangled({ fetch, timeout, baseUrl }),
}

/** Translate an npmx repo ref into a `forges` repo ref. */
export function toForgeRepoRef(ref: RepoRef): ForgeRepoRef {
  const web = forgeWeb(ref)
  return {
    forge: web?.forge ?? ref.provider,
    instance: web?.instance ?? ref.host ?? '',
    owner: ref.owner,
    name: ref.repo,
  }
}

/** Options for {@link createForgeProvider}. */
export interface ForgeBridgeOptions {
  /** A `fetch` to route through, for example npmx's stale-while-revalidate cache. */
  fetch?: FetchLike
  /** Credentials for the forge. npmx only has a GitHub token today. */
  token?: string
  /**
   * Request timeout in milliseconds.
   * @default 15000
   */
  timeout?: number
}

/**
 * Builds a `forges` provider for an npmx ref, or `undefined` when there is none:
 * radicle has no entry, and Sourcehut needs a token npmx does not have.
 */
export async function createForgeProvider(
  ref: RepoRef,
  options: ForgeBridgeOptions = {},
): Promise<ForgeProvider | undefined> {
  const factory = PROVIDER_FACTORIES[ref.provider]
  if (!factory) {
    return undefined
  }
  return factory({
    fetch: options.fetch,
    timeout: options.timeout ?? 15_000,
    baseUrl: instanceBaseUrl(ref),
    ...(options.token ? { auth: { type: 'token' as const, token: options.token } } : {}),
  })
}

/**
 * The web links of an npmx ref, or `undefined` when the ref has no entry
 * (radicle). Building and reading a URL needs no API client and no credentials,
 * which is why this is separate from {@link createForgeProvider}.
 */
export function forgeWeb(ref: RepoRef): ForgeWeb | undefined {
  return providerWeb(ref.provider)?.({ baseUrl: instanceBaseUrl(ref) })
}

/**
 * Rewrites a blob or file web URL to the forge's raw file URL, where the forge
 * has one, so a README image points at bytes instead of an HTML page.
 */
export function convertBlobOrFileToRawUrl(url: string, ref: RepoRef): string {
  const web = forgeWeb(ref)
  const parsed = web?.parseUrl(url)
  const file = parsed?.file
  if (!web || !parsed || !file) {
    return url
  }
  const target: UrlTarget = {
    raw: { repo: parsed.repo, path: file.path, at: file.at },
  }
  return web.urlFor(target) ?? url
}
