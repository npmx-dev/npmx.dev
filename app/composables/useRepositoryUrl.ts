import { joinURL, withoutTrailingSlash } from 'ufo'

type RequestedVersion = SlimPackument['requestedVersion'] | null

type UseRepositoryUrlReturn = {
  repositoryUrl: ComputedRef<string | null>
}

export function useRepositoryUrl(
  requestedVersion: MaybeRefOrGetter<RequestedVersion>,
): UseRepositoryUrlReturn {
  const repositoryUrl = computed<string | null>(() => {
    const repo = toValue(requestedVersion)?.repository

    if (!repo?.url) {
      return null
    }

    let url = normalizeGitUrl(repo.url)
    if (!url) {
      return null
    }

    // Fix: Strip trailing .git (and any leftovers) before constructing the directory link
    url = url.replace(/\.git\/?$/, '')

    if (repo.directory) {
      url = joinURL(`${withoutTrailingSlash(url)}/tree/HEAD`, repo.directory)
    }

    return url
  })

  return {
    repositoryUrl,
  }
}
