export interface GitHubContributor {
  login: string
  id: number
  avatar_url: string
  html_url: string
  contributions: number
}

export default defineCachedEventHandler(
  async (): Promise<GitHubContributor[]> => {
    const allContributors: GitHubContributor[] = []
    let page = 1
    const perPage = 100

    while (true) {
      let contributors: GitHubContributor[]
      try {
        contributors = await $fetch<GitHubContributor[]>(
          `https://api.github.com/repos/npmx-dev/npmx.dev/contributors?per_page=${perPage}&page=${page}`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'npmx',
            },
          },
        )
      } catch (error: unknown) {
        const fetchError = error as { response?: { status?: number } }
        throw createError({
          statusCode: fetchError.response?.status ?? 502,
          message: 'Failed to fetch contributors',
        })
      }

      if (contributors.length === 0) {
        break
      }

      allContributors.push(...contributors)

      // If we got fewer than perPage results, we've reached the end
      if (contributors.length < perPage) {
        break
      }

      page++
    }

    // Filter out bots
    return allContributors.filter(c => !c.login.includes('[bot]'))
  },
  {
    maxAge: 3600, // Cache for 1 hour
    name: 'github-contributors',
    getKey: () => 'contributors',
  },
)
