/**
 * Return the text "see on {git provider}" based on the given provider
 */
export function useViewOnGitProvider(
  provider: MaybeRefOrGetter<ProviderId | (string & {}) | null | undefined>,
) {
  const { t, te } = useI18n()
  return computed(() => {
    const uProvider = toValue(provider)
    const key = `common.view_on.${uProvider}`
    if (uProvider && te(key)) {
      return t(key)
    }
    return t('common.view_on.git_repo')
  })
}
