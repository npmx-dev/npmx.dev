import { DISCORD_BUILDERS_URL, DISCORD_COMMUNITY_URL } from '#shared/utils/constants'

/**
 * Returns the Discord invite URL and translated labels based on the current build environment.
 *
 * - `release` (npmx.dev) links to the **community** Discord.
 * - All other environments (`canary`, `preview`, `dev`) link to the **builders** Discord.
 */
export function useDiscordLink() {
  const { env } = useAppConfig().buildInfo
  const { t } = useI18n()

  return computed(() =>
    env !== 'release'
      ? {
          url: DISCORD_BUILDERS_URL,
          label: t('footer.builders_chat'),
          title: t('about.get_involved.builders.title'),
          description: t('about.get_involved.builders.description'),
          cta: t('about.get_involved.builders.cta'),
        }
      : {
          url: DISCORD_COMMUNITY_URL,
          label: t('footer.chat'),
          title: t('about.get_involved.community.title'),
          description: t('about.get_involved.community.description'),
          cta: t('about.get_involved.community.cta'),
        },
  )
}
