import { joinURL } from 'ufo'

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

    // append `repository.directory` for monorepo packages
    if (repo.directory && url) {
      url = joinURL(url.replace(/\.git$/, ''), `/tree/HEAD`, repo.directory)
    }

    return url
  })

  return {
    repositoryUrl,
  }
}
