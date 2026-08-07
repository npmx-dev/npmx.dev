interface PkgPrNewAvailabilityResponse {
  hasReleases: boolean
  url: string
}

const PKG_PR_NEW_TTL_SECONDS = 60
const PKG_PR_NEW_TIMEOUT_MS = 3000

function toSegment(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export default defineCachedEventHandler(
  async (event): Promise<PkgPrNewAvailabilityResponse> => {
    const query = getQuery(event)
    const owner = toSegment(query.owner)
    const repo = toSegment(query.repo)

    if (!owner || !repo) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing owner/repo',
      })
    }

    const url = `https://pkg.pr.new/~/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

    try {
      const response = await $fetch.raw(url, {
        method: 'HEAD',
        timeout: PKG_PR_NEW_TIMEOUT_MS,
        retry: 0,
      })
      return {
        hasReleases: response.headers.get('x-has-releases') === '1',
        url,
      }
    } catch {
      return {
        hasReleases: false,
        url,
      }
    }
  },
  {
    maxAge: PKG_PR_NEW_TTL_SECONDS,
    swr: true,
    name: 'pkg-pr-new-availability',
    getKey: event => {
      const query = getQuery(event)
      const owner = toSegment(query.owner).toLowerCase()
      const repo = toSegment(query.repo).toLowerCase()
      return `pkg-pr-new:${owner}/${repo}`
    },
  },
)
