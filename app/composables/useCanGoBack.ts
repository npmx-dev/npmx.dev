export function useCanGoBack() {
  const canGoBack = ref(false)

  const router = useRouter()

  onMounted(() => {
    canGoBack.value = router.options.history.state.back !== null
  })

  return canGoBack
}
