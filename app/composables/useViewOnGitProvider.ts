/**
 * Return the text "see on {git provider}" based on the given provider
 */
export function useViewOnGitProvider(
  provider: MaybeRefOrGetter<ProviderId | (string & {}) | null | undefined>,
) {
  const { t, te } = useI18n()
  return computed(() => {
    const uProvider = toValue(provider)
    if (!uProvider) {
      return t('common.view_on.git_repo')
    }
    const key = `common.view_on.${uProvider}`
    if (te(key)) {
      return t(key)
    }
    // oxlint-disable-next-line no-console
    console.warn(`"common.view_on.${uProvider}" translation doesn't exist`)
    return t('common.view_on.git_repo')
  })
}

/* for i18n report, translations that are currently present:
t('common.view_on.github') 
t('common.view_on.gitlab') 
t('common.view_on.bitbucket') 
t('common.view_on.codeberg')
t('common.view_on.forgejo')
t('common.view_on.gitea')
t('common.view_on.gitee')
t('common.view_on.radicle')
t('common.view_on.sourcehut')
t('common.view_on.tangled')
 */
