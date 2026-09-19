import type { InjectionKey } from 'vue'

/** Focuses a mounted search input. Returns `false` when the input is not rendered. */
type SearchInputFocusTarget = () => boolean

interface SearchInputFocusContext {
  /** Registers a search input for the lifetime of the current component scope. */
  register: (target: SearchInputFocusTarget) => void
  /** Focuses the first search input that is currently rendered. */
  focus: () => boolean
}

const SEARCH_INPUT_FOCUS_KEY: InjectionKey<SearchInputFocusContext> = Symbol('search-input-focus')

/**
 * Provides the search input focus context. Call once from the app root so both
 * the header search box and the homepage search input can register themselves.
 */
export function provideSearchInputFocus(): SearchInputFocusContext {
  const targets = new Set<SearchInputFocusTarget>()

  const context: SearchInputFocusContext = {
    register(target) {
      targets.add(target)
      onScopeDispose(() => targets.delete(target))
    },
    focus() {
      for (const target of targets) {
        if (target()) return true
      }
      return false
    },
  }

  provide(SEARCH_INPUT_FOCUS_KEY, context)
  return context
}

/**
 * Registers the calling component's search input so keyboard shortcuts can focus it
 * without querying the DOM. The target should return `false` while its input is not rendered.
 */
export function useSearchInputFocusTarget(target: SearchInputFocusTarget) {
  inject(SEARCH_INPUT_FOCUS_KEY, null)?.register(target)
}

/**
 * Returns a function that focuses the currently rendered search input.
 * The returned function resolves to `false` when no search input is on the page.
 */
export function useSearchInputFocus(): () => boolean {
  const context = inject(SEARCH_INPUT_FOCUS_KEY, null)
  return () => context?.focus() ?? false
}
