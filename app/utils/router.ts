import type { RouteLocationRaw } from 'vue-router'
import { splitPackageName } from '~/utils/package-name'

export function packageRoute(
  packageName: string,
  version?: string | null,
  hash?: string,
): RouteLocationRaw {
  const { org, name } = splitPackageName(packageName)

  if (version) {
    return {
      name: 'package-version',
      params: {
        org,
        name,
        // remove spaces to be correctly resolved by router
        version: version.replace(/\s+/g, ''),
      },
      hash,
    }
  }

  return {
    name: 'package',
    params: {
      org,
      name,
    },
  }
}

/**
 * Docs tab route (`/package-docs/...`).
 *
 * The docs route uses a single catch-all `path` param. Emit the scoped name as
 * two segments (`["@org", "name", ...]`) rather than one (`["@org/name", ...]`),
 * so the URL keeps a literal slash instead of a `%2F`-encoded one.
 */
export function docsRoute(packageName: string, version?: string | null): RouteLocationRaw {
  const { org, name } = splitPackageName(packageName)
  const nameSegments = org ? [org, name] : [name]
  const path = version ? [...nameSegments, 'v', version.replace(/\s+/g, '')] : nameSegments

  return {
    name: 'docs',
    params: { path: path as [string, ...string[]] },
  }
}

/** Full version history page (`/package/.../versions`) */
export function packageVersionsRoute(packageName: string): RouteLocationRaw {
  const { org, name } = splitPackageName(packageName)
  return { name: 'package-versions', params: { org, name } }
}

export function diffRoute(
  packageName: string,
  fromVersion: string,
  toVersion: string,
): RouteLocationRaw {
  const { org, name } = splitPackageName(packageName)

  return {
    name: 'diff',
    params: {
      org: org || undefined,
      packageName: name,
      versionRange: `${fromVersion}...${toVersion}`,
    },
  }
}

export function changelogRoute(
  packageName: string,
  version?: string | null,
  hash?: string,
): RouteLocationRaw {
  const { org, name } = splitPackageName(packageName)

  if (version) {
    return {
      name: 'changelog-version',
      params: {
        org,
        name,
        // remove spaces to be correctly resolved by router
        version: version.replace(/\s+/g, ''),
      },
      hash,
    }
  }

  return {
    name: 'changelog',
    params: {
      org,
      name,
    },
  }
}

export function packageTimelineRoute(packageName: string, version: string): RouteLocationRaw {
  const { org, name } = splitPackageName(packageName)

  return {
    name: 'timeline',
    params: {
      org: org || undefined,
      packageName: name,
      version: version.replace(/\s+/g, ''),
    },
  }
}

export function packageStatsRoute(
  packageName: string,
  version: string,
  hash?: '#distribution' | '#trends',
): RouteLocationRaw {
  const { org, name } = splitPackageName(packageName)

  return {
    name: 'stats',
    hash,
    params: {
      org: org || undefined,
      packageName: name,
      version: version.replace(/\s+/g, ''),
    },
  }
}
