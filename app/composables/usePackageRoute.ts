/**
 * Parse package name and optional version from the current route URL.
 *
 * Works across every package-scoped route, which use different param shapes:
 *   /package/nuxt                        → org: undefined, name: "nuxt"
 *   /package/@nuxt/kit/v/1.0.0           → org: "@nuxt", name: "kit", version: "1.0.0"
 *   /package-code/@nuxt/kit/v/1.0.0/...  → org: "@nuxt", packageName: "kit", version: "1.0.0"
 *   /package-stats/nuxt/v/4.2.0          → packageName: "nuxt", version: "4.2.0"
 *   /package-timeline/nuxt/v/4.2.0       → packageName: "nuxt", version: "4.2.0"
 *   /package-docs/@nuxt/kit/v/1.0.0      → path: ["@nuxt", "kit", "v", "1.0.0"]
 *
 * Rather than pinning to a single named route, read the live route params and
 * normalise the differing param names (`name` vs `packageName`) and the docs
 * catch-all `path` into a common `{ org, name, version }` shape.
 */
export function usePackageRoute() {
  const route = useRoute()

  const parsed = computed<{ org?: string; name?: string; version: string | null }>(() => {
    const params = route.params as Record<string, string | string[] | undefined>

    // Docs uses a single catch-all `path` param: [org?, name, "v", version?].
    // The package prefix is one segment (unscoped) or two (scoped, "@org/name").
    // A "v" only marks the version when it directly follows that prefix, so a
    // package literally named "v" (e.g. /package-docs/v) isn't mistaken for a
    // version delimiter and a later "v" stays part of the package name.
    if (Array.isArray(params.path)) {
      const segments = params.path.filter(Boolean)
      const scoped = segments[0]?.startsWith('@') ?? false
      const prefixLength = scoped ? 2 : 1
      const org = scoped ? segments[0] : undefined
      const name = segments.slice(scoped ? 1 : 0, prefixLength).join('/')
      const version = segments[prefixLength] === 'v' ? (segments[prefixLength + 1] ?? null) : null
      return { org, name, version }
    }

    const org = typeof params.org === 'string' ? params.org : undefined
    // `package`/`changelog` name their param `name`; `code`/`stats`/`timeline`/`diff`
    // name it `packageName`.
    const name =
      (typeof params.name === 'string' ? params.name : undefined) ??
      (typeof params.packageName === 'string' ? params.packageName : undefined)
    const version = typeof params.version === 'string' ? params.version : null

    return { org, name, version }
  })

  const packageName = computed(() => {
    const { org, name } = parsed.value
    if (!name) return ''
    return org ? `${org}/${name}` : name
  })

  const requestedVersion = computed(() => parsed.value.version)

  const orgName = computed(() => {
    const org = parsed.value.org
    return org ? org.replace(/^@/, '') : null
  })

  return {
    packageName,
    requestedVersion,
    orgName,
  }
}
