import type { SecuritySourceId, SecuritySourceStatus } from '../types/dependency-analysis'

/**
 * Whether every queried security data source failed outright, meaning the
 * result contains no vulnerability information at all. Callers should treat
 * such a result as "could not check" rather than "no vulnerabilities".
 */
export function allSecuritySourcesFailed(
  sourceStatus: Record<string, SecuritySourceStatus>,
): boolean {
  const statuses = Object.values(sourceStatus)
  return statuses.length > 0 && statuses.every(status => status === 'failed')
}

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
