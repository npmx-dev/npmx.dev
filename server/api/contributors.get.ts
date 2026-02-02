export interface GitHubContributor {
  login: string
  id: number
  avatar_url: string
  html_url: string
  contributions: number
}

export default defineBypassableCachedEventHandler(
  async (): Promise<GitHubContributor[]> => {
    const allContributors: GitHubContributor[] = []
    let page = 1
    const perPage = 100

    while (true) {
      const response = await fetch(
        `https://api.github.com/repos/npmx-dev/npmx.dev/contributors?per_page=${perPage}&page=${page}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'npmx',
          },
        },
      )

      if (!response.ok) {
        throw createError({
          statusCode: response.status,
          message: 'Failed to fetch contributors',
        })
      }

      const contributors = (await response.json()) as GitHubContributor[]

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
    bypassKey: 'contributors',
    getKey: () => 'contributors',
  },
)
