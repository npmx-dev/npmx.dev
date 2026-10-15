import type { RepoRef } from '~~/shared/utils/git-providers'
import { createForgeProvider, toForgeRepoRef } from '~~/shared/utils/forges'
import { resolveURL } from 'ufo'

export interface RepoFileUrl {
  raw: string
  blob: string
}

/**
 * The raw and blob URLs of one file, built by `forges` for every provider it
 * covers. Sourcehut has no `forges` provider, so its URLs stay hand-written.
 */
export function getFileUrls(ref: RepoRef, path: string): RepoFileUrl | null {
  if (ref.provider === 'sourcehut') {
    const base = `https://git.sr.ht/${ref.owner}/${ref.repo}`
    return {
      raw: resolveURL(`${base}/blob/HEAD`, path),
      blob: resolveURL(`${base}/tree/HEAD/item`, path),
    }
  }

  const provider = createForgeProvider(ref)
  const repo = toForgeRepoRef(ref)
  const raw = provider?.urlFor({ raw: { repo, path, at: 'HEAD' } })
  const blob = provider?.urlFor({ file: { repo, path, at: 'HEAD' } })
  return raw && blob ? { raw, blob } : null
}
