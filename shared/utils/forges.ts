import type {
  FetchLike,
  ForgeProvider,
  RepoRef as ForgeRepoRef,
  TokenAuth,
  UrlTarget,
} from 'forges'
import type { ForgeWeb, WebOptions } from 'forges/web'
import type { ProviderId, RepoRef } from '#shared/utils/git-providers'
import { bitbucket } from 'forges/bitbucket'
import { forgejo } from 'forges/forgejo'
import { gitea } from 'forges/gitea'
import { gitee } from 'forges/gitee'
import { github } from 'forges/github'
import { gitlab } from 'forges/gitlab'
import { pushin } from 'forges/pushin'
import { sourcehut } from 'forges/sourcehut'
import { tangled } from 'forges/tangled'
import {
  bitbucket as bitbucketWeb,
  forgejo as forgejoWeb,
  gitea as giteaWeb,
  gitee as giteeWeb,
  github as githubWeb,
  gitlab as gitlabWeb,
  pushin as pushinWeb,
  sourcehut as sourcehutWeb,
  tangled as tangledWeb,
} from 'forges/web'

/**
 * Adapter between npmx's own git provider registry (`git-providers.ts`) and the
 * unified `forges` client.
 *
 * npmx models Codeberg as its own provider, while `forges` treats it as a
 * Forgejo instance; npmx also carries the self-hosted host on the ref rather
 * than on the provider. This module hides both differences.
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

/** What `forges` needs to serve one of npmx's providers. */
interface ForgeEntry {
  /** The API base URL of a ref, or omitted for the forge's own default. */
  baseUrl?: (ref: RepoRef) => string
  /** The web links of the same instance, which need no API client or credential. */
  web: (options: WebOptions) => ForgeWeb
  /** The API client, absent where npmx has no credential the forge requires. */
  provider: (base: ForgeBase) => ForgeProvider | undefined
}

/**
 * npmx's providers, and the `forges` entry points each one maps onto. This is the
 * only place that says where a forge lives: `forges` takes the API base URL and
 * derives the website, its raw host and the instance from it, so a self-hosted
 * instance is stated once, as its host.
 */
const FORGES: Partial<Record<ProviderId, ForgeEntry>> = {
  github: {
    web: githubWeb,
    provider: base => github(base),
  },
  gitlab: {
    baseUrl: ref => `https://${ref.host ?? 'gitlab.com'}`,
    web: gitlabWeb,
    provider: base => gitlab(base),
  },
  bitbucket: {
    web: bitbucketWeb,
    provider: base => bitbucket(base),
  },
  // Codeberg is a Forgejo instance.
  codeberg: {
    baseUrl: () => 'https://codeberg.org',
    web: forgejoWeb,
    provider: base => forgejo(base),
  },
  forgejo: {
    baseUrl: ref => `https://${ref.host ?? 'codeberg.org'}`,
    web: forgejoWeb,
    provider: base => forgejo(base),
  },
  gitea: {
    baseUrl: ref => `https://${ref.host ?? 'gitea.com'}`,
    web: giteaWeb,
    provider: base => gitea(base),
  },
  gitee: {
    web: giteeWeb,
    provider: base => gitee(base),
  },
  pushin: {
    web: pushinWeb,
    provider: base => pushin(base),
  },
  sourcehut: {
    web: sourcehutWeb,
    // Every sr.ht read needs a token, so there is no client without one.
    provider: base => (base.auth ? sourcehut({ ...base, auth: base.auth }) : undefined),
  },
  tangled: {
    web: tangledWeb,
    // Tangled takes an app password or an OAuth client, not a token.
    provider: ({ fetch, timeout, baseUrl }) => tangled({ fetch, timeout, baseUrl }),
  },
}

/** The `forges` instance host of an npmx ref. */
export function forgeInstance(ref: RepoRef): string {
  return forgeWeb(ref)?.instance ?? ref.host ?? ''
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
export function createForgeProvider(
  ref: RepoRef,
  options: ForgeBridgeOptions = {},
): ForgeProvider | undefined {
  const entry = FORGES[ref.provider]
  if (!entry) {
    return undefined
  }
  return entry.provider({
    fetch: options.fetch,
    timeout: options.timeout ?? 15_000,
    baseUrl: entry.baseUrl?.(ref),
    ...(options.token ? { auth: { type: 'token' as const, token: options.token } } : {}),
  })
}

/**
 * The web links of an npmx ref, or `undefined` when the ref has no entry
 * (radicle). Building and reading a URL needs no API client and no credentials,
 * which is why this is separate from {@link createForgeProvider}.
 */
export function forgeWeb(ref: RepoRef): ForgeWeb | undefined {
  const entry = FORGES[ref.provider]
  return entry?.web({ baseUrl: entry.baseUrl?.(ref) })
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
    raw: { repo: parsed.repo, path: file.path, at: file.at ?? 'HEAD' },
  }
  return web.urlFor(target) ?? url
}
