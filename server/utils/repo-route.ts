import type { H3Event } from 'h3'
import type { RepoRef } from '#shared/utils/git-providers'
import * as v from 'valibot'
import { isProviderId } from '#shared/utils/git-providers'
import { validateHostWithValibot } from '#server/utils/changelog/validateHost'

/** Reads and validates the provider, owner, repo and optional host of a repo route. */
export function getRepoRef(event: H3Event): RepoRef {
  const provider = getRouterParam(event, 'provider')
  if (!isProviderId(provider)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown git provider.' })
  }

  const owner = getRouterParam(event, 'owner', { decode: true })
  const repo = getRouterParam(event, 'repo')
  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Owner and repo are required parameters.',
    })
  }

  const parsed = v.safeParse(v.object({ host: validateHostWithValibot(provider) }), getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid repository host.' })
  }

  const host = parsed.output.host || undefined
  return { provider, owner, repo, ...(host ? { host } : {}) }
}

/** Cache key for a repo route, including the provider and any self-hosted instance. */
export function repoCacheKey(event: H3Event): string {
  const provider = getRouterParam(event, 'provider') ?? ''
  const owner = getRouterParam(event, 'owner', { decode: true }) ?? ''
  const repo = getRouterParam(event, 'repo') ?? ''
  const host = getQuery(event).host
  return `${provider}:${owner}/${repo}${typeof host === 'string' && host ? `@${host}` : ''}`
}
