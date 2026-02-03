import type { NpmDownloadCount } from '#shared/types'
import { NPM_API } from '~/utils/npm/common'

export function usePackageDownloads(
  name: MaybeRefOrGetter<string>,
  period: MaybeRefOrGetter<'last-day' | 'last-week' | 'last-month' | 'last-year'> = 'last-week',
) {
  const cachedFetch = useCachedFetch()

  const asyncData = useLazyAsyncData(
    () => `downloads:${toValue(name)}:${toValue(period)}`,
    async (_nuxtApp, { signal }) => {
      const encodedName = encodePackageName(toValue(name))
      const { data, isStale } = await cachedFetch<NpmDownloadCount>(
        `${NPM_API}/downloads/point/${toValue(period)}/${encodedName}`,
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
