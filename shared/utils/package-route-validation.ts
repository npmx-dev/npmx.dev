import { createError } from 'h3'
import * as v from 'valibot'
import { PackageNameSchema, VersionSchema } from '#shared/schemas/package'
import { NO_DEPENDENCY_ID } from '#shared/utils/compare'
import { parsePackageSpec } from '#shared/utils/parse-package-param'

/** Pages whose route params name a package and version they fetch before rendering. */
const PACKAGE_PAGE = /^\/(?:package(?:-timeline|-stats|-changelog|-code)?|diff|changelog)(?:\/|$)/
const ORG_PAGE = /^\/org(?:\/|$)/
const COMPARE_PAGE = /^\/compare(?:\/|$)/

/** An invalid coordinate cannot be in the registry, so the answer is the 404 page instead of a fetch. */
function assertValid(name: string | undefined, version?: string): void {
  if (name !== undefined && !v.is(PackageNameSchema, name)) {
    throw createError({ statusCode: 404 })
  }
  if (version !== undefined && !v.is(VersionSchema, version)) {
    throw createError({ statusCode: 404 })
  }
}

interface PackageRoute {
  path: string
  params: Record<string, string | string[] | undefined>
  query: Record<string, unknown>
}

/**
 * Throws a 404 for a package page whose route params cannot name a package or version,
 * before the page runs any of its upstream requests.
 */
export function assertValidPackageRoute(route: PackageRoute): void {
  const param = (key: string) => {
    const value = route.params[key]
    return typeof value === 'string' ? value : undefined
  }

  if (PACKAGE_PAGE.test(route.path)) {
    const org = param('org')
    const name = param('name') ?? param('packageName')

    assertValid(org && name ? `${org}/${name}` : (name ?? org), param('version'))

    const range = param('versionRange')
    if (range) {
      const parts = range.split('...')
      if (parts.length !== 2) {
        throw createError({ statusCode: 404 })
      }
      for (const part of parts) assertValid(undefined, part)
    }
    return
  }

  if (ORG_PAGE.test(route.path)) {
    assertValid(param('org')?.replace(/^@/, ''))
    return
  }

  if (COMPARE_PAGE.test(route.path)) {
    const packages = route.query.packages
    const raw = Array.isArray(packages)
      ? packages.filter(value => typeof value === 'string').join(',')
      : typeof packages === 'string'
        ? packages
        : ''

    for (const spec of raw.split(',')) {
      const trimmed = spec.trim()
      if (!trimmed || trimmed === NO_DEPENDENCY_ID) continue
      const { name, version } = parsePackageSpec(trimmed)
      assertValid(name, version)
    }
  }
}
