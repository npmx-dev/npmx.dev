import type { JsDelivrPackageResponse, JsDelivrFileNode, PackageFileTree, PackageFileTreeResponse } from '#shared/types'

/**
 * Fetch the file tree from jsDelivr API.
 * Returns a nested tree structure of all files in the package.
 */
export async function fetchFileTree(packageName: string, version: string): Promise<JsDelivrPackageResponse> {
  const url = `https://data.jsdelivr.com/v1/packages/npm/${packageName}@${version}`
  const response = await fetch(url)

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
export function convertToFileTree(nodes: JsDelivrFileNode[], parentPath: string = ''): PackageFileTree[] {
  const result: PackageFileTree[] = []

  for (const node of nodes) {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name

    if (node.type === 'directory') {
      result.push({
        name: node.name,
        path,
        type: 'directory',
        children: node.files ? convertToFileTree(node.files, path) : [],
      })
    }
    else {
      result.push({
        name: node.name,
        path,
        type: 'file',
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
export async function getPackageFileTree(packageName: string, version: string): Promise<PackageFileTreeResponse> {
  const jsDelivrData = await fetchFileTree(packageName, version)
  const tree = convertToFileTree(jsDelivrData.files)

  return {
    package: packageName,
    version,
    default: jsDelivrData.default ?? undefined,
    tree,
  }
}
