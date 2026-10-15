import type { FetchLike, ForgeProvider, RepoRef as ForgeRepoRef, UrlTarget } from 'forges'
import type { RepoRef } from '#shared/utils/git-providers'
import { bitbucketLite } from 'forges/bitbucket'
import { forgejoLite } from 'forges/forgejo'
import { giteaLite } from 'forges/gitea'
import { giteeLite } from 'forges/gitee'
import { githubLite } from 'forges/github'
import { gitlabLite } from 'forges/gitlab'
import { pushin } from 'forges/pushin'
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
 * no provider for it (Sourcehut, Radicle, and the forges npmx backs with a
 * proxy or a bespoke endpoint: GitHub repo metadata and Tangled stats).
 */
export function createForgeProvider(
  ref: RepoRef,
  options: ForgeBridgeOptions = {},
): ForgeProvider | undefined {
  const base = { fetch: options.fetch, timeout: options.timeout ?? 15_000 }
  switch (ref.provider) {
    case 'github':
      return (
        options.token
          ? githubLite({ ...base, auth: { type: 'token', token: options.token } })
          : githubLite(base)
      ).create()
    case 'gitlab':
      return gitlabLite({ ...base, baseUrl: `https://${ref.host ?? 'gitlab.com'}` }).create()
    case 'bitbucket':
      return bitbucketLite(base).create()
    case 'codeberg':
      return forgejoLite({ ...base, baseUrl: 'https://codeberg.org' }).create()
    case 'forgejo':
      return forgejoLite({ ...base, baseUrl: `https://${ref.host ?? 'codeberg.org'}` }).create()
    case 'gitea':
      return giteaLite({ ...base, baseUrl: `https://${ref.host ?? 'gitea.com'}` }).create()
    case 'gitee':
      return giteeLite(base).create()
    case 'pushin':
      return pushin(base).create()
    case 'tangled':
      return tangled(base).create()
    default:
      return undefined
  }
}

/**
 * Rewrites a blob or file web URL to the forge's raw file URL, where the forge
 * has one, so a README image points at bytes instead of an HTML page.
 */
export function convertBlobOrFileToRawUrl(url: string, ref: RepoRef): string {
  const provider = createForgeProvider(ref)
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
