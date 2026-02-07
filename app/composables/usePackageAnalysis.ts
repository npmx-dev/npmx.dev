import type { ModuleFormat, TypesStatus, CreatePackageInfo } from '#shared/utils/package-analysis'

export interface PackageAnalysisResponse {
  package: string
  version: string
  moduleFormat: ModuleFormat
  types: TypesStatus
  engines?: {
    node?: string
    npm?: string
  }
  createPackage?: CreatePackageInfo
}

/**
 * Composable for fetching package analysis data (module format, types info, etc.)
 */
export function usePackageAnalysis(
  packageName: MaybeRefOrGetter<string>,
  version?: MaybeRefOrGetter<string | null | undefined>,
) {
  return useLazyFetch<PackageAnalysisResponse>(() => {
    const name = toValue(packageName)
    const ver = toValue(version)
    const base = `/api/registry/analysis/${name}`
    return ver ? `${base}/v/${ver}` : base
  })
}
