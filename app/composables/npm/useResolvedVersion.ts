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

      if (data.version === '0.0.0') {
        throw createError({ statusCode: 404, message: 'Package not found' })
      }

      return data.version
    },
    { default: () => undefined },
  )
}
