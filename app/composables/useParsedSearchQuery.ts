import type { ParsedSearchQuery } from '~/utils/search'
import { parseSearchQuery } from '~/utils/search'

type ParsedSearchQueryRef = {
  [K in keyof Required<ParsedSearchQuery>]: Ref<ParsedSearchQuery[K]>
}

/**
 * Wrapper around `parseSearchQuery` that makes it reactive.
 */
export function useParsedSearchQuery(query: MaybeRefOrGetter<string>): ParsedSearchQueryRef {
  const parsed = computed(() => parseSearchQuery(toValue(query)))

  return {
    name: computed(() => parsed.value.name),
    specifier: computed(() => parsed.value.specifier),
    scope: computed(() => parsed.value.scope),
    version: computed(() => parsed.value.version),
    trailing: computed(() => parsed.value.trailing),
  }
}
