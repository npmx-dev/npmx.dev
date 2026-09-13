export type SearchResultNavigationDirection = 'next' | 'previous'

export function getSearchResultNavigationDirection(
  key: string,
): SearchResultNavigationDirection | null {
  switch (key) {
    case 'j':
    case 'J':
      return 'next'
    case 'k':
    case 'K':
      return 'previous'
    default:
      return null
  }
}

export function isSearchResultNavigationKey(key: string): boolean {
  return getSearchResultNavigationDirection(key) !== null || key === 'Enter'
}
