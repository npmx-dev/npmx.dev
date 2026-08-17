import type { SecuritySourceId, SecuritySourceStatus } from '../types/dependency-analysis'

/**
 * Whether any source failed for a (possibly transient) reason, e.g. an
 * outage. Used to cache such results for a much shorter time than complete
 * ones, so a blip doesn't strip findings from caches for an hour.
 */
export function hasTransientSourceFailure(
  sourceStatus: Partial<Record<SecuritySourceId, SecuritySourceStatus>>,
): boolean {
  return Object.values(sourceStatus).some(status => status === 'failed')
}
