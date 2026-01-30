import * as v from 'valibot'
import { PackageFileQuerySchema } from '#shared/schemas/package'
import type { ReadmeResponse } from '#shared/types/readme'
import {
  CACHE_MAX_AGE_ONE_YEAR,
  ERROR_PACKAGE_VERSION_AND_FILE_FAILED,
} from '#shared/utils/constants'

const CACHE_VERSION = 3

// Maximum file size to fetch and highlight (500KB)
const MAX_FILE_SIZE = 500 * 1024

// Languages that benefit from import linking
const IMPORT_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'vue',
  'svelte',
  'astro',
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
    return (await response.json()) as PackageJson
  } catch {
    return null
  }
}

/**
 * Fetch file content from jsDelivr CDN.
 */
async function fetchFileContent(
  packageName: string,
  version: string,
  filePath: string,
): Promise<string> {
  const url = `https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filePath}`
  const response = await fetch(url)

  if (!response.ok) {
    if (response.status === 404) {
      throw createError({ statusCode: 404, message: 'File not found' })
    }
    throw createError({
      statusCode: 502,
      message: 'Failed to fetch file from jsDelivr',
    })
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
  async event => {
    // Parse: [pkg, 'v', version, ...filePath] or [@scope, pkg, 'v', version, ...filePath]
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []

    const { rawPackageName, rawVersion: fullPathAfterV } = parsePackageParams(pkgParamSegments)

    // Since version AND path route are required, we split the remainder
    // fullPathAfterV => "1.2.3/dist/index.mjs"
    const versionSegments = fullPathAfterV?.split('/') ?? []

    if (versionSegments.length < 2) {
      throw createError({
        // TODO: throwing 404 rather than 400 as it's cacheable
        statusCode: 404,
        message: ERROR_PACKAGE_VERSION_AND_FILE_FAILED,
      })
    }

    // The version is the first segment after 'v', and everything else is the file path
    const rawVersion = versionSegments[0]
    const rawFilePath = versionSegments.slice(1).join('/')

    try {
      const { packageName, version, filePath } = v.parse(PackageFileQuerySchema, {
        packageName: rawPackageName,
        version: rawVersion,
        filePath: rawFilePath,
      })

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

      const html = await highlightCode(content, language, {
        dependencies,
        resolveRelative,
      })

      let markdownHtml: ReadmeResponse | undefined
      if (language === 'markdown') {
        // Best-effort: markdown preview is optional; never block code view
        try {
          const packageData = await fetchNpmPackage(rawPackageName)
          const repoInfo = parseRepositoryInfo(packageData.repository)
          markdownHtml = await renderReadmeHtml(content, rawPackageName, repoInfo)
        } catch {
          markdownHtml = undefined
        }
      }

      return {
        package: packageName,
        version,
        path: filePath,
        language,
        content,
        html,
        lines: content.split('\n').length,
        markdownHtml,
      }
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to fetch file content',
      })
    }
  },
  {
    // File content for a specific version never changes - cache permanently
    maxAge: CACHE_MAX_AGE_ONE_YEAR, // 1 year
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `file:v${CACHE_VERSION}:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
