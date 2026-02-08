import type { NpmDownloadCount } from '#shared/types'

export function usePackageDownloads(
  name: MaybeRefOrGetter<string>,
  period: MaybeRefOrGetter<'last-day' | 'last-week' | 'last-month' | 'last-year'> = 'last-week',
) {
  const asyncData = useLazyAsyncData(
    () => `downloads:${toValue(name)}:${toValue(period)}`,
    async ({ $npmApi }, { signal }) => {
      const encodedName = encodePackageName(toValue(name))
      const { data, isStale } = await $npmApi<NpmDownloadCount>(
        `/downloads/point/${toValue(period)}/${encodedName}`,
        { signal },
      )
      return { ...data, isStale }
    },
  )

  if (import.meta.client && asyncData.data.value?.isStale) {
    onMounted(() => {
      asyncData.refresh()
    })
  }

  return asyncData
}
