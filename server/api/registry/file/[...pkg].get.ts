const CACHE_VERSION = 2

// Maximum file size to fetch and highlight (500KB)
const MAX_FILE_SIZE = 500 * 1024

// Languages that benefit from import linking
const IMPORT_LANGUAGES = new Set([
  'javascript', 'typescript', 'jsx', 'tsx',
  'vue', 'svelte', 'astro',
])

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

/**
 * Fetch package.json from jsDelivr to get dependency info
 */
async function fetchPackageJson(packageName: string, version: string): Promise<PackageJson | null> {
  try {
    const url = `https://cdn.jsdelivr.net/npm/${packageName}@${version}/package.json`
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json() as PackageJson
  }
  catch {
    return null
  }
}

/**
 * Fetch file content from jsDelivr CDN.
 */
async function fetchFileContent(packageName: string, version: string, filePath: string): Promise<string> {
  const url = `https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filePath}`
  const response = await fetch(url)

  if (!response.ok) {
    if (response.status === 404) {
      throw createError({ statusCode: 404, message: 'File not found' })
    }
    throw createError({ statusCode: 502, message: 'Failed to fetch file from jsDelivr' })
  }

  // Check content-length header if available
  const contentLength = response.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
    throw createError({
      statusCode: 413,
      message: `File too large (${(parseInt(contentLength, 10) / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE / 1024}KB.`,
    })
  }

  const content = await response.text()

  // Double-check size after fetching (in case content-length wasn't set)
  if (content.length > MAX_FILE_SIZE) {
    throw createError({
      statusCode: 413,
      message: `File too large (${(content.length / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE / 1024}KB.`,
    })
  }

  return content
}

/**
 * Returns syntax-highlighted HTML for a file in a package.
 *
 * URL patterns:
 * - /api/registry/file/packageName/v/1.2.3/path/to/file.ts
 * - /api/registry/file/@scope/packageName/v/1.2.3/path/to/file.ts
 */
export default defineCachedEventHandler(
  async (event) => {
    const segments = getRouterParam(event, 'pkg')?.split('/') ?? []
    if (segments.length === 0) {
      throw createError({ statusCode: 400, message: 'Package name, version, and file path are required' })
    }

    // Parse: [pkg, 'v', version, ...filePath] or [@scope, pkg, 'v', version, ...filePath]
    const vIndex = segments.indexOf('v')
    if (vIndex === -1 || vIndex >= segments.length - 2) {
      throw createError({ statusCode: 400, message: 'Version and file path are required' })
    }

    const packageName = segments.slice(0, vIndex).join('/')
    // Find where version ends (next segment after 'v') and file path begins
    // Version could be like "1.2.3" or "1.2.3-beta.1"
    const versionAndPath = segments.slice(vIndex + 1)

    // The version is the first segment after 'v', and everything else is the file path
    const version = versionAndPath[0]
    const filePath = versionAndPath.slice(1).join('/')

    if (!packageName || !version || !filePath) {
      throw createError({ statusCode: 400, message: 'Package name, version, and file path are required' })
    }

    try {
      const content = await fetchFileContent(packageName, version, filePath)
      const language = getLanguageFromPath(filePath)

      // For JS/TS files, resolve dependency versions and relative imports for linking
      let dependencies: Record<string, { version: string }> | undefined
      let resolveRelative: ((specifier: string) => string | null) | undefined

      if (IMPORT_LANGUAGES.has(language)) {
        // Fetch package.json and file tree in parallel
        const [pkgJson, fileTreeResponse] = await Promise.all([
          fetchPackageJson(packageName, version),
          getPackageFileTree(packageName, version).catch(() => null),
        ])

        // Resolve npm dependency versions
        if (pkgJson) {
          // Merge all dependency types
          const allDeps: Record<string, string> = {
            ...pkgJson.dependencies,
            ...pkgJson.peerDependencies,
            ...pkgJson.optionalDependencies,
            // Note: excluding devDependencies as they're less likely to be imported in dist files
          }

          if (Object.keys(allDeps).length > 0) {
            const resolved: Record<string, string> = await resolveDependencyVersions(allDeps)
            dependencies = {}
            for (const [name, ver] of Object.entries(resolved)) {
              dependencies[name] = { version: ver }
            }
          }
        }

        // Create resolver for relative imports
        if (fileTreeResponse) {
          const files = flattenFileTree(fileTreeResponse.tree)
          resolveRelative = createImportResolver(files, filePath, packageName, version)
        }
      }

      const html = await highlightCode(content, language, { dependencies, resolveRelative })

      return {
        package: packageName,
        version,
        path: filePath,
        language,
        content,
        html,
        lines: content.split('\n').length,
      }
    }
    catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw createError({ statusCode: 502, message: 'Failed to fetch file content' })
    }
  },
  {
    maxAge: 60 * 60, // Cache for 1 hour (files don't change for a given version)
    getKey: (event) => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `file:v${CACHE_VERSION}:${pkg}`
    },
  },
)
