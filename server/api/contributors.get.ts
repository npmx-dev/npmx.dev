import type { ForgeProvider, RepoRef as ForgeRepoRef } from 'forges'
import type { RepoRef } from '~~/shared/utils/git-providers'
import { createForgeProvider, toForgeRepoRef } from '~~/shared/utils/forges'

export type Role = 'steward' | 'maintainer' | 'contributor' | 'core'

export interface GitHubContributor {
  login: string
  id: number
  avatar_url: string
  html_url: string
  contributions: number
  role: Role
  sponsors_url: string | null
}

// Fallback when no GitHub token is available (e.g. preview environments).
// Only stewards are shown as maintainers; everyone else is a contributor.
const FALLBACK_STEWARDS = new Set(['danielroe', 'patak-cat'])

interface TeamMembers {
  steward: Set<string>
  core: Set<string>
  maintainer: Set<string>
}

const ORG = 'npmx-dev'

const TEAM_SLUGS: Record<keyof TeamMembers, string> = {
  steward: 'stewards',
  core: 'core',
  maintainer: 'maintainers',
}

const orgRef: ForgeRepoRef = {
  forge: 'github',
  instance: 'github.com',
  owner: ORG,
  name: '',
  kind: 'namespace',
}
const repoRef: RepoRef = { provider: 'github', owner: ORG, repo: 'npmx.dev' }

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iterable) {
    items.push(item)
  }
  return items
}

async function fetchTeamMembers(provider: ForgeProvider): Promise<TeamMembers | null> {
  try {
    const result: TeamMembers = { steward: new Set(), core: new Set(), maintainer: new Set() }
    for (const [role, slug] of Object.entries(TEAM_SLUGS) as [keyof TeamMembers, string][]) {
      for await (const actor of provider.orgs.teamMembers({
        forge: 'github',
        instance: 'github.com',
        org: orgRef,
        slug,
      })) {
        result[role].add(actor.login)
      }
    }
    return result
  } catch (error) {
    console.warn('Failed to fetch team members from GitHub:', error)
    return null
  }
}

async function fetchSponsorable(provider: ForgeProvider, logins: string[]): Promise<Set<string>> {
  const sponsorable = new Set<string>()
  try {
    for (const login of logins) {
      if (await provider.users.sponsorable(login)) {
        sponsorable.add(login)
      }
    }
  } catch (error) {
    console.warn('Failed to fetch sponsors info:', error)
  }
  return sponsorable
}

function getRoleInfo(login: string, teams: TeamMembers): { role: Role; order: number } {
  if (teams.steward.has(login)) return { role: 'steward', order: 0 }
  if (teams.core.has(login)) return { role: 'core', order: 1 }
  if (teams.maintainer.has(login)) return { role: 'maintainer', order: 2 }
  return { role: 'contributor', order: 3 }
}

export default defineCachedEventHandler(
  async (): Promise<GitHubContributor[]> => {
    const githubToken = useRuntimeConfig().github.orgToken
    const provider = createForgeProvider(repoRef, { token: githubToken })

    if (!provider) {
      throw createError({ statusCode: 500, message: 'Failed to read contributors' })
    }

    // Fetch team members dynamically if token is available; otherwise, use fallback
    const fallback: TeamMembers = {
      steward: FALLBACK_STEWARDS,
      maintainer: new Set(),
      core: new Set(),
    }
    const teams: TeamMembers = githubToken
      ? ((await fetchTeamMembers(provider)) ?? fallback)
      : fallback

    const contributors = (
      await collect(provider.repos.contributors(toForgeRepoRef(repoRef)))
    ).filter(c => c.actor?.login && !c.actor.login.includes('[bot]'))

    const maintainerLogins = contributors
      .map(c => c.actor!.login)
      .filter(
        login => teams.steward.has(login) || teams.core.has(login) || teams.maintainer.has(login),
      )

    const sponsorable = githubToken
      ? await fetchSponsorable(provider, maintainerLogins)
      : new Set<string>()

    return contributors
      .map(c => {
        const login = c.actor!.login
        const { role, order } = getRoleInfo(login, teams)
        const contributor: GitHubContributor = {
          login,
          id: Number(c.actor!.id),
          avatar_url: c.actor!.avatarUrl ?? '',
          html_url: c.actor!.url ?? `https://github.com/${login}`,
          contributions: c.contributions,
          role,
          sponsors_url: sponsorable.has(login) ? `https://github.com/sponsors/${login}` : null,
        }
        return { contributor, order }
      })
      .sort(
        (a, b) => a.order - b.order || b.contributor.contributions - a.contributor.contributions,
      )
      .map(({ contributor }) => contributor)
  },
  {
    maxAge: 3600, // Cache for 1 hour
    name: 'github-contributors',
    getKey: () => 'contributors',
  },
)
