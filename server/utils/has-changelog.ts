import type { ExtendedPackageJson } from '~~/shared/utils/package-analysis'
import { parseRepoUrl, type RepoRef } from '~~/shared/utils/git-providers'

/**
 * Detect whether changelogs/releases are available for this package
 *
 * first checks if releases are available and then changelog.md
 */
export async function detectHasChangelog(
  pkg: ExtendedPackageJson,
  // packageName: string,
  // version: string,
) {
  if (!pkg.repository?.url) {
    return false
  }

  const repoRef = parseRepoUrl(pkg.repository.url)
  if (!repoRef) {
    return false
  }

  if (await checkReleases(repoRef)) {
    return true
  }

  return null
}

/**
 * check whether releases are being used with this repo
 * @returns true if in use
 */
async function checkReleases(ref: RepoRef): Promise<boolean> {
  const checkUrls = getLatestReleaseUrl(ref)

  for (const checkUrl of checkUrls ?? []) {
    const exists = await fetch(checkUrl, {
      headers: {
        // GitHub API requires User-Agent
        'User-Agent': 'npmx.dev',
      },
      method: 'HEAD', // we just need to know if it exists or not
    })
      .then(r => r.ok)
      .catch(() => false)
    if (exists) {
      return true
    }
  }
  return false
}

/**
 * get the url to check if releases are being used.
 *
 * @returns returns an array so that if providers don't have a latest that we can check for versions
 */
function getLatestReleaseUrl(ref: RepoRef): null | string[] {
  switch (ref.provider) {
    case 'github':
      return [`https://ungh.cc/repos/${ref.owner}/${ref.repo}/releases/latest`]
  }

  return null
}
