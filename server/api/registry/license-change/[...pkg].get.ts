interface LicenseChangeRecord {
  from: string
  to: string
}

interface NpmRegistryVersion {
  version: string
  license?: string
}

interface NpmRegistryResponse {
  time: Record<string, string>
  versions: Record<string, NpmRegistryVersion>
}

export default defineCachedEventHandler(
  async event => {
    // 1. Extract the package name from the catch-all parameter
    const rawPkg = getRouterParam(event, 'pkg')
    if (!rawPkg) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Package name is required',
      })
    }
    const query = getQuery(event)
    const version = query.version || 'latest'

    const packageName = decodeURIComponent(rawPkg).replace(/\/+$/, '').trim()

    try {
      // 2. Fetch the "Packument" on the server
      // This stays on the server, so the client never downloads this massive JSON
      const data = await $fetch<NpmRegistryResponse>(`https://registry.npmjs.org/${packageName}`)

      if (!data.versions || !data.time) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Package metadata not found',
        })
      }
      // 3. Process the logic
      const versions = Object.values(data.versions)

      // Sort versions chronologically using the 'time' object
      versions.sort((a, b) => {
        const timeA = new Date(data.time[a.version] as string).getTime()
        const timeB = new Date(data.time[b.version] as string).getTime()
        return timeA - timeB
      })
      let change: LicenseChangeRecord | null = null

      const currentVersionIndex =
        version === 'latest' ? versions.length - 1 : versions.findIndex(v => v.version === version)

      const previousVersionIndex = currentVersionIndex - 1
      const currentLicense = String(versions[currentVersionIndex]?.license || 'UNKNOWN')
      const previousLicense = String(versions[previousVersionIndex]?.license || 'UNKNOWN')

      if (currentLicense !== previousLicense) {
        change = {
          from: previousLicense as string,
          to: currentLicense as string,
        }
      }
      return { change }
    } catch (error: any) {
      throw createError({
        statusCode: error.statusCode || 500,
        statusMessage: `Failed to fetch license data: ${error.message}`,
      })
    }
  },
  {
    // 5. Cache Configuration
    maxAge: 60 * 60, // time in seconds
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      const query = getQuery(event)

      // 1. remove the /'s from the package name
      const cleanPkg = pkg.replace(/\/+$/, '').trim()

      // 2. Get the version (default to 'latest' if not provided)
      const version = query.version || 'latest'

      // 3. Create a unique string such that it takes into account the pckage name and version
      // sample result: "license-change:v1:faker:2.1.15"
      return `license-change:v2:${cleanPkg}:${version}`
    },
  },
)
