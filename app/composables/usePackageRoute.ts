/**
 * Parse package name and optional version from the route URL.
 *
 * Routes use structured params:
 *   /package/nuxt → org: undefined, name: "nuxt"
 *   /package/@nuxt/kit → org: "@nuxt", name: "kit"
 *   /package/nuxt/v/4.2.0 → org: undefined, name: "nuxt", version: "4.2.0"
 *   /package/@nuxt/kit/v/1.0.0 → org: "@nuxt", name: "kit", version: "1.0.0"
 */
export function usePackageRoute() {
  const route = useRoute<'package'>('package')

  const packageName = computed(() => {
    const { org, name } = route.params
    return org ? `${org}/${name}` : name
  })

  const requestedVersion = computed(() => ('version' in route.params ? route.params.version : null))
  const orgName = computed(() => {
    const org = route.params.org
    return org ? org.replace(/^@/, '') : null
  })

  return {
    packageName,
    requestedVersion,
    orgName,
  }
}
