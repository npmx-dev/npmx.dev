import type { ChangelogMarkdownInfo, ChangelogInfo } from '~~/shared/types/changelog'
import { FetchError } from 'ofetch'
import type { ExtendedPackageJson } from '~~/shared/utils/package-analysis'
import { type RepoRef, parseRepoUrl } from '~~/shared/utils/git-providers'
import { ERROR_CHANGELOG_NOT_FOUND, ERROR_UNGH_API_KEY_EXHAUSTED } from '~~/shared/utils/constants'
import { GithubReleaseSchama } from '~~/shared/schemas/changelog/release'
import { resolveURL } from 'ufo'
import * as v from 'valibot'

type SafeResult<R, E = Error> = [R, null] | [null, E]

/**
 * Detect whether changelogs/releases are available for this package
 *
 * first checks if releases are available and then changelog.md
 */
export async function detectChangelog(pkg: ExtendedPackageJson) {
  if (!pkg.repository?.url) {
    return false
  }

  const repoRef = parseRepoUrl(pkg.repository.url)
  if (!repoRef) {
    return false
  }

  const [releases, releasesError] = await checkReleases(repoRef, pkg.repository.directory)
  if (releases) {
    return releases
  }

  const changelog = await checkChangelogFile(repoRef, pkg.repository.directory)
  if (changelog) {
    return changelog
  }

  if (releasesError) {
    throw releasesError
  }

  throw createError({
    statusCode: 404,
    statusMessage: ERROR_CHANGELOG_NOT_FOUND,
  })
}

/**
 * check whether releases are being used with this repo
 * @returns true if in use, false if not in use or an NuxtError in case of ungh's api keys being exhausted
 */
async function checkReleases(
  ref: RepoRef,
  directory?: string,
): Promise<SafeResult<ChangelogInfo | false>> {
  switch (ref.provider) {
    case 'github': {
      return checkLatestGithubRelease(ref, directory)
    }
  }
  return [false, null]
}

/// releases

const MD_REGEX = /(?<=\[.*?(changelog|releases|changes|history|news)\.md.*?\]\()(.*?)(?=\))/i
const ROOT_ONLY_REGEX = /^\/[^/]+$/

async function checkLatestGithubRelease(
  ref: RepoRef,
  directory?: string,
): Promise<SafeResult<ChangelogInfo | false>> {
  try {
    const response = await $fetch(`https://ungh.cc/repos/${ref.owner}/${ref.repo}/releases/latest`)

    const { release } = v.parse(v.object({ release: GithubReleaseSchama }), response)

    const matchedChangelog = release.markdown?.match(MD_REGEX)?.at(0)

    // if no changelog.md or the url doesn't contain /blob/
    if (!matchedChangelog || !matchedChangelog.includes('/blob/')) {
      return [
        {
          provider: ref.provider,
          type: 'release',
          repo: `${ref.owner}/${ref.repo}`,
          link: `https://github.com/${ref.owner}/${ref.repo}/releases`,
        },
        null,
      ]
    }

    const path = matchedChangelog.replace(/^.*\/blob\/[^/]+\//i, '')

    // makes sure that the correct directory is matched
    if (
      directory &&
      !(
        path.startsWith(directory.endsWith('/') ? directory : `${directory}/`) ||
        ROOT_ONLY_REGEX.test(path)
      )
    ) {
      return [false, null]
    }
    return [
      {
        provider: ref.provider,
        type: 'md',
        path,
        repo: `${ref.owner}/${ref.repo}`,
        link: matchedChangelog,
      },
      null,
    ]
  } catch (e) {
    if (!(e instanceof Error)) {
      // shouldn't be reachable, but is here for type safety
      return [false, null]
    }
    if (e instanceof FetchError) {
      if (e.statusCode == 404) {
        return [false, null]
      }
      if (e.statusCode === 403 || e.statusCode === 429) {
        return [
          null,
          createError({
            statusCode: 502,
            statusMessage: ERROR_UNGH_API_KEY_EXHAUSTED,
          }),
        ]
      }
    }
    console.error('[checkLatestGithubRelease] unexpected error: ', e)
    return [null, e]
  }
}

/// changelog markdown

const EXTENSIONS = ['.md', ''] as const

const CHANGELOG_FILENAMES = ['changelog', 'releases', 'changes', 'history', 'news']
  .map(fileName => {
    const fileNameUpperCase = fileName.toUpperCase()
    return EXTENSIONS.map(ext => [`${fileNameUpperCase}${ext}`, `${fileName}${ext}`])
  })
  .flat(3)

async function checkChangelogFile(
  ref: RepoRef,
  directory?: string,
): Promise<ChangelogMarkdownInfo | false> {
  const baseUrl = getBaseFileUrl(ref)
  if (!baseUrl) {
    return false
  }

  if (directory) {
    const inDir = await checkFiles(ref, baseUrl, directory)
    if (inDir) {
      return inDir
    }
  }
  return checkFiles(ref, baseUrl)
}

async function checkFiles(ref: RepoRef, baseUrl: RepoFileUrl, dir?: string) {
  for (const fileName of CHANGELOG_FILENAMES) {
    const exists = await fetch(resolveURL(baseUrl.raw, dir ?? '', fileName), {
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
        path: resolveURL(dir ?? '', fileName),
        repo: `${ref.owner}/${ref.repo}`,
        link: resolveURL(baseUrl.blob, dir ?? '', fileName),
      } satisfies ChangelogMarkdownInfo
    }
  }
  return false
}

interface RepoFileUrl {
  raw: string
  blob: string
}

function getBaseFileUrl(ref: RepoRef): RepoFileUrl | null {
  switch (ref.provider) {
    case 'github':
      return {
        raw: `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/HEAD`,
        blob: `https://github.com/${ref.owner}/${ref.repo}/blob/HEAD`,
      }
  }
  return null
}
