import type { ResolvedPackageVersion } from 'fast-npm-meta'

export function useResolvedVersion(
  packageName: MaybeRefOrGetter<string>,
  requestedVersion: MaybeRefOrGetter<string | null>,
) {
  return useAsyncData(
    () => `resolved-version:${toValue(packageName)}:${toValue(requestedVersion) ?? 'latest'}`,
    async () => {
      const version = toValue(requestedVersion)
      const name = toValue(packageName)
      const url = version
        ? `https://npm.antfu.dev/${name}@${version}`
        : `https://npm.antfu.dev/${name}`
      const data = await $fetch<ResolvedPackageVersion>(url)
      return data.version
    },
    { default: () => undefined },
  )
}
