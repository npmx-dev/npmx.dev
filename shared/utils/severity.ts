// @unocss-include

import type { OsvSeverityLevel } from '../types'
import { SEVERITY_LEVELS } from '../types'

/**
 * Color classes for severity levels (banner style)
 */
export const SEVERITY_COLORS: Record<OsvSeverityLevel, string> = {
  critical: 'text-red-500 bg-red-500/10 border-red-500/50',
  high: 'text-red-400 bg-red-500/10 border-red-500/30',
  moderate: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  low: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  unknown: 'text-fg-muted bg-bg-subtle border-border',
}

/**
 * Color classes for inline severity indicators
 */
export const SEVERITY_TEXT_COLORS: Record<OsvSeverityLevel, string> = {
  critical: 'text-red-500',
  high: 'text-orange-500',
  moderate: 'text-yellow-500',
  low: 'text-blue-500',
  unknown: 'text-fg-subtle',
}

/**
 * Badge color classes for severity levels
 */
export const SEVERITY_BADGE_COLORS: Record<OsvSeverityLevel, string> = {
  critical: 'bg-bg-muted border border-border text-fg',
  high: 'bg-bg-muted border border-border text-fg-muted',
  moderate: 'bg-bg-muted border border-border text-fg-muted',
  low: 'bg-bg-muted border border-border text-fg-subtle',
  unknown: 'bg-bg-muted border border-border text-fg-subtle',
}

/**
 * Get highest severity from counts
 */
export function getHighestSeverity(counts: Record<string, number>): OsvSeverityLevel {
  for (const s of SEVERITY_LEVELS) {
    if ((counts[s] ?? 0) > 0) return s
  }
  return 'unknown'
}
