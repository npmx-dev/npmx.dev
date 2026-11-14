export function usePackage(
  name: MaybeRefOrGetter<string>,
  requestedVersion?: MaybeRefOrGetter<string | null>,
) {
  const asyncData = useLazyAsyncData(
    () => `package:${toValue(name)}:${toValue(requestedVersion) ?? ''}`,
    async (_nuxtApp, { signal }) => {
      const encodedName = encodePackageName(toValue(name))
      const reqVer = toValue(requestedVersion)
      // Fetch the already-trimmed packument from our own cached route so the
      // full (often multi-MB) document is never sent to or parsed by the client.
      const pkg = await $fetch<SlimPackument>(`/api/registry/packument/${encodedName}`, {
        signal,
        params: reqVer ? { version: reqVer } : undefined,
      })
      // Staleness is handled server-side by the route's SWR cache, so the
      // response is always considered fresh from the client's perspective.
      return { ...pkg, isStale: false }
    },
  )

  return asyncData
}
