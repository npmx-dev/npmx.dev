export function useCanGoBack() {
  const canGoBack = ref(false)

  if (import.meta.client) {
    const router = useRouter()
    canGoBack.value = router.options.history.state.back !== null
  }

  return canGoBack
}
