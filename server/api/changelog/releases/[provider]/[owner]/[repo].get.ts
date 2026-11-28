import type { ProviderId, RepoRef } from '~~/shared/utils/git-providers'
import type { ReleaseData } from '~~/shared/types/changelog'
import * as v from 'valibot'
import { ForgeApiError } from 'forges'
import {
  ERROR_CHANGELOG_RELEASES_FAILED,
  ERROR_THROW_INCOMPLETE_PARAM,
} from '~~/shared/utils/constants'
import { createForgeProvider, toForgeRepoRef } from '~~/shared/utils/forges'
import { changelogRenderer } from '~~/server/utils/changelog/markdown'
import { createRepoInfo } from '~~/server/utils/changelog/mdRepoInfo'
import { validateHostWithValibot } from '~~/server/utils/changelog/validateHost'

const TIMEOUT_MS = 15_000

export default defineCachedEventHandler(
  async event => {
    const provider = getRouterParam(event, 'provider') as ProviderId
    const repo = getRouterParam(event, 'repo')
    // A GitLab subgroup owner arrives encoded as one segment (`group%2Fsub`).
    const owner = getRouterParam(event, 'owner', { decode: true })

    if (!repo || !provider || !owner) {
      throw createError({
        status: 404,
        statusMessage: ERROR_THROW_INCOMPLETE_PARAM,
      })
    }
    const rawQuery = getQuery(event)
    const { host } = v.parse(v.object({ host: validateHostWithValibot(provider) }), rawQuery)

    try {
      // No disconnect signal: a cached handler cannot tell a client leaving from
      // an SWR revalidation, and aborting would kill the refresh for everyone.
      return await getReleasesViaForges(provider, owner, repo, host || undefined)
    } catch (error) {
      handleApiError(error, {
        statusCode: 500,
        message: ERROR_CHANGELOG_RELEASES_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR * 2, // 2 hours
    swr: true,
    getKey: event => {
      const provider = getRouterParam(event, 'provider')
      const repo = getRouterParam(event, 'repo')
      const owner = getRouterParam(event, 'owner')
      const key = [`changelogRelease:v2:${provider}:${owner}:${repo}`]

      const query = getQuery(event)

      if (typeof query.host == 'string') {
        key.push(query.host)
      }
      return key.join(':')
    },
    shouldBypassCache: () => import.meta.dev,
  },
)

async function getReleasesViaForges(
  provider: ProviderId,
  owner: string,
  repo: string,
  host?: string,
) {
  const ref: RepoRef = { provider, owner, repo, host }
  const forgeProvider = await createForgeProvider(ref, { timeout: TIMEOUT_MS, viaProxy: true })
  if (!forgeProvider?.can('releases.list')) {
    throw createError({
      status: 404,
      statusMessage: ERROR_CHANGELOG_NOT_FOUND,
    })
  }

  const repoInfo = createRepoInfo(ref)
  if (!repoInfo) {
    throw createError({
      status: 404,
      statusMessage: ERROR_CHANGELOG_NOT_FOUND,
    })
  }

  const releasePage = await forgeProvider.releases
    .list(toForgeRepoRef(ref))
    .page()
    .catch((error: unknown) => {
      // A repository the forge does not know has no changelog; anything else is ours.
      if (error instanceof ForgeApiError && error.status === 404) {
        throw createError({
          status: 404,
          statusMessage: ERROR_CHANGELOG_NOT_FOUND,
        })
      }
      throw error
    })

  const render = await changelogRenderer(repoInfo)

  return releasePage.items.map(release => {
    const { html, toc } = render(release.body ?? null, release.ref.id)
    return {
      id: release.ref.id,
      html: html?.replace(/(?<!>)\n/g, '<br>') ?? null,
      title: release.name || release.tag,
      draft: release.isDraft,
      prerelease: release.isPrerelease,
      toc,
      publishedAt: release.publishedAt?.toISOString(),
      link: release.url ?? forgeProvider.urlFor({ release: release.ref }) ?? '',
      tag: release.tag,
    } satisfies ReleaseData
  })
}
