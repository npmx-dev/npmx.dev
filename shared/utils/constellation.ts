import { CONSTELLATION_HOST } from '#shared/utils/constants'
import type { CachedFetchFunction } from './fetch-cache-config'

export type Backlink = {
  did: string
  collection: string
  rkey: string
}

export type BacklinksResponse = {
  total: number
  records: Backlink[]
  cursor: string | undefined
}

export type LinksDistinctDidsResponse = {
  total: number
  linking_dids: string[]
  cursor: string | undefined
}

export type AllLinksResponse = {
  links: Record<
    string,
    Record<
      string,
      {
        records: number
        distinct_dids: number
      }
    >
  >
}

const HEADERS = { 'User-Agent': 'npmx' }

export class Constellation {
  private readonly cachedFetch: CachedFetchFunction
  constructor(fetch: CachedFetchFunction) {
    this.cachedFetch = fetch
  }

  /**
   * Gets backlinks from constellation
   * https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks?subject=at%3A%2F%2Fdid%3Aplc%3Aa4pqq234yw7fqbddawjo7y35%2Fapp.bsky.feed.post%2F3m237ilwc372e&source=app.bsky.feed.like%3Asubject.uri&limit=16
   * @param subject - A uri encoded link. did, url, or at-uri
   * @param collection - The lexicon collection to check like dev.npmx.feed.like
   * @param recordPath - Where in the record to check for the subject
   * @param limit - The number of backlinks to return
   * @param cursor - The cursor to use for pagination
   * @param reverse - Whether to reverse the order of the results
   * @param filterByDids - An array of dids to filter by in the results
   * @param ttl - The ttl to use for the cache
   */
  async getBackLinks(
    subject: string,
    collection: string,
    recordPath: string,
    limit = 16,
    cursor?: string,
    reverse = false,
    filterByDids: [string][] = [],
    ttl: number | undefined = undefined,
  ) {
    const source = encodeURIComponent(`${collection}:${recordPath}`)
    let urlToCall = `https://${CONSTELLATION_HOST}/xrpc/blue.microcosm.links.getBacklinks?subject=${encodeURIComponent(subject)}&source=${source}&limit=${limit}`
    if (cursor) urlToCall += `&cursor=${cursor}`
    if (reverse) urlToCall += '&reverse=true'
    filterByDids.forEach(did => (urlToCall += `&did=${did}`))

    return await this.cachedFetch<BacklinksResponse>(urlToCall, { headers: HEADERS }, ttl)
  }

  /**
   *  Gets the distinct dids that link to a target record
   * @param target - A uri encoded link. did, url, or at-uri
   * @param collection - The lexicon collection to check like dev.npmx.feed.like
   * @param recordPath - Where in the record to check for the subject
   * @param limit - The number of distinct dids to return
   * @param cursor - The cursor to use for pagination
   * @param ttl - The ttl to use for the cache
   */
  async getLinksDistinctDids(
    target: string,
    collection: string,
    recordPath: string,
    limit: number = 16,
    cursor?: string,
    ttl: number | undefined = undefined,
  ) {
    let urlToCall = `https://${CONSTELLATION_HOST}/links/distinct-dids?target=${encodeURIComponent(target)}&collection=${collection}&path=${recordPath}&limit=${limit}`
    if (cursor) urlToCall += `&cursor=${cursor}`
    return await this.cachedFetch<LinksDistinctDidsResponse>(urlToCall, { headers: HEADERS }, ttl)
  }

  /**
   * Gets all links from constellation and their counts
   * @param target - A uri encoded link. did, url, or at-uri
   * @param ttl - The ttl to use for the cache
   */
  async getAllLinks(target: string, ttl: number | undefined = undefined) {
    return await this.cachedFetch<AllLinksResponse>(
      `https://${CONSTELLATION_HOST}/links/all?target=${target}`,
      { headers: HEADERS },
      ttl,
    )
  }
}
