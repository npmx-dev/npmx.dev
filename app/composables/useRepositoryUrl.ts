import { joinURL } from 'ufo'

function normalizeGitUrl(url: string): string {
  return url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .replace(/^ssh:\/\/git@github\.com/, 'https://github.com')
    .replace(/^git@github\.com:/, 'https://github.com/')
}

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
    if (repo.directory) {
      url = joinURL(`${url}/tree/HEAD`, repo.directory)
    }

    return url
  })

  return {
    repositoryUrl,
  }
}
