import type { ChangelogReleaseInfo, ChangelogMarkdownInfo } from '~~/shared/types/changelog'
import { ERROR_CHANGELOG_NOT_FOUND } from '~~/shared/utils/constants'
import { type RepoRef, parseRepoUrl } from '~~/shared/utils/git-providers'
import type { ExtendedPackageJson } from '~~/shared/utils/package-analysis'
// ChangelogInfo

/**
 * Detect whether changelogs/releases are available for this package
 *
 * first checks if releases are available and then changelog.md
 */
export async function detectChangelog(
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

  const changelog = (await checkReleases(repoRef)) || (await checkChangelogFile(repoRef))

  if (changelog) {
    return changelog
  }

  throw createError({
    statusCode: 404,
    statusMessage: ERROR_CHANGELOG_NOT_FOUND,
  })
}

/**
 * check whether releases are being used with this repo
 * @returns true if in use
 */
async function checkReleases(ref: RepoRef): Promise<ChangelogReleaseInfo | false> {
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
      return {
        provider: ref.provider,
        type: 'release',
        repo: `${ref.owner}/${ref.repo}`,
      }
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

const EXTENSIONS = ['.md', ''] as const

const CHANGELOG_FILENAMES = ['changelog', 'releases', 'changes', 'history', 'news']
  .map(fileName => {
    const fileNameUpperCase = fileName.toUpperCase()
    return EXTENSIONS.map(ext => [`${fileNameUpperCase}${ext}`, `${fileName}${ext}`])
  })
  .flat(3)

async function checkChangelogFile(ref: RepoRef): Promise<ChangelogMarkdownInfo | false> {
  const baseUrl = getBaseFileUrl(ref)
  if (!baseUrl) {
    return false
  }

  for (const fileName of CHANGELOG_FILENAMES) {
    const exists = await fetch(`${baseUrl}/${fileName}`, {
      headers: {
        // GitHub API requires User-Agent
        'User-Agent': 'npmx.dev',
      },
      method: 'HEAD', // we just need to know if it exists or not
    })
      .then(r => r.ok)
      .catch(() => false)
    if (exists) {
      return {
        type: 'md',
        provider: ref.provider,
        path: fileName,
        repo: `${ref.owner}/${ref.repo}`,
      } satisfies ChangelogMarkdownInfo
    }
  }
  return false
}

function getBaseFileUrl(ref: RepoRef) {
  switch (ref.provider) {
    case 'github':
      return `https://ungh.cc/repos/${ref.owner}/${ref.repo}/files/HEAD`
  }
  return null
}
