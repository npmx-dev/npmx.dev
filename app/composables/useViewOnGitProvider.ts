/**
 * Return the text "see on {git provider}" based on the given provider
 */
export function useViewOnGitProvider(
  provider: MaybeRefOrGetter<ProviderId | (string & {}) | null | undefined>,
) {
  const { t } = useI18n()
  return computed(() => {
    const uProvider = toValue(provider)
    if (!uProvider) {
      return t('common.view_on.git_repo')
    }
    switch (uProvider) {
      case 'github':
        return t('common.view_on.github')
      case 'gitlab':
        return t('common.view_on.gitlab')
      case 'bitbucket':
        return t('common.view_on.bitbucket')
      case 'gitea':
        return t('common.view_on.gitea')
      case 'forgejo':
        return t('common.view_on.forgejo')
      case 'codeberg':
        return t('common.view_on.codeberg')
      case 'sourcehut':
        return t('common.view_on.sourcehut')
      case 'gitee':
        return t('common.view_on.gitee')
      case 'tangled':
        return t('common.view_on.tangled')
      case 'radicle':
        return t('common.view_on.radicle')
      case 'git':
        return t('common.view_on.git_repo')
    }

    if (import.meta.dev) {
      // oxlint-disable-next-line no-console
      console.warn(`missing '${uProvider}' provider, add it to shared/utils/git-providers.ts!`)
    }
    return t('common.view_on.git_repo')
  })
}
