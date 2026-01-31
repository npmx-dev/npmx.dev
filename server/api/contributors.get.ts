import type { H3Event } from 'h3'

export interface GitHubContributor {
  login: string
  id: number
  avatar_url: string
  html_url: string
  contributions: number
}

export default defineCachedEventHandler(
  async (_event: H3Event): Promise<GitHubContributor[]> => {
    const response = await fetch(
      'https://api.github.com/repos/npmx-dev/npmx.dev/contributors?per_page=50',
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

    // Filter out bots
    return contributors.filter(c => !c.login.includes('[bot]'))
  },
  {
    maxAge: 3600, // Cache for 1 hour
    name: 'github-contributors',
    getKey: () => 'contributors',
  },
)
