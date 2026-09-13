import type { ChangelogMarkdownInfo, ChangelogInfo } from '~~/shared/types/changelog'
import type { ExtendedPackageJson } from '~~/shared/utils/package-analysis'
import { type RepoRef, parseRepositoryInfo } from '~~/shared/utils/git-providers'
import { type RepoFileUrl, getBaseFileUrl } from './baseFileUrl'
import { FetchError } from 'ofetch'
import { ERROR_CHANGELOG_NOT_FOUND, ERROR_UNGH_API_KEY_EXHAUSTED } from '~~/shared/utils/constants'
import {
  GithubReleaseSchama,
  ForgejoReleaseSchama,
  GitlabReleaseSchame,
} from '~~/shared/schemas/changelog/release'
import { resolveURL } from 'ufo'
import * as v from 'valibot'

type SafeResult<R, E = Error> = [R, null] | [null, E]

/**
 * Detect whether changelogs/releases are available for this package
 *
 * first checks if releases are available and then changelog.md
 */
export async function detectChangelog(pkg: ExtendedPackageJson) {
  const repoRef = parseRepositoryInfo(pkg.repository)
  if (!repoRef) {
    return false
  }

  const directory = typeof pkg.repository === 'object' ? pkg.repository.directory : undefined

  const [releases, releasesError] = await checkReleases(repoRef, directory)
  if (releases) {
    return releases
  }

  const changelog = await checkChangelogFile(repoRef, directory)
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
    case 'codeberg':
    case 'forgejo': {
      return checkLatestForgejoRelease(ref, directory)
    }
    case 'gitlab': {
      return checkLatestGitlabRelease(ref, directory)
    }
  }
  return [false, null]
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

      method: ref.provider != 'tangled' ? 'HEAD' : 'GET', // we just need to know if it exists or not, tangled doesn't support HEAD
    })
      .then(r => r.ok)
      .catch(() => false)
    const owner = ref.provider == 'gitlab' ? encodeURIComponent(ref.owner) : ref.owner
    if (exists) {
      return {
        type: 'md',
        provider: ref.provider,
        path: resolveURL(dir ?? '', fileName),
        repo: `${owner}/${ref.repo}`,
        link: resolveURL(baseUrl.blob, dir ?? '', fileName),
        host: ref.host,
      } satisfies ChangelogMarkdownInfo
    }
  }
  return false
}

// releases

const MD_REGEX = /(?<=\[.*?(changelog|releases|changes|history|news)\.md.*?\]\()(.*?)(?=\))/i
const ROOT_ONLY_REGEX = /^\/?[^/]+$/

async function checkLatestGithubRelease(
  ref: RepoRef,
  directory?: string,
): Promise<SafeResult<ChangelogInfo | false>> {
  try {
    const response = await $fetch(
      `https://ungh.cc/repos/${ref.owner}/${ref.repo}/releases/latest`,
      {
        headers: {
          'User-Agent': 'npmx.dev',
        },
      },
    )

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

// codeberg / forgejo

async function checkLatestForgejoRelease(
  ref: RepoRef,
  directory?: string,
): Promise<SafeResult<ChangelogInfo | false>> {
  try {
    const host = ref.host ?? 'codeberg.org'

    const response = await $fetch(
      `https://${host}/api/v1/repos/${ref.owner}/${ref.repo}/releases/latest`,
      {
        headers: {
          'User-Agent': 'npmx.dev',
          'accept': 'application/json',
        },
      },
    )

    const release = v.parse(ForgejoReleaseSchama, response)

    const matchedChangelog = release.body?.match(MD_REGEX)?.at(0)

    // /src/branch/ can be similar to /blob/
    if (!matchedChangelog || !matchedChangelog.includes('/src/branch/')) {
      return [
        {
          type: 'release',
          link: `https://${host}/${ref.owner}/${ref.repo}/releases`,
          provider: ref.provider,
          repo: `${ref.owner}/${ref.repo}`,
          host: ref.host,
        },
        null,
      ]
    }

    const path = matchedChangelog.replace(/^.*\/src\/branch\/[^/]+\//i, '')
    if (
      directory &&
      !(
        path.startsWith(directory.endsWith('/') ? directory : `${directory}/`) ||
        ROOT_ONLY_REGEX.test(path)
      )
    ) {
      return [false, null] as const
    }
    return [
      {
        provider: ref.provider,
        type: 'md',
        path,
        repo: `${ref.owner}/${ref.repo}`,
        link: matchedChangelog,
        host: ref.host,
      },
      null,
    ]
  } catch (e) {
    if (e instanceof Error) {
      return [null, e]
    }
  }
  return [false, null]
}

// gitlab
async function checkLatestGitlabRelease(
  ref: RepoRef,
  directory?: string,
): Promise<SafeResult<ChangelogInfo | false>> {
  try {
    const host = ref.host ?? 'gitlab.com'
    const repoPath = encodeURIComponent(`${ref.owner}/${ref.repo}`)

    const response = await $fetch(
      `https://${host}/api/v4/projects/${repoPath}/releases/permalink/latest`,
      {
        headers: {
          'User-Agent': 'npmx.dev',
          'accept': 'application/json',
        },
      },
    )
    const release = v.parse(GitlabReleaseSchame, response)

    const matchedChangelog = release.description?.match(MD_REGEX)?.at(0)

    if (!matchedChangelog || !matchedChangelog.includes('/-/blob/')) {
      return [
        {
          type: 'release',
          // I encode both just to be sure
          link: `https://${host}/${ref.owner}/${ref.repo}/-/releases`,
          provider: ref.provider,
          repo: `${encodeURIComponent(ref.owner)}/${ref.repo}`,
          host: ref.host,
        },
        null,
      ]
    }

    const path = matchedChangelog.replace(/^.*\/-\/blob\/[^/]+\//i, '')

    if (
      directory &&
      !(
        path.startsWith(directory.endsWith('/') ? directory : `${directory}/`) ||
        ROOT_ONLY_REGEX.test(path)
      )
    ) {
      return [false, null] as const
    }

    return [
      {
        provider: ref.provider,
        type: 'md',
        path,
        repo: `${encodeURIComponent(ref.owner)}/${ref.repo}`,
        link: matchedChangelog,
        host: ref.host,
      },
      null,
    ]
  } catch (e) {
    if (e instanceof Error) {
      return [null, e]
    }
  }
  return [false, null]
}
