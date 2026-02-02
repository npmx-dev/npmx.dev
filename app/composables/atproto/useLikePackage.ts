import { FetchError } from 'ofetch'
import { useAtproto } from '~/composables/atproto/useAtproto'
import { handleAuthError } from '~/utils/atproto/helpers'

export function useLikePackage(packageName: string) {
  const { user } = useAtproto()
  const data = ref<PackageLikes | null>(null)
  const error = ref<Error | null>(null)
  const pending = ref(false)

  const mutate = async () => {
    pending.value = true
    error.value = null

    try {
      const result = await $fetch<PackageLikes>('/api/auth/social/like', {
        method: 'POST',
        body: { packageName },
      })

      data.value = result
      return result
    } catch (e) {
      if (e instanceof FetchError) {
        await handleAuthError(e, user.value?.handle)
      }
      error.value = e as Error
    } finally {
      pending.value = false
    }
  }

  return { data, error, pending, mutate }
}
