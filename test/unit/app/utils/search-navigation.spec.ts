import { describe, expect, it } from 'vitest'
import {
  getSearchResultNavigationDirection,
  isSearchResultNavigationKey,
} from '../../../../app/utils/search-navigation'

describe('search navigation helper', () => {
  it('returns next for j and J', () => {
    expect(getSearchResultNavigationDirection('j')).toBe('next')
    expect(getSearchResultNavigationDirection('J')).toBe('next')
  })

  it('returns previous for k and K', () => {
    expect(getSearchResultNavigationDirection('k')).toBe('previous')
    expect(getSearchResultNavigationDirection('K')).toBe('previous')
  })

  it('returns null for non-navigation keys', () => {
    expect(getSearchResultNavigationDirection('ArrowDown')).toBeNull()
    expect(getSearchResultNavigationDirection('Enter')).toBeNull()
    expect(getSearchResultNavigationDirection('x')).toBeNull()
  })

  it('identifies j/k/Enter as navigation keys', () => {
    expect(isSearchResultNavigationKey('j')).toBe(true)
    expect(isSearchResultNavigationKey('k')).toBe(true)
    expect(isSearchResultNavigationKey('Enter')).toBe(true)
  })

  it('does not identify other keys as navigation keys', () => {
    expect(isSearchResultNavigationKey('ArrowDown')).toBe(false)
    expect(isSearchResultNavigationKey('Escape')).toBe(false)
    expect(isSearchResultNavigationKey(' ')).toBe(false)
  })
})
