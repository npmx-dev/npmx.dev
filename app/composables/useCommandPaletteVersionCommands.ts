// @unocss-include
import type { MaybeRefOrGetter } from 'vue'
import type {
  CommandPaletteCommand,
  CommandPaletteContextCommandInput,
  CommandPalettePackageContext,
} from '~/types/command-palette'
import { compare, satisfies, validRange } from 'semver'

function getSortedVersions(context: CommandPalettePackageContext) {
  return [...context.versions].sort((a, b) => {
    if (a === context.resolvedVersion) return -1
    if (b === context.resolvedVersion) return 1
    return compare(b, a)
  })
}

function createVersionCommands(
  context: CommandPalettePackageContext,
  t: ReturnType<typeof useI18n>['t'],
  versions = getSortedVersions(context),
  urlPattern?: string | null,
): CommandPaletteCommand[] {
  return versions.map(version => ({
    id: `version:${version}`,
    group: 'versions' as const,
    label: t('command_palette.version.label', { version }),
    keywords: [context.packageName, version, t('command_palette.groups.versions')],
    iconClass: 'i-lucide:tag',
    active: version === context.resolvedVersion,
    to: urlPattern?.replace('{version}', version) ?? packageRoute(context.packageName, version),
  }))
}

export function useCommandPaletteVersionCommands(
  context: MaybeRefOrGetter<CommandPalettePackageContext | null>,
  urlPattern?: MaybeRefOrGetter<string | null | undefined>,
) {
  const { t } = useI18n()

  useCommandPaletteContextCommands(
    computed((): CommandPaletteContextCommandInput[] => {
      const resolvedContext = toValue(context)
      if (!resolvedContext?.resolvedVersion) return []

      return createVersionCommands(resolvedContext, t, undefined, toValue(urlPattern))
    }),
  )

  useCommandPaletteQueryOverride('versions', query => {
    const resolvedContext = toValue(context)
    if (!resolvedContext?.resolvedVersion || !query) return null

    const semverRange = validRange(query)
    if (!semverRange) return null

    const matchingVersions = getSortedVersions(resolvedContext).filter(version =>
      satisfies(version, semverRange, { includePrerelease: true }),
    )

    return createVersionCommands(resolvedContext, t, matchingVersions, toValue(urlPattern))
  })
}
