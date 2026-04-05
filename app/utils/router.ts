import type { RouteLocationRaw } from 'vue-router'

export function packageRoute(
  packageName: string,
  version?: string | null,
  hash?: string,
): RouteLocationRaw {
  const [org, name = ''] = packageName.startsWith('@') ? packageName.split('/') : ['', packageName]

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

/** Full version history page (`/package/.../versions`) */
export function packageVersionsRoute(packageName: string): RouteLocationRaw {
  const [org, name = ''] = packageName.startsWith('@') ? packageName.split('/') : ['', packageName]
  return { name: 'package-versions', params: { org, name } }
}

export function diffRoute(
  packageName: string,
  fromVersion: string,
  toVersion: string,
): RouteLocationRaw {
  const [org, name = ''] = packageName.startsWith('@') ? packageName.split('/') : ['', packageName]

  return {
    name: 'diff',
    params: {
      org: org || undefined,
      packageName: name,
      versionRange: `${fromVersion}...${toVersion}`,
    },
  }
}
