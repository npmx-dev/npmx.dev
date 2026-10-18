import type { RepoRef } from '~~/shared/utils/git-providers'
import { forgeWebProvider, toForgeRepoRef } from '~~/shared/utils/forges'

export interface RepoFileUrl {
  raw: string
  blob: string
}

/** The raw and blob URLs of one file, built by `forges`, or `null` where the forge has no such page. */
export function getFileUrls(ref: RepoRef, path: string): RepoFileUrl | null {
  const provider = forgeWebProvider(ref)
  const repo = toForgeRepoRef(ref)
  const raw = provider?.urlFor({ raw: { repo, path, at: 'HEAD' } })
  const blob = provider?.urlFor({ file: { repo, path, at: 'HEAD' } })
  return raw && blob ? { raw, blob } : null
}
