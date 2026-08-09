import * as v from 'valibot'
import { getLatestVersion } from 'fast-npm-meta'
import { flattenFileTree } from '#server/utils/import-resolver'
import { fetchPackageMetadata, readPackageResponseText } from '#server/utils/package-files'
import { ERROR_FILE_LIST_FETCH_FAILED } from '#shared/utils/constants'
import type { ExtendedPackageJson, TypesPackageInfo } from '#shared/utils/package-analysis'

const FileSizeSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0))
const MAX_UNPKG_METADATA_BYTES = 10 * 1024 * 1024
const MAX_UNPKG_FILE_COUNT = 50_000
const MAX_UNPKG_PATH_DEPTH = 100
const MAX_UNPKG_TOTAL_PATH_SEGMENTS = 250_000

const JsDelivrFileNodeSchema: v.GenericSchema<JsDelivrFileNode> = v.lazy(() =>
  v.object({
    type: v.picklist(['file', 'directory']),
    name: v.pipe(v.string(), v.nonEmpty()),
    hash: v.optional(v.string()),
    size: v.optional(FileSizeSchema),
    files: v.optional(v.array(JsDelivrFileNodeSchema)),
  }),
)

const JsDelivrPackageResponseSchema: v.GenericSchema<JsDelivrPackageResponse> = v.object({
  type: v.literal('npm'),
  name: v.pipe(v.string(), v.nonEmpty()),
  version: v.pipe(v.string(), v.nonEmpty()),
  default: v.optional(v.nullable(v.string())),
  files: v.array(JsDelivrFileNodeSchema),
})

const UnpkgFilePathSchema = v.pipe(
  v.string(),
  v.check(path => {
    if (!path.startsWith('/') || path.includes('\\')) return false
    const segments = path.slice(1).split('/')
    return (
      segments.length > 0 &&
      segments.length <= MAX_UNPKG_PATH_DEPTH &&
      segments.every(segment => segment && !['.', '..'].includes(segment))
    )
  }),
)

const UnpkgFileMetadataSchema: v.GenericSchema<UnpkgFileMetadata> = v.object({
  path: UnpkgFilePathSchema,
  size: FileSizeSchema,
  type: v.pipe(v.string(), v.nonEmpty()),
  integrity: v.pipe(
    v.string(),
    v.check(value => value.startsWith('sha256-') && value.length > 'sha256-'.length),
  ),
})

const UnpkgMetadataResponseSchema: v.GenericSchema<UnpkgMetadataResponse> = v.object({
  package: v.pipe(v.string(), v.nonEmpty()),
  version: v.pipe(v.string(), v.nonEmpty()),
  prefix: v.literal('/'),
  files: v.pipe(v.array(UnpkgFileMetadataSchema), v.maxLength(MAX_UNPKG_FILE_COUNT)),
})

interface MutableDirectoryNode {
  type: 'directory'
  name: string
  files: Map<string, MutableTreeNode>
}

interface MutableFileNode {
  type: 'file'
  name: string
  hash: string
  size: number
}

type MutableTreeNode = MutableDirectoryNode | MutableFileNode

function materializeNodes(nodes: Map<string, MutableTreeNode>): JsDelivrFileNode[] {
  return Array.from(nodes.values(), node => {
    if (node.type === 'file') return node
    return {
      type: 'directory',
      name: node.name,
      files: materializeNodes(node.files),
    }
  })
}

export function convertUnpkgToFileTree(files: UnpkgFileMetadata[]): PackageFileTree[] {
  const root = new Map<string, MutableTreeNode>()
  let totalPathSegments = 0

  for (const file of files) {
    const segments = file.path.slice(1).split('/')
    totalPathSegments += segments.length
    if (totalPathSegments > MAX_UNPKG_TOTAL_PATH_SEGMENTS) {
      throw new Error('Package file tree exceeds the complexity limit')
    }
    const fileName = segments.pop()!
    let current = root

    for (const segment of segments) {
      const existing = current.get(segment)
      if (existing?.type === 'file') throw new Error('File path conflicts with a directory')

      const directory = existing ?? {
        type: 'directory' as const,
        name: segment,
        files: new Map<string, MutableTreeNode>(),
      }
      current.set(segment, directory)
      current = directory.files
    }

    if (current.has(fileName)) throw new Error('Duplicate package file path')
    current.set(fileName, {
      type: 'file',
      name: fileName,
      hash: file.integrity.slice('sha256-'.length),
      size: file.size,
    })
  }

  return convertToFileTree(materializeNodes(root))
}

function invalidFileListError() {
  return createError({ statusCode: 502, message: ERROR_FILE_LIST_FETCH_FAILED })
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
  const { provider, response } = await fetchPackageMetadata(packageName, version, signal)

  if (!response.ok) {
    if (provider === 'jsdelivr' && response.status === 404) {
      throw createError({ statusCode: 404, message: 'Package or version not found' })
    }
    throw invalidFileListError()
  }

  let payload: unknown
  try {
    payload =
      provider === 'unpkg'
        ? JSON.parse(await readPackageResponseText(response, MAX_UNPKG_METADATA_BYTES))
        : await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw invalidFileListError()
  }

  if (provider === 'unpkg') {
    const parsed = v.safeParse(UnpkgMetadataResponseSchema, payload)
    if (!parsed.success || parsed.output.package !== packageName) {
      throw invalidFileListError()
    }

    try {
      return {
        package: packageName,
        version,
        tree: convertUnpkgToFileTree(parsed.output.files),
      }
    } catch {
      throw invalidFileListError()
    }
  }

  const parsed = v.safeParse(JsDelivrPackageResponseSchema, payload)
  if (!parsed.success || parsed.output.name !== packageName) {
    throw invalidFileListError()
  }

  return {
    package: packageName,
    version,
    default: parsed.output.default ?? undefined,
    tree: convertToFileTree(parsed.output.files),
  }
}

/**
 * Fetch @types package info including deprecation status using fast-npm-meta.
 * Returns undefined if the package doesn't exist.
 */
async function fetchTypesPackageInfo(packageName: string): Promise<TypesPackageInfo | undefined> {
  const result = await getLatestVersion(packageName, { metadata: true, throw: false })
  if ('error' in result) {
    return undefined
  }
  return {
    packageName,
    deprecated: result.deprecated,
  }
}

interface AnalysisPackageJson extends ExtendedPackageJson {
  readme?: string
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
