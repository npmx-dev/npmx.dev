import type { DependencySpec } from '~/utils/npm/package-dependency-sections'

export function usePackageDependencyInsights(
  packageName: MaybeRefOrGetter<string>,
  version: MaybeRefOrGetter<string | null | undefined>,
  dependencies: MaybeRefOrGetter<Record<string, DependencySpec> | undefined>,
) {
  const {
    data: outdatedDeps,
    status: outdatedStatus,
    error: outdatedError,
  } = useOutdatedDependencies(dependencies)

  const {
    data: replacementDeps,
    status: replacementStatus,
    error: replacementError,
  } = useReplacementDependencies(dependencies)

  const {
    data: vulnTree,
    status: vulnStatus,
    error: vulnError,
  } = useDependencyAnalysis(packageName, version)

  const hasError = computed(() => {
    return !!(vulnError.value || outdatedError.value || replacementError.value)
  })

  return {
    outdatedDeps,
    outdatedStatus,
    replacementDeps,
    replacementStatus,
    vulnTree,
    vulnStatus,
    hasError,
    errors: { vulnError, outdatedError, replacementError },
  }
}

export type PackageDependencyInsights = ReturnType<typeof usePackageDependencyInsights>
