import type { Repository } from '@npm/types'
import { joinURL } from 'ufo'

export type RequestedVersion =
  | SlimPackument['requestedVersion']
  | { repository?: string | Repository }

type UseRepositoryUrlReturn = {
  repositoryUrl: ComputedRef<string | null>
}

export function useRepositoryUrl(
  requestedVersion: MaybeRefOrGetter<RequestedVersion>,
): UseRepositoryUrlReturn {
  const repositoryUrl = computed<string | null>(() => {
    const repo = toValue(requestedVersion)?.repository

    if (typeof repo === 'string') {
      // sometimes repo can be a string due to not being normalized during publishing
      return normalizeGitUrl(repo)
    }

    if (!repo?.url) {
      return null
    }
    let url = normalizeGitUrl(repo.url)
    if (!url) {
      return null
    }

    // append `repository.directory` for monorepo packages
    if (repo.directory) {
      url = joinURL(`${url}/tree/HEAD`, repo.directory)
    }

    return url
  })

  return {
    repositoryUrl,
  }
}
