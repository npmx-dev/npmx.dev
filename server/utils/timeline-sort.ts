import { tryParse } from 'verkit'

export type TimelineSort = 'time' | 'semver'

/** Parse the `sort` query param for the timeline endpoints. */
export function parseTimelineSort(value: unknown): TimelineSort {
  return value === 'semver' ? 'semver' : 'time'
}

/** Parse the `stable-only` query param for the timeline endpoints. */
export function parseStableOnly(value: unknown): boolean {
  return value === 'true'
}

/** True for a parseable, non-pre-release semver version. */
export function isStableVersion(version: string): boolean {
  const parsed = tryParse(version)
  return !!parsed && (parsed.prerelease?.length ?? 0) === 0
}
