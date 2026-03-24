// @unocss-include
import type { MaybeRefOrGetter } from 'vue'
import type {
  CommandPaletteContextCommandInput,
  CommandPalettePackageContext,
} from '~/types/command-palette'
import { downloadPackageTarball } from '~/utils/package-download'

function activeLabel(isCurrentRoute: boolean, label: string) {
  return isCurrentRoute ? label : null
}

export function useCommandPalettePackageCommands(
  context: MaybeRefOrGetter<CommandPalettePackageContext | null>,
) {
  const { t } = useI18n()
  const route = useRoute()

  function isCurrentPackageCompare(packageName: string) {
    const packages = route.query.packages
    if (typeof packages !== 'string') return false

    return packages
      .split(',')
      .map(pkg => pkg.trim())
      .includes(packageName)
  }

  useCommandPaletteContextCommands(
    computed((): CommandPaletteContextCommandInput[] => {
      const resolvedContext = toValue(context)
      if (!resolvedContext?.resolvedVersion) return []

      const splitName = resolvedContext.packageName.split('/')
      const [firstSegment, secondSegment] = splitName
      if (!firstSegment) return []

      const isScopedPackage = splitName.length === 2 && !!secondSegment
      const docsPath: [string, ...string[]] = isScopedPackage
        ? [firstSegment, secondSegment, 'v', resolvedContext.resolvedVersion]
        : [firstSegment, 'v', resolvedContext.resolvedVersion]
      const docsLink = {
        name: 'docs' as const,
        params: {
          path: docsPath,
        },
      }
      const codeLink = {
        name: 'code' as const,
        params: {
          org: isScopedPackage ? firstSegment : undefined,
          packageName: isScopedPackage ? secondSegment : firstSegment,
          version: resolvedContext.resolvedVersion,
          filePath: '',
        },
      }

      const commands: CommandPaletteContextCommandInput[] = [
        {
          id: 'package-main',
          group: 'package',
          label: t('command_palette.package.main'),
          keywords: [resolvedContext.packageName, t('shortcuts.open_main')],
          iconClass: 'i-lucide:package',
          active: ['package', 'package-version'].includes(`${route.name ?? ''}`),
          activeLabel: activeLabel(
            ['package', 'package-version'].includes(`${route.name ?? ''}`),
            t('command_palette.here'),
          ),
          to: packageRoute(resolvedContext.packageName, resolvedContext.resolvedVersion),
        },
        {
          id: 'package-docs',
          group: 'package',
          label: t('command_palette.package.docs'),
          keywords: [resolvedContext.packageName, t('shortcuts.open_docs')],
          iconClass: 'i-lucide:file-text',
          active: route.name === 'docs',
          activeLabel: activeLabel(route.name === 'docs', t('command_palette.here')),
          to: docsLink,
        },
        {
          id: 'package-code',
          group: 'package',
          label: t('command_palette.package.code'),
          keywords: [resolvedContext.packageName, t('shortcuts.open_code_view')],
          iconClass: 'i-lucide:code',
          active: route.name === 'code',
          activeLabel: activeLabel(route.name === 'code', t('command_palette.here')),
          to: codeLink,
        },
        {
          id: 'package-compare',
          group: 'package',
          label: t('command_palette.package.compare'),
          keywords: [resolvedContext.packageName, t('shortcuts.compare_from_package')],
          iconClass: 'i-lucide:git-compare',
          active: route.name === 'compare' && isCurrentPackageCompare(resolvedContext.packageName),
          activeLabel: activeLabel(
            route.name === 'compare' && isCurrentPackageCompare(resolvedContext.packageName),
            t('command_palette.here'),
          ),
          to: {
            name: 'compare',
            query: {
              packages: resolvedContext.packageName,
            },
          },
        },
      ]

      if (resolvedContext.tarballUrl) {
        commands.push({
          id: 'package-download',
          group: 'package',
          label: t('command_palette.package.download'),
          keywords: [
            resolvedContext.packageName,
            t('package.download.button'),
            t('package.download.tarball'),
          ],
          iconClass: 'i-lucide:download',
          action: () => {
            void downloadPackageTarball(resolvedContext.packageName, {
              version: resolvedContext.resolvedVersion!,
              dist: {
                tarball: resolvedContext.tarballUrl!,
              },
            })
          },
        })
      }

      if (
        resolvedContext.latestVersion &&
        resolvedContext.latestVersion !== resolvedContext.resolvedVersion
      ) {
        commands.push({
          id: 'package-diff',
          group: 'package',
          label: t('command_palette.package.diff'),
          keywords: [resolvedContext.packageName, t('shortcuts.open_diff')],
          iconClass: 'i-lucide:git-compare',
          active: route.name === 'diff',
          activeLabel: activeLabel(route.name === 'diff', t('command_palette.here')),
          to: diffRoute(
            resolvedContext.packageName,
            resolvedContext.resolvedVersion!,
            resolvedContext.latestVersion!,
          ),
        })
      }

      return commands
    }),
  )
}
