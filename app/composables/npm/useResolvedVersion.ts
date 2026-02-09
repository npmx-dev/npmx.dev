import type { ResolvedPackageVersion } from 'fast-npm-meta'

export function useResolvedVersion(
  packageName: MaybeRefOrGetter<string>,
  requestedVersion: MaybeRefOrGetter<string | null>,
) {
  return useFetch(
    () => {
      const version = toValue(requestedVersion)
      return version
        ? `https://npm.antfu.dev/${toValue(packageName)}@${version}`
        : `https://npm.antfu.dev/${toValue(packageName)}`
    },
    {
      transform: (data: ResolvedPackageVersion) => data.version,
    },
  )
}
