import type { UrlTarget } from 'forges'
import type { ProviderId, RepoRef } from '~~/shared/utils/git-providers'
import { forgeWebProvider, toForgeRepoRef } from '~~/shared/utils/forges'
import type { MarkdownRepoInfo } from './markdown'

type ReferenceQuirks = Pick<
  MarkdownRepoInfo,
  'issueChar' | 'issueRegex' | 'prChar' | 'accountChar' | 'keepAccountChar'
>

/**
 * Reference syntax that the shared model does not carry: the char that marks an
 * issue or pull request, and how accounts are written. Everything else comes
 * from `forges`.
 */
const REFERENCE_QUIRKS: Partial<Record<ProviderId, ReferenceQuirks>> = {
  github: { issueChar: '#', prChar: '#' },
  gitlab: { issueChar: '#', prChar: '!' },
  bitbucket: { prChar: '#', accountChar: false },
  gitee: { issueChar: '#', issueRegex: /\B#[\dA-Z]+\b/gi, prChar: '!' },
  // Sourcehut writes accounts as `~user`. It has no pull-request marker, so
  // `prChar` matches `issueChar` and every `#` reference reads as an issue.
  sourcehut: { issueChar: '#', prChar: '#', accountChar: '~', keepAccountChar: true },
}

const DEFAULT_QUIRKS: ReferenceQuirks = { issueChar: '#', prChar: '#' }

/**
 * The markdown renderer's view of a repository, built from `forges`. `undefined`
 * when `forges` has no provider for the ref (radicle).
 */
export function createRepoInfo(ref: RepoRef, path?: string): MarkdownRepoInfo | null {
  const provider = forgeWebProvider(ref)
  if (!provider) return null

  const repo = toForgeRepoRef(ref)
  // A base is a page URL with its trailing path segment removed, so build the
  // page for a placeholder segment and trim it.
  const base = (target: UrlTarget) => provider.urlFor(target)?.replace(/\/$/, '')
  const threadBase = (kind: 'issue' | 'pull_request') =>
    provider
      .urlFor({
        thread: {
          forge: repo.forge,
          instance: repo.instance,
          repo,
          kind,
          number: '1',
          displayNumber: '1',
        },
      })
      ?.replace(/\/1$/, '')
  // A commit is its own target now, not a thread kind.
  const commitBase = provider.urlFor({ commit: { repo, sha: '1' } })?.replace(/\/1$/, '')

  return {
    hostBaseUrl: provider.webOrigin ?? '',
    blobBaseUrl: base({ file: { repo, path: '', at: 'HEAD' } }) ?? '',
    rawBaseUrl: base({ raw: { repo, path: '', at: 'HEAD' } }) ?? '',
    path,
    commitBaseUrl: commitBase ?? '',
    issueBaseUrl: threadBase('issue'),
    prBaseUrl: threadBase('pull_request'),
    compareBaseUrl: base({ repo, section: 'compare' }),
    ...(REFERENCE_QUIRKS[ref.provider] ?? DEFAULT_QUIRKS),
  }
}
