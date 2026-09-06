import { findMinimumForRange, normalize } from 'verkit'
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

  const minVersion = computed((): string | undefined => {
    const ver = toValue(version)
    if (!ver) return undefined
    const deps = toValue(dependencies)
    if (!deps || Object.keys(deps).length === 0) return undefined
    const min = findMinimumForRange(ver)
    return (min && normalize(min)) || ver
  })

  const {
    data: vulnTree,
    status: vulnStatus,
    error: vulnError,
  } = useDependencyAnalysis(packageName, minVersion)

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
