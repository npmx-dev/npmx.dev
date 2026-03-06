/**
 * Return the text "see on {git provider}" based on the given provider
 */
export function useViewOnGitProvider(
  provider: MaybeRefOrGetter<ProviderId | (string & {}) | null | undefined>,
) {
  const { t, te } = useI18n()
  return computed(() => {
    const uProvider = toValue(provider)
    if (uProvider && te(`common.view_on.${uProvider}`)) {
      // TODO this currently fails i18n:report
      return t(`common.view_on.${uProvider}`)
    }
    return t('common.view_on.git_repo')
  })
}
