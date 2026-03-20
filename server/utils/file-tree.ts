import { flattenFileTree } from '#server/utils/import-resolver'

/**
 * Fetch the file tree from jsDelivr API.
 * Returns a nested tree structure of all files in the package.
 */
export async function fetchFileTree(
  packageName: string,
  version: string,
  signal?: AbortSignal,
): Promise<JsDelivrPackageResponse> {
  const url = `https://data.jsdelivr.com/v1/packages/npm/${packageName}@${version}`
  const response = await fetch(url, { signal })

  if (!response.ok) {
    if (response.status === 404) {
      throw createError({ statusCode: 404, message: 'Package or version not found' })
    }
    throw createError({ statusCode: 502, message: 'Failed to fetch file list from jsDelivr' })
  }

  return response.json()
}

/**
 * Convert jsDelivr nested structure to our PackageFileTree format
 */
export function convertToFileTree(
  nodes: JsDelivrFileNode[],
  parentPath: string = '',
): PackageFileTree[] {
  const result: PackageFileTree[] = []

  for (const node of nodes) {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name

    if (node.type === 'directory') {
      const children = node.files ? convertToFileTree(node.files, path) : []

      result.push({
        name: node.name,
        path,
        type: 'directory',
        size: children.reduce((total, child) => total + (child.size ?? 0), 0),
        children,
      })
    } else {
      result.push({
        name: node.name,
        path,
        type: 'file',
        hash: node.hash,
        size: node.size,
      })
    }
  }

  // Sort: directories first, then files, alphabetically within each group
  result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  return result
}

/**
 * Fetch and convert file tree for a package version.
 * Returns the full response including tree and metadata.
 */
export async function getPackageFileTree(
  packageName: string,
  version: string,
  signal?: AbortSignal,
): Promise<PackageFileTreeResponse> {
  const jsDelivrData = await fetchFileTree(packageName, version, signal)
  const tree = convertToFileTree(jsDelivrData.files)

  return {
    package: packageName,
    version,
    default: jsDelivrData.default ?? undefined,
    tree,
  }
}

export async function fetchPackageWithTypesAndFiles(
  packageName: string,
  version?: string,
): Promise<{
  pkg: AnalysisPackageJson
  typesPackage?: TypesPackageInfo
  files?: Set<string>
}> {
  // Fetch main package data
  const encodedName = encodePackageName(packageName)
  const versionSuffix = version ? `/${version}` : '/latest'

  const pkg = await $fetch<AnalysisPackageJson>(`${NPM_REGISTRY}/${encodedName}${versionSuffix}`)

  let typesPackage: TypesPackageInfo | undefined
  let files: Set<string> | undefined

  // Only attempt to fetch @types + file tree when the package doesn't ship its own types
  if (!hasBuiltInTypes(pkg)) {
    const typesPkgName = getTypesPackageName(packageName)
    const resolvedVersion = pkg.version ?? version ?? 'latest'

    // Fetch both in parallel — they're independent
    const [typesResult, fileTreeResult] = await Promise.allSettled([
      fetchTypesPackageInfo(typesPkgName),
      getPackageFileTree(packageName, resolvedVersion),
    ])

    if (typesResult.status === 'fulfilled') {
      typesPackage = typesResult.value
    }

    if (fileTreeResult.status === 'fulfilled') {
      files = flattenFileTree(fileTreeResult.value.tree)
    }
  }

  return { pkg, typesPackage, files }
}

