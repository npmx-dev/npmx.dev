import type { PackageSearchResult } from '../search.ts'
import type { AppState } from './types.ts'

export function selectedPackage(state: AppState): PackageSearchResult | undefined {
  return state.results[state.selectedIndex]
}

export function hasNextResultsPage(state: AppState): boolean {
  return state.query.trim().length > 0 && state.pageOffset + state.results.length < state.total
}

export function hasPreviousResultsPage(state: AppState): boolean {
  return state.query.trim().length > 0 && state.pageOffset > 0
}

export function formatResultsRange(state: AppState): string {
  if (!state.query.trim() || state.total === 0 || state.results.length === 0) {
    return '0 / 0'
  }

  const start = state.pageOffset + 1
  const end = state.pageOffset + state.results.length
  return `${start}-${end} / ${state.total}`
}
