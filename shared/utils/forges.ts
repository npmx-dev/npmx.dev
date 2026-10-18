import type { FetchLike, ForgeProvider, RepoRef as ForgeRepoRef, UrlTarget } from 'forges'
import type { RepoRef } from '#shared/utils/git-providers'
import { bitbucket } from 'forges/bitbucket'
import { forgejo } from 'forges/forgejo'
import { gitea } from 'forges/gitea'
import { gitee } from 'forges/gitee'
import { github } from 'forges/github'
import { gitlab } from 'forges/gitlab'
import { pushin } from 'forges/pushin'
import { sourcehut } from 'forges/sourcehut'
import { tangled } from 'forges/tangled'

/**
 * Adapter between npmx's own git provider registry (`git-providers.ts`) and the
 * unified `forges` client.
 *
 * npmx models Codeberg as its own provider, while `forges` treats it as a
 * Forgejo instance; npmx also carries the self-hosted host on the ref rather
 * than on the provider. This module hides both differences.
 */

/** The `forges` instance host for an npmx ref. */
export function forgeInstance(ref: RepoRef): string {
  switch (ref.provider) {
    case 'github':
      return 'github.com'
    case 'bitbucket':
      return 'bitbucket.org'
    case 'gitee':
      return 'gitee.com'
    case 'codeberg':
      return 'codeberg.org'
    case 'gitlab':
      return ref.host ?? 'gitlab.com'
    case 'forgejo':
      return ref.host ?? 'codeberg.org'
    case 'gitea':
      return ref.host ?? 'gitea.com'
    case 'tangled':
      return 'tangled.org'
    default:
      return ref.host ?? ''
  }
}

/** Translate an npmx repo ref into a `forges` repo ref. */
export function toForgeRepoRef(ref: RepoRef): ForgeRepoRef {
  return {
    // Codeberg is a Forgejo instance to `forges`.
    forge: ref.provider === 'codeberg' ? 'forgejo' : ref.provider,
    instance: forgeInstance(ref),
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
 * Builds a `forges` provider for an npmx ref, or `undefined` when `forges` has
 * no provider for it, or when the forge needs a credential npmx does not have.
 *
 * Radicle has no provider, and GitHub repo metadata and Tangled stats are backed
 * by a proxy or a bespoke endpoint. Sourcehut has a provider, but every sr.ht
 * read needs a token, so one is built only when a token is given; `forgeWebProvider`
 * covers the callers that only build URLs.
 */
export function createForgeProvider(
  ref: RepoRef,
  options: ForgeBridgeOptions = {},
): ForgeProvider | undefined {
  const base = { fetch: options.fetch, timeout: options.timeout ?? 15_000 }
  switch (ref.provider) {
    case 'github':
      return options.token
        ? github({ ...base, auth: { type: 'token', token: options.token } })
        : github(base)
    case 'gitlab':
      return gitlab({ ...base, baseUrl: `https://${ref.host ?? 'gitlab.com'}` })
    case 'bitbucket':
      return bitbucket(base)
    case 'codeberg':
      return forgejo({ ...base, baseUrl: 'https://codeberg.org' })
    case 'forgejo':
      return forgejo({ ...base, baseUrl: `https://${ref.host ?? 'codeberg.org'}` })
    case 'gitea':
      return gitea({ ...base, baseUrl: `https://${ref.host ?? 'gitea.com'}` })
    case 'gitee':
      return gitee(base)
    case 'pushin':
      return pushin(base)
    case 'sourcehut':
      return options.token
        ? sourcehut({ ...base, auth: { type: 'token', token: options.token } })
        : undefined
    case 'tangled':
      return tangled(base)
    default:
      return undefined
  }
}

/**
 * A provider for building and reading web URLs, reused across calls.
 *
 * `urlFor()` and `parseUrl()` depend only on the forge and its instance, so one
 * instance per pair is enough and callers can build links in a loop without
 * constructing a provider each time. Callers that make a request build their own
 * with a `fetch` and credentials.
 */
const webProviders = new Map<string, ForgeProvider | undefined>()

export function forgeWebProvider(ref: RepoRef): ForgeProvider | undefined {
  const { forge, instance } = toForgeRepoRef(ref)
  const key = `${forge}:${instance}`
  if (!webProviders.has(key)) {
    // Building a URL needs no credential, and this provider is never asked to
    // make a request, so the empty token sourcehut insists on is never sent.
    webProviders.set(
      key,
      ref.provider === 'sourcehut'
        ? sourcehut({ timeout: 15_000, auth: { type: 'token', token: '' } })
        : createForgeProvider(ref),
    )
  }
  return webProviders.get(key)
}

/**
 * Rewrites a blob or file web URL to the forge's raw file URL, where the forge
 * has one, so a README image points at bytes instead of an HTML page.
 */
export function convertBlobOrFileToRawUrl(url: string, ref: RepoRef): string {
  const provider = forgeWebProvider(ref)
  const parsed = provider?.parseUrl(url)
  const file = parsed?.file
  if (!provider || !parsed || !file) {
    return url
  }
  const target: UrlTarget = {
    raw: { repo: parsed.repo, path: file.path, at: file.at ?? 'HEAD' },
  }
  return provider.urlFor(target) ?? url
}
