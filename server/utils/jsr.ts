import type { JsrPackageMeta, JsrPackageInfo } from '#shared/types/jsr'

const JSR_REGISTRY = 'https://jsr.io'

/**
 * Check if a scoped npm package exists on JSR with the same name.
 *
 * This only works for scoped packages (@scope/name) since:
 * 1. JSR only has scoped packages
 * 2. We can only authoritatively match when names are identical
 *
 * Unscoped npm packages (e.g., "hono") may exist on JSR under a different
 * name (e.g., "@hono/hono"), but we don't attempt to guess these mappings.
 *
 * @param npmPackageName - The npm package name (e.g., "@hono/hono")
 * @returns JsrPackageInfo with existence status and metadata
 */
export const fetchJsrPackageInfo = defineCachedFunction(
  async (npmPackageName: string): Promise<JsrPackageInfo> => {
    // Only check scoped packages - we can't authoritatively map unscoped names
    if (!npmPackageName.startsWith('@')) {
      return { exists: false }
    }

    // Parse scope and name from @scope/name format
    const match = npmPackageName.match(/^@([^/]+)\/(.+)$/)
    if (!match) {
      return { exists: false }
    }

    const [, scope, name] = match

    try {
      // Fetch JSR package metadata
      const meta = await $fetch<JsrPackageMeta>(`${JSR_REGISTRY}/@${scope}/${name}/meta.json`, {
        // Short timeout since this is a nice-to-have feature
        timeout: 3000,
      })

      // Find latest non-yanked version
      const versions = Object.entries(meta.versions)
        .filter(([, v]) => !v.yanked)
        .map(([version]) => version)

      versions.sort()
      const latestVersion = versions[versions.length - 1]

      return {
        exists: true,
        scope: meta.scope,
        name: meta.name,
        url: `${JSR_REGISTRY}/@${meta.scope}/${meta.name}`,
        latestVersion,
      }
    } catch {
      // Package doesn't exist on JSR or API error
      return { exists: false }
    }
  },
  {
    maxAge: 60 * 60 * 24, // 1 day
    swr: true,
    name: 'jsr-package-info',
    getKey: (name: string) => name,
  },
)
