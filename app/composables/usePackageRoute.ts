/**
 * Parse package name and optional version from the route URL.
 *
 * Supported patterns:
 *   /nuxt → packageName: "nuxt", requestedVersion: null
 *   /nuxt/v/4.2.0 → packageName: "nuxt", requestedVersion: "4.2.0"
 *   /@nuxt/kit → packageName: "@nuxt/kit", requestedVersion: null
 *   /@nuxt/kit/v/1.0.0 → packageName: "@nuxt/kit", requestedVersion: "1.0.0"
 *   /axios@1.13.3 → packageName: "axios", requestedVersion: "1.13.3"
 *   /@nuxt/kit@1.0.0 → packageName: "@nuxt/kit", requestedVersion: "1.0.0"
 */
export function usePackageRoute() {
  const route = useRoute('package')

  const parsedRoute = computed(() => {
    const segments = route.params.package || []

    // Find the /v/ separator for version
    const vIndex = segments.indexOf('v')
    if (vIndex !== -1 && vIndex < segments.length - 1) {
      return {
        packageName: segments.slice(0, vIndex).join('/'),
        requestedVersion: segments.slice(vIndex + 1).join('/'),
      }
    }

    // Parse @ versioned package
    const fullPath = segments.join('/')
    const versionMatch = fullPath.match(/^(@[^/]+\/[^/]+|[^/]+)@([^/]+)$/)
    if (versionMatch) {
      const [, packageName, requestedVersion] = versionMatch as [string, string, string]
      return {
        packageName,
        requestedVersion,
      }
    }

    return {
      packageName: fullPath,
      requestedVersion: null as string | null,
    }
  })

  const packageName = computed(() => parsedRoute.value.packageName)
  const requestedVersion = computed(() => parsedRoute.value.requestedVersion)

  // Extract org name from scoped package (e.g., "@nuxt/kit" -> "nuxt")
  const orgName = computed(() => {
    const name = packageName.value
    if (!name.startsWith('@')) return null
    const match = name.match(/^@([^/]+)\//)
    return match ? match[1] : null
  })

  return {
    packageName,
    requestedVersion,
    orgName,
  }
}
