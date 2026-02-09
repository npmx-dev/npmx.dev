import type { PackumentVersion } from '#shared/types'

export function getDependencyCount(version: PackumentVersion | null): number {
  if (!version?.dependencies) return 0
  return Object.keys(version.dependencies).length
}
