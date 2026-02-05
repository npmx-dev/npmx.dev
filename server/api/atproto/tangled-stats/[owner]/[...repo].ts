import type { CachedFetchFunction } from '#shared/utils/fetch-cache-config'

export default defineEventHandler(async event => {
  let owner = getRouterParam(event, 'owner')
  let repo = getRouterParam(event, 'repo')

  let cachedFetch: CachedFetchFunction
  if (event.context.cachedFetch) {
    cachedFetch = event.context.cachedFetch
  } else {
    // Fallback: return a function that uses regular $fetch
    // (shouldn't happen in normal operation)
    cachedFetch = async <T = unknown>(
      url: string,
      options: Parameters<typeof $fetch>[1] = {},
      _ttl?: number,
    ): Promise<CachedFetchResult<T>> => {
      const data = (await $fetch<T>(url, options)) as T
      return { data, isStale: false, cachedAt: null }
    }
  }

  try {
    // Tangled doesn't have a public JSON API, but we can scrape the star count
    // from the HTML page (it's in the hx-post URL as countHint=N)
    const { data: html } = await cachedFetch<string>(
      `https://tangled.org/${owner}/${repo}`,
      {
        headers: { 'User-Agent': 'npmx', 'Accept': 'text/html' },
      },
      60 * 10,
    )
    // Extracts the at-uri used in atproto
    const atUriMatch = html.match(/data-star-subject-at="([^"]+)"/)
    // Extract star count from: hx-post="/star?subject=...&countHint=23"
    const starMatch = html.match(/countHint=(\d+)/)
    //We'll set the stars from tangled's repo page and may override it with constellation if successful
    let stars = starMatch?.[1] ? parseInt(starMatch[1], 10) : 0
    let forks = 0
    const atUri = atUriMatch?.[1]

    if (atUri) {
      try {
        const constellation = new Constellation(cachedFetch)
        //Get counts of records that reference this repo in the atmosphere using constellation
        const { data: allLinks } = await constellation.getAllLinks(atUri)
        stars = allLinks.links['sh.tangled.feed.star']?.['.subject']?.distinct_dids ?? stars
        forks = allLinks.links['sh.tangled.repo']?.['.source']?.distinct_dids ?? stars
      } catch {
        //failing silently since this is just an enhancement to the information already showing
      }
    }

    return {
      stars,
      forks,
    }
  } catch {
    return {
      stars: 0,
      forks: 0,
    }
  }
})
