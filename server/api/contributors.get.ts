import sanitize from 'sanitize-html'

export type Role = 'steward' | 'maintainer' | 'contributor'

export interface GitHubUserData {
  name: string | null
  bio: string | null
  company: string | null
  companyHTML: string | null
  location: string | null
  websiteUrl: string | null
  twitterUsername: string | null
  blueskyHandle: string | null
  mastodonUrl: string | null
}

export interface GitHubContributor extends GitHubUserData {
  login: string
  id: number
  avatar_url: string
  html_url: string
  contributions: number
  role: Role
  sponsors_url: string | null
}

/**
 * Raw data coming from the GitHub REST API (/contributors).
 * We exclude 'role', 'sponsors_url' AND all fields that only exist in GraphQL.
 */
type GitHubAPIContributor = Omit<GitHubContributor, 'role' | 'sponsors_url' | keyof GitHubUserData>

// Fallback when no GitHub token is available (e.g. preview environments).
// Only stewards are shown as maintainers; everyone else is a contributor.
const FALLBACK_STEWARDS = new Set(['danielroe', 'patak-cat'])

const DEFAULT_USER_INFO: GitHubUserData = {
  name: null,
  bio: null,
  company: null,
  companyHTML: null,
  location: null,
  websiteUrl: null,
  twitterUsername: null,
  blueskyHandle: null,
  mastodonUrl: null,
}

// Configure sanitize-html for GitHub's companyHTML and company fields
const SANITIZE_HTML_OPTIONS: sanitize.IOptions = {
  allowedTags: ['a', 'span', 'strong', 'em', 'code'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
  },
}

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

/**
 * Sanitizes GitHub HTML to remove XSS vectors while preserving safe formatting.
 * Applies to both rich companyHTML and plain-text company fields.
 */
function sanitizeGitHubHTML(html: string | null): string | null {
  if (!html) return null

  const cleaned = sanitize(html.trim(), SANITIZE_HTML_OPTIONS)
  return cleaned === '' ? null : cleaned
}

/**
 * Handles "undefined" strings, empty values, or purely whitespace strings.
 * Prevents UI issues with empty icons or broken conditional logic.
 */
function cleanString(val: string | null, url = false): string | null {
  if (!val || val === 'undefined' || val.trim() === '') return null
  val = val.trim()
  if (!url) {
    return val
  }
  return val.startsWith('https://') || val.startsWith('http://') ? val : null
}

/**
 * Batch-query GitHub GraphQL API to check which users have sponsors enabled and getting user info.
 * Returns a Set of logins that have a sponsors listing.
 */
async function fetchGitHubUserData(
  token: string,
  logins: string[],
  usersData: Map<string, GitHubUserData>,
): Promise<Set<string>> {
  if (logins.length === 0) return new Set()

  const sponsorable = new Set<string>()
  const chunkSize = 100

  for (let i = 0; i < logins.length; i += chunkSize) {
    const chunk = logins.slice(i, i + chunkSize)

    // Build aliased GraphQL query: user0: user(login: "x") { hasSponsorsListing login }
    const fragments = chunk.map(
      (login, idx) =>
        `user${idx}: user(login: "${login}") { hasSponsorsListing login name bio company companyHTML location websiteUrl twitterUsername socialAccounts(first: 10) { nodes { provider url } } }`,
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
        console.warn(`Failed to fetch sponsors info (chunk ${i}): ${response.status}`)
        continue
      }

      const json = (await response.json()) as {
        data?: Record<
          string,
          | (GitHubUserData & {
              login: string
              hasSponsorsListing: boolean
              socialAccounts: { nodes: { provider: string; url: string }[] }
            })
          | null
        >
      }

      if (json.data) {
        for (const user of Object.values(json.data)) {
          if (!user) continue
          if (user.hasSponsorsListing) {
            sponsorable.add(user.login)
          }

          // Extract Bluesky and Mastodon from socialAccounts
          let blueskyHandle: string | null = null
          let mastodonUrl: string | null = null

          if (user.socialAccounts?.nodes) {
            for (const account of user.socialAccounts.nodes) {
              if (account.url.includes('bsky.app')) {
                // Extract handle from URL: https://bsky.app/profile/handle.bsky.social
                const match = account.url.match(/bsky\.app\/profile\/([^/?]+)/)
                if (match) {
                  blueskyHandle = match[1] as string
                }
              } else if (account.provider === 'MASTODON') {
                mastodonUrl = cleanString(account.url, true)
              }
            }
          }

          // --- SERVER-SIDE SANITIZATION AND BATCHING ---
          usersData.set(user.login, {
            name: cleanString(user.name),
            bio: cleanString(user.bio),
            company: cleanString(user.company),
            // Rich HTML sanitization for company mentions/orgs
            companyHTML: sanitizeGitHubHTML(user.companyHTML),
            location: cleanString(user.location),
            websiteUrl: cleanString(user.websiteUrl, true),
            twitterUsername: cleanString(user.twitterUsername),
            blueskyHandle,
            mastodonUrl,
          })
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch sponsors info (chunk ${i}):`, error)
    }
  }

  return sponsorable
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

    const userData = new Map<string, GitHubUserData>()

    const sponsorable = githubToken
      ? await fetchGitHubUserData(
          githubToken,
          filtered.map(c => c.login),
          userData,
        )
      : new Set<string>()

    return filtered
      .map(c => {
        const { role, order } = getRoleInfo(c.login, teams)
        const userInfo = userData.get(c.login) ?? DEFAULT_USER_INFO
        const sponsors_url = sponsorable.has(c.login)
          ? `https://github.com/sponsors/${c.login}`
          : null

        // Construct the final object with only necessary fields
        return {
          id: c.id,
          login: c.login,
          name: userInfo.name,
          avatar_url: c.avatar_url,
          html_url: c.html_url,
          role,
          bio: userInfo.bio,
          company: userInfo.company,
          companyHTML: userInfo.companyHTML,
          location: userInfo.location,
          websiteUrl: userInfo.websiteUrl,
          twitterUsername: userInfo.twitterUsername,
          blueskyHandle: userInfo.blueskyHandle,
          mastodonUrl: userInfo.mastodonUrl,
          sponsors_url,
          contributions: c.contributions,
          order, // kept for sorting, removed in next step
        }
      })
      .sort((a, b) => a.order - b.order || b.contributions - a.contributions)
      .map(({ order: _, ...rest }) => rest) as GitHubContributor[]
  },
  {
    maxAge: 3600, // Cache for 1 hour
    name: 'github-contributors',
    getKey: () => 'contributors',
  },
)
