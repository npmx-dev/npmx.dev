export type Role = 'steward' | 'maintainer' | 'contributor'

export interface SocialAccount {
  provider: string
  url: string
}

export interface GitHubContributor {
  login: string
  id: number
  avatar_url: string
  html_url: string
  contributions: number
  role: Role
  sponsors_url: string | null
  bio: string | null
  twitterUsername: string | null
  socialAccounts: SocialAccount[]
}

type GitHubAPIContributor = Omit<GitHubContributor, 'role' | 'sponsors_url' | 'bio' | 'twitterUsername' | 'socialAccounts'>

// Fallback when no GitHub token is available (e.g. preview environments).
// Only stewards are shown as maintainers; everyone else is a contributor.
const FALLBACK_STEWARDS = new Set(['danielroe', 'patak-cat'])

interface TeamMembers {
  steward: Set<string>
  maintainer: Set<string>
}

async function fetchTeamMembers(token: string): Promise<TeamMembers | null> {
  const teams: Record<keyof TeamMembers, string> = {
    steward: 'stewards',
    maintainer: 'maintainers',
  }

  try {
    const result: TeamMembers = { steward: new Set(), maintainer: new Set() }

    for (const [role, slug] of Object.entries(teams) as [keyof TeamMembers, string][]) {
      const response = await fetch(
        `https://api.github.com/orgs/npmx-dev/teams/${slug}/members?per_page=100`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'npmx',
          },
        },
      )

      if (!response.ok) {
        console.warn(`Failed to fetch ${slug} team members: ${response.status}`)
        return null
      }

      const members = (await response.json()) as { login: string }[]
      for (const member of members) {
        result[role].add(member.login)
      }
    }

    return result
  } catch (error) {
    console.warn('Failed to fetch team members from GitHub:', error)
    return null
  }
}

interface GovernanceProfile {
  hasSponsorsListing: boolean
  bio: string | null
  twitterUsername: string | null
  socialAccounts: SocialAccount[]
}

/**
 * Batch-query GitHub GraphQL API to fetch profile data for governance members.
 * Returns bio, social accounts, and sponsors listing status.
 */
async function fetchGovernanceProfiles(
  token: string,
  logins: string[],
): Promise<Map<string, GovernanceProfile>> {
  if (logins.length === 0) return new Map()

  const fragments = logins.map(
    (login, i) => `user${i}: user(login: "${login}") {
      login
      hasSponsorsListing
      bio
      twitterUsername
      socialAccounts(first: 10) { nodes { provider url } }
    }`,
  )
  const query = `{ ${fragments.join('\n')} }`

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'npmx',
      },
      body: JSON.stringify({ query }),
    })

    if (!response.ok) {
      console.warn(`Failed to fetch governance profiles: ${response.status}`)
      return new Map()
    }

    const json = (await response.json()) as {
      data?: Record<string, {
        login: string
        hasSponsorsListing: boolean
        bio: string | null
        twitterUsername: string | null
        socialAccounts: { nodes: { provider: string; url: string }[] }
      } | null>
    }

    const profiles = new Map<string, GovernanceProfile>()
    if (json.data) {
      for (const user of Object.values(json.data)) {
        if (user) {
          profiles.set(user.login, {
            hasSponsorsListing: user.hasSponsorsListing,
            bio: user.bio,
            twitterUsername: user.twitterUsername,
            socialAccounts: user.socialAccounts.nodes.map(n => ({
              provider: n.provider,
              url: n.url,
            })),
          })
        }
      }
    }
    return profiles
  } catch (error) {
    console.warn('Failed to fetch governance profiles:', error)
    return new Map()
  }
}

function getRoleInfo(login: string, teams: TeamMembers): { role: Role; order: number } {
  if (teams.steward.has(login)) return { role: 'steward', order: 0 }
  if (teams.maintainer.has(login)) return { role: 'maintainer', order: 1 }
  return { role: 'contributor', order: 2 }
}

export default defineCachedEventHandler(
  async (): Promise<GitHubContributor[]> => {
    const githubToken = useRuntimeConfig().github.orgToken

    // Fetch team members dynamically if token is available, otherwise use fallback
    const teams: TeamMembers = await (async () => {
      if (githubToken) {
        const fetched = await fetchTeamMembers(githubToken)
        if (fetched) return fetched
      }
      return { steward: FALLBACK_STEWARDS, maintainer: new Set<string>() }
    })()

    const allContributors: GitHubAPIContributor[] = []
    let page = 1
    const perPage = 100

    while (true) {
      const response = await fetch(
        `https://api.github.com/repos/npmx-dev/npmx.dev/contributors?per_page=${perPage}&page=${page}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'npmx',
            ...(githubToken && { Authorization: `Bearer ${githubToken}` }),
          },
        },
      )

      if (!response.ok) {
        throw createError({
          statusCode: response.status,
          message: 'Failed to fetch contributors',
        })
      }

      const contributors = (await response.json()) as GitHubAPIContributor[]

      if (contributors.length === 0) {
        break
      }

      allContributors.push(...contributors)

      if (contributors.length < perPage) {
        break
      }

      page++
    }

    const filtered = allContributors.filter(c => !c.login.includes('[bot]'))

    // Identify maintainers (stewards + maintainers) and check their sponsors status
    const maintainerLogins = filtered
      .filter(c => teams.steward.has(c.login) || teams.maintainer.has(c.login))
      .map(c => c.login)

    const governanceProfiles = githubToken
      ? await fetchGovernanceProfiles(githubToken, maintainerLogins)
      : new Map<string, GovernanceProfile>()

    return filtered
      .map(c => {
        const { role, order } = getRoleInfo(c.login, teams)
        const profile = governanceProfiles.get(c.login)
        const sponsors_url = profile?.hasSponsorsListing
          ? `https://github.com/sponsors/${c.login}`
          : null
        const bio = profile?.bio ?? null
        const twitterUsername = profile?.twitterUsername ?? null
        const socialAccounts = profile?.socialAccounts ?? []
        Object.assign(c, { role, order, sponsors_url, bio, twitterUsername, socialAccounts })
        return c as GitHubContributor & { order: number }
      })
      .sort((a, b) => a.order - b.order || b.contributions - a.contributions)
      .map(({ order: _, ...rest }) => rest)
  },
  {
    maxAge: 3600, // Cache for 1 hour
    name: 'github-contributors',
    getKey: () => 'contributors',
  },
)
