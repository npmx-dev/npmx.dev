// @unocss-include

import type {
  CommandPaletteCommand,
  CommandPaletteCommandGroup,
  CommandPaletteGroup,
} from '~/types/command-palette'
import { useFuse } from '@vueuse/integrations/useFuse'

const GROUP_ORDER: CommandPaletteGroup[] = [
  'actions',
  'language',
  'package',
  'navigation',
  'connections',
  'links',
  'settings',
  'help',
  'npmx',
  'versions',
]

export function useCommandPaletteCommands() {
  const { t } = useI18n()
  const {
    close,
    packageContext,
    query,
    view,
    contextCommands,
    queryOverrides,
    resolveContextCommandAction,
    resolveQueryOverride,
  } = useCommandPalette()

  function closeThen(run: () => void | Promise<void>) {
    return async () => {
      close()
      await run()
    }
  }

  function groupLabel(group: CommandPaletteGroup): string {
    const packageName = packageContext.value?.packageName

    switch (group) {
      case 'actions':
        return t('command_palette.groups.actions')
      case 'help':
        return t('command_palette.groups.help')
      case 'language':
        return t('command_palette.groups.language')
      case 'package':
        return packageName
          ? t('command_palette.groups.package_with_name', { name: packageName })
          : t('command_palette.groups.package')
      case 'navigation':
        return t('command_palette.groups.navigation')
      case 'connections':
        return t('command_palette.groups.connections')
      case 'links':
        return t('command_palette.groups.links')
      case 'settings':
        return t('nav.settings')
      case 'npmx':
        return t('command_palette.groups.npmx')
      case 'versions':
        return packageName
          ? t('command_palette.groups.versions_with_name', { name: packageName })
          : t('command_palette.groups.versions')
    }
  }

  async function submitSearchQuery() {
    const trimmedQuery = query.value.trim()
    if (!trimmedQuery) return

    close()
    await navigateTo({
      name: 'search',
      query: {
        q: trimmedQuery,
      },
    })
  }

  const trimmedQuery = computed(() => query.value.trim())
  const { globalCommands, viewDefinitions } = useCommandPaletteGlobalCommands()
  const currentViewDefinition = computed(() =>
    view.value === 'root' ? null : viewDefinitions.value[view.value],
  )
  const rootSearchCommands = computed<CommandPaletteCommand[]>(() =>
    Object.values(viewDefinitions.value).flatMap(definition => definition.rootSearchCommands ?? []),
  )

  const registeredCommands = computed<CommandPaletteCommand[]>(() =>
    contextCommands.value.flatMap(entry =>
      entry.commands.map((command): CommandPaletteCommand => {
        if (command.to != null) {
          return { ...command, to: command.to }
        }

        if (command.href != null) {
          return { ...command, href: command.href }
        }

        return {
          ...command,
          action: closeThen(async () => {
            const action = resolveContextCommandAction(command.actionId)
            if (action) {
              await action()
            }
          }),
        }
      }),
    ),
  )

  const rootViewCommands = computed<CommandPaletteCommand[]>(() => [
    ...globalCommands.value,
    ...registeredCommands.value,
  ])
  const trailingSearchCommand = computed<CommandPaletteCommand | null>(() => {
    if (view.value !== 'root' || !trimmedQuery.value) return null

    return {
      id: 'search-query',
      group: 'actions' as const,
      label: t('command_palette.actions.search_for', { query: trimmedQuery.value }),
      keywords: [t('search.title_packages'), t('search.label'), trimmedQuery.value],
      iconClass: 'i-lucide:search',
      action: submitSearchQuery,
    }
  })

  const commands = computed(() => {
    const base =
      view.value !== 'root'
        ? (currentViewDefinition.value?.commands ?? [])
        : trimmedQuery.value
          ? [
              ...rootViewCommands.value.filter(command => command.id !== 'search'),
              ...rootSearchCommands.value,
            ]
          : rootViewCommands.value

    return base.map(command =>
      Object.assign(command, {
        keywords: [...command.keywords, groupLabel(command.group)],
      }),
    )
  })

  const { results } = useFuse(trimmedQuery, commands, {
    fuseOptions: {
      keys: ['label', 'keywords'],
      threshold: 0.3,
      ignoreLocation: true,
      ignoreDiacritics: true,
    },
    matchAllWhenSearchEmpty: true,
  })

  const matchedCommands = computed(() => {
    const availableGroups = new Set(commands.value.map(command => command.group))
    let nextCommands = results.value.map(result => result.item)

    queryOverrides.value.forEach(({ scopeId, group }) => {
      if (!availableGroups.has(group)) return

      const resolve = resolveQueryOverride(scopeId, group)
      if (!resolve) return
      const overrideCommands = resolve(trimmedQuery.value)
      if (overrideCommands == null) return
      overrideCommands.forEach(command => {
        if (command.action != null) {
          command.action = closeThen(command.action)
        }
      })
      nextCommands = [
        ...nextCommands.filter(command => command.group !== group),
        ...overrideCommands,
      ]
    })

    return nextCommands
  })
  const trailingCommands = computed<CommandPaletteCommand[]>(() =>
    trailingSearchCommand.value ? [trailingSearchCommand.value] : [],
  )
  const groupedCommands = computed<CommandPaletteCommandGroup[]>(() =>
    GROUP_ORDER.map(group => {
      const items = matchedCommands.value.filter(command => command.group === group)

      return {
        id: group,
        label: groupLabel(group),
        items,
      }
    }).filter(group => group.items.length > 0),
  )

  const flatCommands = computed(() => [
    ...groupedCommands.value.flatMap(group => group.items),
    ...trailingCommands.value,
  ])

  return {
    groupedCommands,
    flatCommands,
    trailingCommands,
    hasResults: computed(() => flatCommands.value.length > 0),
    viewMeta: computed(() => ({
      canGoBack: view.value !== 'root',
      placeholder: currentViewDefinition.value?.placeholder ?? t('command_palette.placeholder'),
      subtitle: currentViewDefinition.value?.subtitle ?? t('command_palette.subtitle'),
    })),
    submitSearchQuery,
    trimmedQuery,
  }
}
