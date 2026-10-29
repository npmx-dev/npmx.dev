import type { UrlTarget } from 'forges'
import type { ProviderId, RepoRef } from '~~/shared/utils/git-providers'
import { forgeWeb, toForgeRepoRef } from '~~/shared/utils/forges'
import type { MarkdownRepoInfo } from './markdown'

type AccountSyntax = Pick<MarkdownRepoInfo, 'accountChar' | 'keepAccountChar'>

/**
 * How a forge writes an account mention. `forges` reads thread and commit
 * references but has no account syntax, so this stays here.
 */
const ACCOUNT_SYNTAX: Partial<Record<ProviderId, AccountSyntax>> = {
  // Bitbucket has no account page to link to.
  bitbucket: { accountChar: false },
  // Sourcehut writes accounts as `~user`, and the tilde is part of the URL.
  sourcehut: { accountChar: '~', keepAccountChar: true },
}

/**
 * The markdown renderer's view of a repository, built from `forges/web`.
 * `null` when the ref has no web entry (radicle).
 */
export function createRepoInfo(ref: RepoRef, path?: string): MarkdownRepoInfo | null {
  const web = forgeWeb(ref)
  if (!web) return null

  const repo = toForgeRepoRef(ref)
  // A base is the URL of an empty path, without the trailing slash it ends in.
  const base = (target: UrlTarget) => web.urlFor(target)?.replace(/\/$/, '')

  return {
    hostBaseUrl: web.webOrigin ?? '',
    forge: { web, repo },
    blobBaseUrl: base({ file: { repo, path: '', at: 'HEAD' } }) ?? '',
    rawBaseUrl: base({ raw: { repo, path: '', at: 'HEAD' } }) ?? '',
    path,
    ...ACCOUNT_SYNTAX[ref.provider],
  }
}
