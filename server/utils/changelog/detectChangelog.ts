import type { ChangelogMarkdownInfo, ChangelogInfo } from '~~/shared/types/changelog'
import type { ExtendedPackageJson } from '~~/shared/utils/package-analysis'
import { type RepoRef, parseRepositoryInfo } from '~~/shared/utils/git-providers'
import { getFileUrls } from './baseFileUrl'
import { FetchError } from 'ofetch'
import { ERROR_CHANGELOG_NOT_FOUND, ERROR_UNGH_API_KEY_EXHAUSTED } from '~~/shared/utils/constants'
import { GithubReleaseSchama } from '~~/shared/schemas/changelog/release'
import { createForgeProvider, toForgeRepoRef } from '~~/shared/utils/forges'
import { resolveURL } from 'ufo'
import * as v from 'valibot'

type SafeResult<R, E = Error> = [R, null] | [null, E]

const TIMEOUT = 15_000

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

  const { directory } = repoRef

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
  try {
    // GitHub is read through ungh; every other forge goes through `forges`, which
    // answers `false` for the forges that have no releases.
    return [
      ref.provider === 'github'
        ? await checkLatestGithubRelease(ref, directory)
        : await checkLatestRelease(ref, directory),
      null,
    ]
  } catch (error) {
    if (error instanceof Error) {
      return [null, error]
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

const checkChangelogFile = defineCachedFunction(
  async function (ref: RepoRef, directory?: string): Promise<ChangelogMarkdownInfo | false> {
    if (directory) {
      const inDir = await checkFiles(ref, directory)
      if (inDir) {
        return inDir
      }
    }
    return checkFiles(ref)
  },
  {
    swr: true,
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    staleMaxAge: CACHE_MAX_AGE_ONE_MINUTE * 30,
    name: 'checkChangelogFile:v1',
    shouldBypassCache: () => import.meta.dev,
    getKey: (ref, directory) => {
      const base = [ref.provider, ref.host ?? '', ref.owner, ref.repo]
      if (directory) {
        base.push(directory.replaceAll('/', '_'))
      }
      return base.join(':')
    },
  },
)

async function checkFiles(ref: RepoRef, dir?: string) {
  for (const fileName of CHANGELOG_FILENAMES) {
    const path = resolveURL(dir ?? '', fileName)
    const urls = getFileUrls(ref, path)
    if (!urls) {
      return false
    }

    const exists = await $fetch(urls.raw, {
      headers: {
        // GitHub API requires User-Agent
        'User-Agent': 'npmx.dev',
      },
      timeout: TIMEOUT,
      method: ref.provider != 'tangled' ? 'HEAD' : 'GET', // we just need to know if it exists or not, tangled doesn't support HEAD
    })
      .then(() => true)
      .catch(e => {
        if (e instanceof FetchError) {
          // early throw in case the providers is having troubles, is rate limiting us or doesn't allow us
          // in case of not being available or timeout we also early return as the provider might struggle
          if (e.statusCode == null || e.statusCode >= 500) {
            throw e
          }
          switch (e.statusCode) {
            case 401:
            case 403:
            case 429:
            case undefined:
            case null:
              throw e
          }
        }

        return false
      })
    if (exists) {
      const owner = ref.provider == 'gitlab' ? encodeURIComponent(ref.owner) : ref.owner
      return {
        type: 'md',
        provider: ref.provider,
        path,
        repo: `${owner}/${ref.repo}`,
        link: urls.blob,
        host: ref.host,
      } satisfies ChangelogMarkdownInfo
    }
  }
  return false
}

// releases

const CACHE_OPTIONS_CHECK_RELEASE: Parameters<
  typeof defineCachedFunction<any, [ref: RepoRef, directory?: string | undefined]>
>[1] = {
  swr: true,
  maxAge: CACHE_MAX_AGE_ONE_HOUR,
  staleMaxAge: CACHE_MAX_AGE_ONE_MINUTE * 30,
  group: 'changelog:checkLatestRelease:v1',
  // name is defined at the function as the provider
  shouldBypassCache: () => import.meta.dev,
  getKey: (ref, directory) => {
    const base = [ref.provider, ref.host ?? '', ref.owner, ref.repo]
    if (directory) {
      base.push(directory.replaceAll('/', '_'))
    }
    return base.join(':')
  },
}

const MD_REGEX = /(?<=\[.*?(changelog|releases|changes|history|news)\.md.*?\]\()(.*?)(?=\))/i
const ROOT_ONLY_REGEX = /^\/?[^/]+$/

// this function doesn't use `defineCachedFunction` due to ungh also caching the results from github and I don't want to many cache layers
// TODO(serhalp): refactor to use `forges` once it can read GitHub through ungh.
async function checkLatestGithubRelease(
  ref: RepoRef,
  directory?: string,
): Promise<ChangelogInfo | false> {
  try {
    const response = await $fetch(
      `https://ungh.cc/repos/${ref.owner}/${ref.repo}/releases/latest`,
      {
        headers: {
          'User-Agent': 'npmx.dev',
        },
        timeout: TIMEOUT,
      },
    )

    const { release } = v.parse(v.object({ release: GithubReleaseSchama }), response)

    const matchedChangelog = release.markdown?.match(MD_REGEX)?.at(0)

    // if no changelog.md or the url doesn't contain /blob/
    if (!matchedChangelog || !matchedChangelog.includes('/blob/')) {
      return {
        provider: ref.provider,
        type: 'release',
        repo: `${ref.owner}/${ref.repo}`,
        link: `https://github.com/${ref.owner}/${ref.repo}/releases`,
      }
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
      return false
    }
    return {
      provider: ref.provider,
      type: 'md',
      path,
      repo: `${ref.owner}/${ref.repo}`,
      link: matchedChangelog,
    }
  } catch (e) {
    if (!(e instanceof Error)) {
      // shouldn't be reachable, but is here for type safety
      return false
    }
    if (e instanceof FetchError) {
      if (e.statusCode == 404) {
        return false
      }
      if (e.statusCode === 403 || e.statusCode === 429) {
        throw createError({
          statusCode: 502,
          statusMessage: ERROR_UNGH_API_KEY_EXHAUSTED,
        })
      }
    }
    console.error('[checkLatestGithubRelease] unexpected error: ', e)
    throw e
  }
}

// Every forge `forges` can read releases for, via its own capability check.

const checkLatestRelease = defineCachedFunction(
  async function (ref: RepoRef, directory?: string): Promise<ChangelogInfo | false> {
    const provider = createForgeProvider(ref)
    if (!provider?.can('releases.latest')) {
      return false
    }

    const release = await provider.releases.latest(toForgeRepoRef(ref))
    if (!release) {
      return false
    }

    const matchedChangelog = release.body?.match(MD_REGEX)?.at(0)
    // `parseUrl` reads the file path from the link, so no per-forge URL pattern is needed.
    const file = matchedChangelog ? provider.parseUrl(matchedChangelog)?.file : undefined

    if (!matchedChangelog || !file) {
      return {
        provider: ref.provider,
        type: 'release',
        repo: `${ref.owner}/${ref.repo}`,
        link: provider.urlFor({ repo: toForgeRepoRef(ref), section: 'releases' }) ?? '',
        host: ref.host,
      }
    }

    // Makes sure that the correct directory is matched.
    if (
      directory &&
      !(
        file.path.startsWith(directory.endsWith('/') ? directory : `${directory}/`) ||
        ROOT_ONLY_REGEX.test(file.path)
      )
    ) {
      return false
    }

    return {
      provider: ref.provider,
      type: 'md',
      path: file.path,
      repo: `${ref.owner}/${ref.repo}`,
      link: matchedChangelog,
      host: ref.host,
    }
  },
  {
    name: 'forges',
    ...CACHE_OPTIONS_CHECK_RELEASE,
  },
)
