import { debounce } from 'perfect-debounce'
import * as v from 'valibot'
import { ActorSearchResponseSchema, type ActorSearchResult } from '#shared/schemas/atproto'

const TYPEAHEAD_ENDPOINT = `${TYPEAHEAD_API}/xrpc/app.bsky.actor.searchActorsTypeahead`
// Attributes requests (and rate-limit pressure) to this app on the service's stats page.
const TYPEAHEAD_CLIENT_HEADER = 'npmx.dev'
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300
const DEFAULT_LIMIT = 5
// The API allows 60 req/min per IP, so keep recent queries around to avoid
// re-requesting answers we already have (e.g. when backspacing).
const CACHE_LIMIT = 50

/**
 * Normalize raw input into a search prefix.
 * Returns an empty string when the value should not be sent to the API
 * (empty, too short, or a PDS/URL which is a valid but unsupported identifier).
 */
export function normalizeTypeaheadQuery(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, '').toLowerCase()
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return ''
  if (trimmed.length < MIN_QUERY_LENGTH) return ''
  return trimmed
}

function rememberQuery(
  cache: Map<string, ActorSearchResult[]>,
  query: string,
  actors: ActorSearchResult[],
) {
  cache.delete(query)
  cache.set(query, actors)
  if (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) cache.delete(oldestKey)
  }
}

interface SearchContext {
  cache: Map<string, ActorSearchResult[]>
  query: string
  limit: number
  signal: AbortSignal
  actors: Ref<ActorSearchResult[]>
  error: Ref<boolean>
  isSearching: Ref<boolean>
}

async function runSearch({
  cache,
  query,
  limit,
  signal,
  actors,
  error,
  isSearching,
}: SearchContext) {
  const cached = cache.get(query)
  if (cached) {
    actors.value = cached
    error.value = false
    isSearching.value = false
    return
  }

  isSearching.value = true
  error.value = false

  try {
    const response = await $fetch(TYPEAHEAD_ENDPOINT, {
      query: { q: query, limit },
      headers: { 'X-Client': TYPEAHEAD_CLIENT_HEADER },
      signal,
    })
    if (signal.aborted) return

    const { actors: results } = v.parse(ActorSearchResponseSchema, response)
    rememberQuery(cache, query, results)
    actors.value = results
  } catch (err) {
    if (signal.aborted) return
    // oxlint-disable-next-line no-console -- surfaced as an inline error state
    console.warn('Atmosphere account search failed:', err)
    actors.value = []
    error.value = true
  } finally {
    if (!signal.aborted) isSearching.value = false
  }
}

/**
 * Search Atmosphere accounts for a handle/display-name prefix.
 * Requests are debounced, deduplicated and aborted when superseded.
 */
export function useActorTypeahead(
  rawQuery: MaybeRefOrGetter<string>,
  options: { limit?: number } = {},
) {
  const actors = shallowRef<ActorSearchResult[]>([])
  const isSearching = shallowRef(false)
  const error = shallowRef(false)
  const query = computed(() => normalizeTypeaheadQuery(toValue(rawQuery)))
  const limit = options.limit ?? DEFAULT_LIMIT
  // Instance-scoped so results never leak between consumers (or test mounts).
  const cache = new Map<string, ActorSearchResult[]>()
  const debouncedSearch = debounce(runSearch, DEBOUNCE_MS)
  let pendingController: AbortController | undefined

  function cancel() {
    pendingController?.abort()
    pendingController = undefined
    debouncedSearch.cancel()
  }

  watch(
    query,
    value => {
      cancel()
      error.value = false

      if (!value) {
        actors.value = []
        isSearching.value = false
        return
      }

      const controller = new AbortController()
      pendingController = controller
      isSearching.value = !cache.has(value)

      debouncedSearch({
        cache,
        query: value,
        limit,
        signal: controller.signal,
        actors,
        error,
        isSearching,
      })
    },
    { immediate: true },
  )

  onScopeDispose(cancel)

  return { actors, isSearching, error, query }
}
