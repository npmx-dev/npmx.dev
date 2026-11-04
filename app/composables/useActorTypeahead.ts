// Explicit imports (rather than Nuxt auto-imports) so the pure helpers in this
// module can be unit-tested in a plain node environment.
import { computed, onScopeDispose, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { Client } from '@atproto/lex'
import * as searchActorsTypeahead from '#shared/types/lexicons/app/bsky/actor/searchActorsTypeahead'
import type { ProfileViewBasic } from '#shared/types/lexicons/app/bsky/actor/defs'
import { TYPEAHEAD_API } from '#shared/utils/constants'

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
    headers: { 'X-Client': TYPEAHEAD_CLIENT_HEADER },
  })
  // Instance-scoped so results never leak between consumers (or test mounts).
  const cache = new Map<string, ProfileViewBasic[]>()
  // A hand-rolled timer rather than perfect-debounce: that library skips the
  // wait whenever a call is already in flight, which would turn every keystroke
  // after the first request into its own request (see useGlobalSearch).
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let pendingController: AbortController | undefined

  function cancel() {
    clearTimeout(debounceTimer)
    debounceTimer = undefined
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
      // oxlint-disable-next-line no-console -- surfaced as an inline error state
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

      const controller = new AbortController()
      pendingController = controller
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined
        search(value, controller.signal)
      }, DEBOUNCE_MS)
    },
    { immediate: true },
  )

  onScopeDispose(cancel)

  return { actors, isSearching, error, query }
}
