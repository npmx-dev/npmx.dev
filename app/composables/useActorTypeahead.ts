import { Client } from '@atproto/lex'
import { debounce } from 'perfect-debounce'
import * as searchActorsTypeahead from '#shared/types/lexicons/app/bsky/actor/searchActorsTypeahead'
import type { ProfileViewBasic } from '#shared/types/lexicons/app/bsky/actor/defs'
import { TYPEAHEAD_API } from '#shared/utils/constants'

const TYPEAHEAD_CLIENT_HEADER = 'npmx.dev'
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300
const DEFAULT_LIMIT = 5
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
  cache: Map<string, ProfileViewBasic[]>,
  query: string,
  actors: ProfileViewBasic[],
) {
  cache.delete(query)
  cache.set(query, actors)
  if (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) cache.delete(oldestKey)
  }
}

/**
 * Search Atmosphere accounts for a handle/display-name prefix.
 * Requests are debounced, cached and aborted when superseded.
 */
export function useActorTypeahead(
  rawQuery: MaybeRefOrGetter<string>,
  options: { limit?: number } = {},
) {
  const actors = shallowRef<ProfileViewBasic[]>([])
  const isSearching = shallowRef(false)
  const error = shallowRef(false)
  const query = computed(() => normalizeTypeaheadQuery(toValue(rawQuery)))
  const limit = options.limit ?? DEFAULT_LIMIT

  const client = new Client(TYPEAHEAD_API, {
    //the requested header from typeahead.waow.tech
    headers: { 'X-Client': TYPEAHEAD_CLIENT_HEADER },
  })

  const cache = new Map<string, ProfileViewBasic[]>()
  let pendingController: AbortController | undefined

  const debouncedSearch = debounce((value: string) => {
    const controller = new AbortController()
    pendingController = controller
    void search(value, controller.signal)
  }, DEBOUNCE_MS)

  function cancel() {
    debouncedSearch.cancel()
    pendingController?.abort()
    pendingController = undefined
  }

  async function search(value: string, signal: AbortSignal) {
    try {
      // The response is validated against the lexicon's output schema by the client.
      const { actors: results } = await client.call(
        searchActorsTypeahead.main,
        { q: value, limit },
        { signal },
      )
      if (signal.aborted) return

      rememberQuery(cache, value, results)
      actors.value = results
    } catch (err) {
      if (signal.aborted) return
      // oxlint-disable-next-line no-console -- Show as an inline error state
      console.warn('Atmosphere account search failed:', err)
      actors.value = []
      error.value = true
    } finally {
      if (!signal.aborted) isSearching.value = false
    }
  }

  watch(
    query,
    value => {
      cancel()
      error.value = false

      const cached = value ? cache.get(value) : undefined
      if (!value || cached) {
        actors.value = cached ?? []
        isSearching.value = false
        return
      }

      // Drop the previous query's results so the list never shows a mismatched answer.
      actors.value = []
      isSearching.value = true
      debouncedSearch(value)
    },
    { immediate: true },
  )

  onScopeDispose(cancel)

  return { actors, isSearching, error, query }
}
