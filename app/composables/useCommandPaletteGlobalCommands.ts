// @unocss-include
import type { CommandPaletteCommand, CommandPaletteView } from '~/types/command-palette'
import {
  DISCORD_BUILDERS_URL,
  DISCORD_COMMUNITY_URL,
  NPMX_DOCS_SITE,
} from '#shared/utils/constants'

interface UseCommandPaletteGlobalCommandsOptions {
  submitSearchQuery: () => Promise<void>
}

type CommandPaletteSubview = Exclude<CommandPaletteView, 'root'>

interface CommandPaletteViewDefinition {
  commands: CommandPaletteCommand[]
  placeholder: string
  rootSearchCommands?: CommandPaletteCommand[]
  subtitle: string
}

function addSearchKeyword(keywords: Set<string>, keyword: string | null) {
  if (!keyword) return

  const trimmedValue = keyword.trim()
  if (!trimmedValue) return

  keywords.add(trimmedValue)
}

function getLocaleDisplayName(displayLocale: string, code: string) {
  try {
    return new Intl.DisplayNames([displayLocale], { type: 'language' }).of(code) ?? null
  } catch {
    return null
  }
}

function getLocaleSearchKeywords(
  code: string,
  label: string,
  activeLocale: string,
  t: ReturnType<typeof useI18n>['t'],
) {
  const keywords = new Set<string>()
  const baseCode = code.split('-')[0] ?? code

  addSearchKeyword(keywords, code)
  addSearchKeyword(keywords, baseCode)
  addSearchKeyword(keywords, label)
  addSearchKeyword(keywords, t('settings.language'))

  addSearchKeyword(keywords, getLocaleDisplayName(activeLocale, code))
  addSearchKeyword(keywords, getLocaleDisplayName('en', code))
  addSearchKeyword(keywords, getLocaleDisplayName(code, code))

  if (code !== baseCode) addSearchKeyword(keywords, getLocaleDisplayName(activeLocale, baseCode))
  if (code !== baseCode) addSearchKeyword(keywords, getLocaleDisplayName('en', baseCode))
  if (code !== baseCode) addSearchKeyword(keywords, getLocaleDisplayName(baseCode, baseCode))

  return [...keywords]
}

function activeLabel(isCurrentRoute: boolean, label: string) {
  return isCurrentRoute ? label : null
}

function withRootSearchLabel(command: CommandPaletteCommand, label: string): CommandPaletteCommand {
  return {
    ...command,
    id: `root-${command.id}`,
    label,
  }
}

export function useCommandPaletteGlobalCommands({
  submitSearchQuery,
}: UseCommandPaletteGlobalCommandsOptions) {
  const { locale, locales, setLocale, t } = useI18n()
  const route = useRoute()
  const colorMode = useColorMode()
  const { accentColors, selectedAccentColorOptionId, setAccentColor } = useAccentColor()
  const { backgroundThemes, selectedBackgroundThemeOptionId, setBackgroundTheme } =
    useBackgroundTheme()
  const connectorModal = useModal('connector-modal')
  const authModal = useModal('auth-modal')
  const keyboardShortcutsModal = useModal('keyboard-shortcuts-modal')
  const { settings } = useSettings()
  const { isConnected: isNpmConnected, npmUser, disconnect: disconnectNpm } = useConnector()
  const { user: atprotoUser, logout } = useAtproto()
  const { announce, close, setView } = useCommandPalette()

  function closeThen(run: () => void | Promise<void>) {
    return async () => {
      close()
      await run()
    }
  }

  function runThenAnnounce(run: () => void | Promise<void>, getMessage: () => string) {
    return async () => {
      await run()
      close()
      announce(getMessage())
    }
  }

  const currentLocaleLabel = computed(() => {
    const current = locales.value.find(entry =>
      typeof entry === 'string' ? entry === locale.value : entry.code === locale.value,
    )

    if (!current) return locale.value
    return typeof current === 'string' ? current : (current.name ?? current.code)
  })
  const currentAccentColorLabel = computed(() => {
    const activeAccentColorId = selectedAccentColorOptionId.value
    const activeAccentColor = accentColors.value.find(color => color.id === activeAccentColorId)

    if (!activeAccentColor) return activeAccentColorId
    return activeAccentColor.id === 'neutral'
      ? t('settings.accent_colors.neutral')
      : activeAccentColor.label
  })
  const currentAccentColorPreview = computed(() => {
    const activeAccentColorId = selectedAccentColorOptionId.value
    return accentColors.value.find(color => color.id === activeAccentColorId)?.value ?? null
  })
  const currentBackgroundThemeLabel = computed(() => {
    const activeBackgroundThemeId = selectedBackgroundThemeOptionId.value
    return (
      backgroundThemes.value.find(theme => theme.id === activeBackgroundThemeId)?.label ??
      activeBackgroundThemeId
    )
  })
  const currentBackgroundThemePreview = computed(() => {
    const activeBackgroundThemeId = selectedBackgroundThemeOptionId.value
    return backgroundThemes.value.find(theme => theme.id === activeBackgroundThemeId)?.value ?? null
  })
  const localeCommands = computed<CommandPaletteCommand[]>(() =>
    locales.value.map(entry => {
      const code = typeof entry === 'string' ? entry : entry.code
      const label = typeof entry === 'string' ? entry : (entry.name ?? entry.code)

      return {
        id: `locale:${code}`,
        group: 'language' as const,
        label,
        keywords: getLocaleSearchKeywords(code, label, locale.value, t),
        iconClass: 'i-lucide:languages',
        active: code === locale.value,
        activeLabel: code === locale.value ? t('command_palette.current') : null,
        action: runThenAnnounce(
          async () => {
            await setLocale(code)
          },
          () =>
            t('command_palette.announcements.language_changed', {
              language: label,
            }),
        ),
      }
    }),
  )
  const accentColorCommands = computed<CommandPaletteCommand[]>(() => {
    const activeAccentColorId = selectedAccentColorOptionId.value

    return accentColors.value.map(color => ({
      id: `accent-color:${color.id}`,
      group: 'settings' as const,
      label: color.id === 'neutral' ? t('settings.clear_accent') : color.label,
      keywords: [color.label, color.id, t('settings.accent_colors.label'), t('settings.theme')],
      iconClass: 'i-lucide:palette',
      previewColor: color.value,
      active: color.id === activeAccentColorId,
      activeLabel: color.id === activeAccentColorId ? t('command_palette.current') : null,
      action: runThenAnnounce(
        () => {
          setAccentColor(color.id)
        },
        () =>
          t('command_palette.announcements.accent_color_changed', {
            color: color.id === 'neutral' ? t('settings.clear_accent') : color.label,
          }),
      ),
    }))
  })
  const backgroundThemeCommands = computed<CommandPaletteCommand[]>(() => {
    const activeBackgroundThemeId = selectedBackgroundThemeOptionId.value

    return backgroundThemes.value.map(theme => ({
      id: `background-theme:${theme.id}`,
      group: 'settings' as const,
      label: theme.label,
      keywords: [theme.label, theme.id, t('settings.background_themes.label'), t('settings.theme')],
      iconClass: 'i-lucide:swatch-book',
      previewColor: theme.value,
      active: theme.id === activeBackgroundThemeId,
      activeLabel: theme.id === activeBackgroundThemeId ? t('command_palette.current') : null,
      action: runThenAnnounce(
        () => {
          setBackgroundTheme(theme.id)
        },
        () =>
          t('command_palette.announcements.background_theme_changed', {
            theme: theme.label,
          }),
      ),
    }))
  })

  const globalCommands = computed<CommandPaletteCommand[]>(() => {
    const items: CommandPaletteCommand[] = [
      {
        id: 'search',
        group: 'navigation',
        label: t('command_palette.actions.search'),
        keywords: [t('search.title_packages'), t('search.label')],
        iconClass: 'i-lucide:search',
        action: submitSearchQuery,
      },
      {
        id: 'keyboard-shortcuts',
        group: 'help',
        label: t('command_palette.actions.keyboard_shortcuts'),
        keywords: [t('footer.keyboard_shortcuts'), t('shortcuts.show_kbd_hints')],
        iconClass: 'i-lucide:command',
        action: closeThen(() => {
          keyboardShortcutsModal.open()
        }),
      },
      {
        id: 'language',
        group: 'settings',
        label: t('settings.language'),
        keywords: [t('settings.sections.language'), currentLocaleLabel.value, locale.value],
        iconClass: 'i-lucide:languages',
        badge: currentLocaleLabel.value,
        action: async () => {
          setView('languages')
        },
      },
      {
        id: 'relative-dates',
        group: 'settings',
        label: t('settings.relative_dates'),
        keywords: [t('settings.sections.display'), t('package.stats.published')],
        iconClass: 'i-lucide:calendar-days',
        badge: settings.value.relativeDates
          ? t('command_palette.state.on')
          : t('command_palette.state.off'),
        action: runThenAnnounce(
          () => {
            settings.value.relativeDates = !settings.value.relativeDates
          },
          () =>
            settings.value.relativeDates
              ? t('command_palette.announcements.relative_dates_on')
              : t('command_palette.announcements.relative_dates_off'),
        ),
      },
      {
        id: 'home',
        group: 'navigation',
        label: t('command_palette.navigation.home'),
        keywords: [t('header.home')],
        iconClass: 'i-lucide:house',
        active: route.name === 'index',
        activeLabel: activeLabel(route.name === 'index', t('command_palette.here')),
        to: { name: 'index' },
      },
      {
        id: 'compare',
        group: 'navigation',
        label: t('nav.compare'),
        keywords: [t('shortcuts.compare')],
        iconClass: 'i-lucide:git-compare',
        active: route.name === 'compare',
        activeLabel: activeLabel(route.name === 'compare', t('command_palette.here')),
        to: { name: 'compare' },
      },
      {
        id: 'settings',
        group: 'navigation',
        label: t('nav.settings'),
        keywords: [t('shortcuts.settings')],
        iconClass: 'i-lucide:settings',
        active: route.name === 'settings',
        activeLabel: activeLabel(route.name === 'settings', t('command_palette.here')),
        to: { name: 'settings' },
      },
      {
        id: 'about',
        group: 'npmx',
        label: t('footer.about'),
        keywords: [t('footer.about')],
        iconClass: 'i-lucide:info',
        active: route.name === 'about',
        activeLabel: activeLabel(route.name === 'about', t('command_palette.here')),
        to: { name: 'about' },
      },
      {
        id: 'blog',
        group: 'npmx',
        label: t('footer.blog'),
        keywords: [t('blog.title')],
        iconClass: 'i-lucide:notebook-pen',
        active: `${route.name ?? ''}`.startsWith('blog'),
        activeLabel: activeLabel(
          `${route.name ?? ''}`.startsWith('blog'),
          t('command_palette.here'),
        ),
        to: { name: 'blog' },
      },
      {
        id: 'privacy',
        group: 'npmx',
        label: t('privacy_policy.title'),
        keywords: [t('privacy_policy.title')],
        iconClass: 'i-lucide:shield-check',
        active: route.name === 'privacy',
        activeLabel: activeLabel(route.name === 'privacy', t('command_palette.here')),
        to: { name: 'privacy' },
      },
      {
        id: 'accessibility',
        group: 'npmx',
        label: t('a11y.title'),
        keywords: [t('a11y.footer_title')],
        iconClass: 'i-custom:a11y',
        active: route.name === 'accessibility',
        activeLabel: activeLabel(route.name === 'accessibility', t('command_palette.here')),
        to: { name: 'accessibility' },
      },
      {
        id: 'npm-connection',
        group: 'connections',
        label:
          isNpmConnected.value && npmUser.value
            ? t('command_palette.connections.npm_connected', { username: npmUser.value })
            : t('command_palette.connections.npm_connect'),
        keywords: [t('account_menu.npm_cli')],
        iconClass: 'i-lucide:terminal',
        badge: isNpmConnected.value ? t('command_palette.connected') : null,
        action: closeThen(() => {
          connectorModal.open()
        }),
      },
      {
        id: 'atproto-connection',
        group: 'connections',
        label: atprotoUser.value?.handle
          ? t('command_palette.connections.atmosphere_connected', {
              handle: atprotoUser.value.handle,
            })
          : t('command_palette.connections.atmosphere_connect'),
        keywords: [t('account_menu.atmosphere')],
        iconClass: 'i-lucide:at-sign',
        badge: atprotoUser.value ? t('command_palette.connected') : null,
        action: closeThen(() => {
          authModal.open()
        }),
      },
      {
        id: 'help-docs-link',
        group: 'help',
        label: t('footer.docs'),
        keywords: [t('footer.docs')],
        iconClass: 'i-lucide:file-text',
        href: NPMX_DOCS_SITE,
      },
      {
        id: 'chat-link',
        group: 'help',
        label: t('footer.chat'),
        keywords: [t('footer.chat')],
        iconClass: 'i-lucide:message-circle',
        href: DISCORD_COMMUNITY_URL,
      },
      {
        id: 'docs-link',
        group: 'npmx',
        label: t('footer.docs'),
        keywords: [t('footer.docs')],
        iconClass: 'i-lucide:file-text',
        href: NPMX_DOCS_SITE,
      },
      {
        id: 'npmx-chat-link',
        group: 'npmx',
        label: t('footer.chat'),
        keywords: [t('footer.chat')],
        iconClass: 'i-lucide:message-circle',
        href: DISCORD_COMMUNITY_URL,
      },
      {
        id: 'builders-chat-link',
        group: 'npmx',
        label: t('footer.builders_chat'),
        keywords: [t('footer.builders_chat')],
        iconClass: 'i-lucide:message-circle',
        href: DISCORD_BUILDERS_URL,
      },
      {
        id: 'source-link',
        group: 'npmx',
        label: t('footer.source'),
        keywords: [t('footer.source')],
        iconClass: 'i-simple-icons:github',
        href: 'https://repo.npmx.dev',
      },
      {
        id: 'social-link',
        group: 'npmx',
        label: t('footer.social'),
        keywords: [t('footer.social')],
        iconClass: 'i-simple-icons:bluesky',
        href: 'https://social.npmx.dev',
      },
      {
        id: 'theme-system',
        group: 'settings',
        label: t('command_palette.theme.system'),
        keywords: [t('settings.theme_system'), t('settings.theme')],
        iconClass: 'i-lucide:monitor',
        active: colorMode.preference === 'system',
        action: runThenAnnounce(
          () => {
            colorMode.preference = 'system'
          },
          () =>
            t('command_palette.announcements.theme_changed', {
              theme: t('settings.theme_system'),
            }),
        ),
      },
      {
        id: 'theme-light',
        group: 'settings',
        label: t('command_palette.theme.light'),
        keywords: [t('settings.theme_light'), t('settings.theme')],
        iconClass: 'i-lucide:sun',
        active: colorMode.preference === 'light',
        action: runThenAnnounce(
          () => {
            colorMode.preference = 'light'
          },
          () =>
            t('command_palette.announcements.theme_changed', {
              theme: t('settings.theme_light'),
            }),
        ),
      },
      {
        id: 'theme-dark',
        group: 'settings',
        label: t('command_palette.theme.dark'),
        keywords: [t('settings.theme_dark'), t('settings.theme')],
        iconClass: 'i-lucide:moon',
        active: colorMode.preference === 'dark',
        action: runThenAnnounce(
          () => {
            colorMode.preference = 'dark'
          },
          () =>
            t('command_palette.announcements.theme_changed', {
              theme: t('settings.theme_dark'),
            }),
        ),
      },
      {
        id: 'accent-colors',
        group: 'settings',
        label: t('settings.accent_colors.label'),
        keywords: [
          t('settings.accent_colors.label'),
          currentAccentColorLabel.value,
          t('settings.theme'),
        ],
        iconClass: 'i-lucide:palette',
        badge: currentAccentColorLabel.value,
        previewColor: currentAccentColorPreview.value,
        action: async () => {
          setView('accent-colors')
        },
      },
      {
        id: 'background-themes',
        group: 'settings',
        label: t('settings.background_themes.label'),
        keywords: [
          t('settings.background_themes.label'),
          currentBackgroundThemeLabel.value,
          t('settings.theme'),
        ],
        iconClass: 'i-lucide:swatch-book',
        badge: currentBackgroundThemeLabel.value,
        previewColor: currentBackgroundThemePreview.value,
        action: async () => {
          setView('background-themes')
        },
      },
    ]

    const npmUsername = npmUser.value
    if (isNpmConnected.value && npmUsername) {
      items.push(
        {
          id: 'npm-disconnect',
          group: 'connections',
          label: t('command_palette.connections.npm_disconnect'),
          keywords: [
            npmUsername,
            t('command_palette.connections.npm_connected', { username: npmUsername }),
          ],
          iconClass: 'i-lucide:plug-zap',
          action: closeThen(() => {
            disconnectNpm()
          }),
        },
        {
          id: 'my-packages',
          group: 'navigation',
          label: t('command_palette.navigation.packages', { username: npmUsername }),
          keywords: [npmUsername, t('header.packages')],
          iconClass: 'i-lucide:boxes',
          active: route.name === '~username' && route.params.username?.toString() === npmUsername,
          activeLabel: activeLabel(
            route.name === '~username' && route.params.username?.toString() === npmUsername,
            t('command_palette.here'),
          ),
          to: {
            name: '~username',
            params: {
              username: npmUsername,
            },
          },
        },
        {
          id: 'my-orgs',
          group: 'navigation',
          label: t('command_palette.navigation.orgs', { username: npmUsername }),
          keywords: [npmUsername, t('header.orgs')],
          iconClass: 'i-lucide:users',
          active:
            route.name === '~username-orgs' && route.params.username?.toString() === npmUsername,
          activeLabel: activeLabel(
            route.name === '~username-orgs' && route.params.username?.toString() === npmUsername,
            t('command_palette.here'),
          ),
          to: {
            name: '~username-orgs',
            params: {
              username: npmUsername,
            },
          },
        },
      )
    }

    const atprotoProfile = atprotoUser.value
    if (atprotoProfile != null) {
      items.push(
        {
          id: 'atproto-disconnect',
          group: 'connections',
          label: t('command_palette.connections.atmosphere_disconnect'),
          keywords: [
            atprotoProfile.handle,
            t('command_palette.connections.atmosphere_connected', {
              handle: atprotoProfile.handle,
            }),
          ],
          iconClass: 'i-lucide:log-out',
          action: closeThen(async () => {
            await logout()
          }),
        },
        {
          id: 'my-profile',
          group: 'navigation',
          label: t('command_palette.navigation.profile', { handle: atprotoProfile.handle }),
          keywords: [atprotoProfile.handle, t('account_menu.atmosphere')],
          iconClass: 'i-lucide:user',
          active:
            route.name === 'profile-identity' &&
            route.params.identity?.toString() === atprotoProfile.handle,
          activeLabel: activeLabel(
            route.name === 'profile-identity' &&
              route.params.identity?.toString() === atprotoProfile.handle,
            t('command_palette.here'),
          ),
          to: {
            name: 'profile-identity',
            params: {
              identity: atprotoProfile.handle,
            },
          },
        },
      )
    }

    return items
  })

  const viewDefinitions = computed<Record<CommandPaletteSubview, CommandPaletteViewDefinition>>(
    () => ({
      'languages': {
        commands: [
          ...localeCommands.value,
          {
            id: 'language-help-translate',
            group: 'links',
            label: t('command_palette.actions.help_translate'),
            keywords: [t('settings.help_translate'), t('settings.language')],
            iconClass: 'i-lucide:languages',
            href: 'https://i18n.npmx.dev/',
          },
        ],
        placeholder: t('settings.language'),
        rootSearchCommands: localeCommands.value.map(command =>
          withRootSearchLabel(command, `${t('settings.language')}: ${command.label}`),
        ),
        subtitle: t('command_palette.subtitle_languages'),
      },
      'accent-colors': {
        commands: accentColorCommands.value,
        placeholder: t('settings.accent_colors.label'),
        subtitle: t('settings.accent_colors.label'),
      },
      'background-themes': {
        commands: backgroundThemeCommands.value,
        placeholder: t('settings.background_themes.label'),
        subtitle: t('settings.background_themes.label'),
      },
    }),
  )

  return {
    globalCommands,
    viewDefinitions,
  }
}
