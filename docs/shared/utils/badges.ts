export const BADGE_TYPES = Object.freeze([
  'version',
  'license',
  'size',
  'downloads',
  'downloads-day',
  'downloads-week',
  'downloads-month',
  'downloads-year',
  'vulnerabilities',
  'dependencies',
  'created',
  'updated',
  'engines',
  'types',
  'maintainers',
  'deprecated',
  'quality',
  'popularity',
  'maintenance',
  'score',
  'name',
] as const)

export type BadgeType = (typeof BADGE_TYPES)[number]

export function titleCase(str: string) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' per ')
}
