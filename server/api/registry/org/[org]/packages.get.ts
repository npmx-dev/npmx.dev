import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'

const NPM_REGISTRY = 'https://registry.npmjs.org'

// Validation pattern for npm org names (alphanumeric with hyphens)
const NPM_ORG_NAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i

function validateOrgName(name: string): void {
  if (!name || name.length > 50 || !NPM_ORG_NAME_RE.test(name)) {
    throw createError({
      // TODO: throwing 404 rather than 400 as it's cacheable
      statusCode: 404,
      message: `Invalid org name: ${name}`,
    })
  }
}

export default defineCachedEventHandler(
  async event => {
    const org = getRouterParam(event, 'org')

    if (!org) {
      throw createError({
        // TODO: throwing 404 rather than 400 as it's cacheable
        statusCode: 404,
        message: 'Org name is required',
      })
    }

    validateOrgName(org)

    try {
      const data = await $fetch<Record<string, string>>(
        `${NPM_REGISTRY}/-/org/${encodeURIComponent(org)}/package`,
      )
      return {
        packages: Object.keys(data),
        count: Object.keys(data).length,
      }
    } catch {
      // Org doesn't exist or has no packages
      return {
        packages: [],
        count: 0,
      }
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const org = getRouterParam(event, 'org') ?? ''
      return `org-packages:v1:${org}`
    },
  },
)
