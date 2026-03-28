import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref, watchEffect, type Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { downloadPackageTarball } from '~/utils/package-download'
import type {
  CommandPaletteCommand,
  CommandPaletteCommandGroup,
  CommandPaletteContextCommandInput,
  CommandPalettePackageContext,
  CommandPaletteView,
} from '~/types/command-palette'

vi.mock('~/utils/package-download', () => ({
  downloadPackageTarball: vi.fn(),
}))

const mockConnectorState = ref<{
  connected: boolean
  npmUser: string | null
}>({
  connected: false,
  npmUser: null,
})

const mockAtprotoHandle = ref<string | null>(null)
const mockDisconnectNpm = vi.fn()
const mockLogout = vi.fn(async () => {})

mockNuxtImport('useConnector', () => {
  return () => ({
    isConnected: computed(() => mockConnectorState.value.connected),
    npmUser: computed(() => mockConnectorState.value.npmUser),
    disconnect: mockDisconnectNpm,
  })
})

mockNuxtImport('useAtproto', () => {
  return () => ({
    user: computed(() => (mockAtprotoHandle.value ? { handle: mockAtprotoHandle.value } : null)),
    logout: mockLogout,
  })
})

async function captureCommandPalette(options?: {
  route?: string
  query?: string
  colorMode?: 'system' | 'light' | 'dark'
  view?: CommandPaletteView
  npmUser?: string | null
  atprotoHandle?: string | null
  packageContext?: CommandPalettePackageContext | null
  versionUrlPattern?: string
  contextCommands?: CommandPaletteContextCommandInput[]
}) {
  const groupedCommands = ref<CommandPaletteCommandGroup[]>([]) as Ref<CommandPaletteCommandGroup[]>
  const flatCommands = ref<CommandPaletteCommand[]>([]) as Ref<CommandPaletteCommand[]>
  const routePath = ref('') as Ref<string>
  let submitSearchQuery!: () => Promise<void>

  mockConnectorState.value = {
    connected: !!options?.npmUser,
    npmUser: options?.npmUser ?? null,
  }
  mockAtprotoHandle.value = options?.atprotoHandle ?? null

  const WrapperComponent = defineComponent({
    setup() {
      const { query, setPackageContext, clearPackageContext, setView } = useCommandPalette()
      const colorMode = useColorMode()
      const route = useRoute()

      colorMode.preference = options?.colorMode ?? 'system'
      setView(options?.view ?? 'root')
      query.value = options?.query ?? ''

      if (options?.packageContext) {
        setPackageContext(options.packageContext)
        useCommandPalettePackageCommands(() => options.packageContext ?? null)
        useCommandPaletteVersionCommands(
          () => options.packageContext ?? null,
          () => options.versionUrlPattern,
        )
      } else {
        clearPackageContext()
      }

      if (options?.contextCommands) {
        useCommandPaletteContextCommands(options.contextCommands)
      }

      const commands = useCommandPaletteCommands()
      submitSearchQuery = commands.submitSearchQuery

      watchEffect(() => {
        groupedCommands.value = commands.groupedCommands.value
        flatCommands.value = commands.flatCommands.value
        routePath.value = route.fullPath
      })

      return () => h('div')
    },
  })

  const wrapper = await mountSuspended(WrapperComponent, {
    route: options?.route ?? '/',
  })

  return {
    wrapper,
    groupedCommands,
    flatCommands,
    routePath,
    submitSearchQuery,
  }
}

afterEach(() => {
  const commandPalette = useCommandPalette()
  commandPalette.close()
  commandPalette.clearPackageContext()
  commandPalette.contextCommands.value = []
  commandPalette.queryOverrides.value = []
  mockConnectorState.value = {
    connected: false,
    npmUser: null,
  }
  mockAtprotoHandle.value = null
  vi.clearAllMocks()
})

describe('useCommandPaletteCommands', () => {
  it('includes synchronous built-in, link, and settings commands', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette()

    expect(groupedCommands.value.map(group => group.id)).toEqual([
      'navigation',
      'connections',
      'settings',
      'help',
      'npmx',
    ])
    expect(flatCommands.value.find(command => command.id === 'search')?.label).toBe('Search')
    expect(flatCommands.value.find(command => command.id === 'language')?.label).toBe('Language')
    expect(flatCommands.value.find(command => command.id === 'keyboard-shortcuts')?.group).toBe(
      'help',
    )
    expect(flatCommands.value.find(command => command.id === 'help-docs-link')).toBeTruthy()
    expect(flatCommands.value.find(command => command.id === 'chat-link')?.group).toBe('help')
    expect(flatCommands.value.find(command => command.id === 'npmx-chat-link')?.group).toBe('npmx')
    expect(flatCommands.value.find(command => command.id === 'builders-chat-link')?.group).toBe(
      'npmx',
    )
    expect(flatCommands.value.find(command => command.id === 'about')?.group).toBe('npmx')
    expect(flatCommands.value.find(command => command.id === 'blog')?.group).toBe('npmx')
    expect(flatCommands.value.find(command => command.id === 'privacy')?.group).toBe('npmx')
    expect(flatCommands.value.find(command => command.id === 'accessibility')?.group).toBe('npmx')
    expect(flatCommands.value.find(command => command.id === 'settings')?.to).toEqual({
      name: 'settings',
    })
    expect(flatCommands.value.find(command => command.id === 'chat-link')?.href).toBe(
      'https://chat.npmx.dev',
    )
    expect(flatCommands.value.find(command => command.id === 'relative-dates')?.badge).toBe('off')
    expect(flatCommands.value.find(command => command.id === 'settings')?.label).toBe('settings')
    expect(flatCommands.value.find(command => command.id === 'theme-system')?.active).toBe(true)
    expect(flatCommands.value.find(command => command.id === 'theme-dark')).toBeTruthy()
    expect(flatCommands.value.find(command => command.id === 'accent-colors')?.badge).toBe(
      'Neutral',
    )
    expect(flatCommands.value.find(command => command.id === 'background-themes')?.badge).toBe(
      'Neutral',
    )

    wrapper.unmount()
  })

  it('filters commands locally with Fuse', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      query: 'dark',
    })

    expect(groupedCommands.value.some(group => group.id === 'settings')).toBe(true)
    expect(flatCommands.value.some(command => command.id === 'theme-dark')).toBe(true)

    wrapper.unmount()
  })

  it('surfaces matching locale commands on the root palette', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      query: 'français',
    })

    expect(groupedCommands.value.map(group => group.id)).toContain('language')
    expect(flatCommands.value.find(command => command.id === 'root-locale:fr-FR')?.label).toBe(
      'Language: Français',
    )

    wrapper.unmount()
  })

  it('matches commands with diacritics when the query omits them', async () => {
    const { wrapper, flatCommands } = await captureCommandPalette({
      query: 'francais',
    })

    expect(flatCommands.value.some(command => command.id === 'root-locale:fr-FR')).toBe(true)

    wrapper.unmount()
  })

  it('adds package commands and keeps versions grouped last', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      route: '/package/vue',
      packageContext: {
        packageName: 'vue',
        resolvedVersion: '3.4.0',
        latestVersion: '3.5.0',
        versions: ['3.3.0', '3.5.0', '3.4.0'],
        tarballUrl: 'https://registry.npmjs.org/vue/-/vue-3.4.0.tgz',
      },
    })

    expect(groupedCommands.value.map(group => group.id)).toEqual([
      'package',
      'navigation',
      'connections',
      'settings',
      'help',
      'npmx',
      'versions',
    ])
    expect(flatCommands.value.find(command => command.id === 'package-diff')).toBeTruthy()
    expect(flatCommands.value.find(command => command.id === 'package-download')).toBeTruthy()
    expect(flatCommands.value.find(command => command.id === 'package-main')?.to).toBeTruthy()
    expect(groupedCommands.value.at(-1)?.id).toBe('versions')
    expect(groupedCommands.value.at(-1)?.items[0]?.id).toBe('version:3.4.0')
    expect(groupedCommands.value.at(-1)?.items[0]?.active).toBe(true)

    wrapper.unmount()
  })

  it('submits the current query to the search page', async () => {
    const { wrapper, routePath, submitSearchQuery } = await captureCommandPalette({
      query: 'webpack',
    })

    await submitSearchQuery()

    await vi.waitFor(() => {
      expect(routePath.value).toBe('/search?q=webpack')
    })

    wrapper.unmount()
  })

  it('wires the package download action to the tarball helper and closes the palette', async () => {
    const { wrapper, flatCommands } = await captureCommandPalette({
      route: '/package/vue',
      packageContext: {
        packageName: 'vue',
        resolvedVersion: '3.4.0',
        latestVersion: '3.5.0',
        versions: ['3.3.0', '3.5.0', '3.4.0'],
        tarballUrl: 'https://registry.npmjs.org/vue/-/vue-3.4.0.tgz',
      },
    })
    const commandPalette = useCommandPalette()
    commandPalette.open()

    await flatCommands.value.find(command => command.id === 'package-download')?.action?.()

    expect(downloadPackageTarball).toHaveBeenCalledWith('vue', {
      version: '3.4.0',
      dist: {
        tarball: 'https://registry.npmjs.org/vue/-/vue-3.4.0.tgz',
      },
    })
    expect(commandPalette.isOpen.value).toBe(false)

    wrapper.unmount()
  })

  it('adds npm account commands and disconnect support when npm is connected', async () => {
    const { wrapper, flatCommands } = await captureCommandPalette({
      route: '/~alice/orgs',
      npmUser: 'alice',
    })
    const commandPalette = useCommandPalette()
    commandPalette.open()

    expect(flatCommands.value.find(command => command.id === 'npm-disconnect')).toBeTruthy()
    expect(flatCommands.value.find(command => command.id === 'my-packages')?.to).toEqual({
      name: '~username',
      params: {
        username: 'alice',
      },
    })
    expect(flatCommands.value.find(command => command.id === 'my-orgs')?.active).toBe(true)

    await flatCommands.value.find(command => command.id === 'npm-disconnect')?.action?.()

    expect(mockDisconnectNpm).toHaveBeenCalledTimes(1)
    expect(commandPalette.isOpen.value).toBe(false)

    wrapper.unmount()
  })

  it('adds atproto account commands and disconnect support when a profile is connected', async () => {
    const { wrapper, flatCommands } = await captureCommandPalette({
      route: '/profile/alice.bsky.social',
      atprotoHandle: 'alice.bsky.social',
    })
    const commandPalette = useCommandPalette()
    commandPalette.open()

    expect(flatCommands.value.find(command => command.id === 'atproto-disconnect')).toBeTruthy()
    expect(flatCommands.value.find(command => command.id === 'my-profile')?.active).toBe(true)

    await flatCommands.value.find(command => command.id === 'atproto-disconnect')?.action?.()

    expect(mockLogout).toHaveBeenCalledTimes(1)
    expect(commandPalette.isOpen.value).toBe(false)

    wrapper.unmount()
  })

  it('filters only version commands when the query is a valid semver range', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      route: '/package/vue',
      query: '^3.4.0',
      packageContext: {
        packageName: 'vue',
        resolvedVersion: '3.4.2',
        latestVersion: '4.0.0',
        versions: ['4.0.0', '3.5.0', '3.4.2', '3.3.0'],
      },
    })

    expect(flatCommands.value.find(command => command.id === 'search')).toBeTruthy()
    expect(
      groupedCommands.value.find(group => group.id === 'versions')?.items.map(item => item.id),
    ).toEqual(['version:3.4.2', 'version:3.5.0'])
    expect(flatCommands.value.find(command => command.id === 'version:3.4.2')?.label).toBe('3.4.2')

    wrapper.unmount()
  })

  it('keeps version navigation on the current surface when a version URL pattern is provided', async () => {
    const { wrapper, flatCommands, routePath } = await captureCommandPalette({
      route: '/package-code/vue/v/3.4.2/src/index.ts',
      packageContext: {
        packageName: 'vue',
        resolvedVersion: '3.4.2',
        latestVersion: '4.0.0',
        versions: ['4.0.0', '3.5.0', '3.4.2'],
      },
      versionUrlPattern: '/package-code/vue/v/{version}/src/index.ts',
    })

    const versionCommand = flatCommands.value.find(command => command.id === 'version:3.5.0')

    expect(versionCommand && 'to' in versionCommand).toBe(true)
    if (!versionCommand || !('to' in versionCommand)) {
      throw new Error('Expected version command to use `to` navigation')
    }

    await navigateTo(versionCommand.to)

    await vi.waitFor(() => {
      expect(routePath.value).toBe('/package-code/vue/v/3.5.0/src/index.ts')
    })

    wrapper.unmount()
  })

  it('keeps the search action available when a query is present', async () => {
    const { wrapper, flatCommands } = await captureCommandPalette({
      query: 'webpack',
    })

    expect(flatCommands.value.find(command => command.id === 'search')).toBeTruthy()
    expect(flatCommands.value.at(-1)?.id).toBe('search')
    expect(flatCommands.value.at(-1)?.label).toBe('Search for "webpack"')

    wrapper.unmount()
  })

  it('shows language commands on the language subpage', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      view: 'languages',
    })

    expect(groupedCommands.value.map(group => group.id)).toEqual(['language', 'links'])
    expect(flatCommands.value.find(command => command.id === 'language-help-translate')?.href).toBe(
      'https://i18n.npmx.dev/',
    )
    expect(flatCommands.value.some(command => command.id.startsWith('locale:'))).toBe(true)

    wrapper.unmount()
  })

  it('does not inject version overrides into unrelated palette subviews', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      view: 'languages',
      query: '^3.4.0',
      packageContext: {
        packageName: 'vue',
        resolvedVersion: '3.4.2',
        latestVersion: '4.0.0',
        versions: ['4.0.0', '3.5.0', '3.4.2', '3.3.0'],
      },
    })

    expect(groupedCommands.value.map(group => group.id)).not.toContain('versions')
    expect(flatCommands.value.some(command => command.id.startsWith('version:'))).toBe(false)

    wrapper.unmount()
  })

  it('shows accent color commands on the accent color subpage', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      view: 'accent-colors',
    })

    expect(groupedCommands.value.map(group => group.id)).toEqual(['settings'])
    expect(flatCommands.value.find(command => command.id === 'accent-color:neutral')?.active).toBe(
      true,
    )
    expect(flatCommands.value.find(command => command.id === 'accent-color:coral')).toBeTruthy()

    wrapper.unmount()
  })

  it('shows background theme commands on the background theme subpage', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      view: 'background-themes',
    })

    expect(groupedCommands.value.map(group => group.id)).toEqual(['settings'])
    expect(
      flatCommands.value.find(command => command.id === 'background-theme:neutral')?.active,
    ).toBe(true)
    expect(flatCommands.value.find(command => command.id === 'background-theme:stone')).toBeTruthy()

    wrapper.unmount()
  })

  it('includes registered page context commands', async () => {
    const action = vi.fn()
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      contextCommands: [
        {
          id: 'context-copy',
          group: 'package',
          label: 'Copy thing',
          keywords: ['thing'],
          iconClass: 'i-lucide:copy',
          action,
        },
      ],
    })

    expect(groupedCommands.value.map(group => group.id)).toContain('package')

    await flatCommands.value.find(command => command.id === 'context-copy')?.action!()
    expect(action).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('builds scoped package links and detects compare routes with multiple packages', async () => {
    const { wrapper, flatCommands } = await captureCommandPalette({
      route: '/compare?packages=react,%20@scope/pkg',
      packageContext: {
        packageName: '@scope/pkg',
        resolvedVersion: '1.0.0',
        latestVersion: '2.0.0',
        versions: ['2.0.0', '1.0.0'],
      },
    })

    expect(flatCommands.value.find(command => command.id === 'package-compare')?.active).toBe(true)
    expect(flatCommands.value.find(command => command.id === 'package-code')?.to).toEqual({
      name: 'code',
      params: {
        org: '@scope',
        packageName: 'pkg',
        version: '1.0.0',
        filePath: '',
      },
    })
    expect(flatCommands.value.find(command => command.id === 'package-docs')?.to).toEqual({
      name: 'docs',
      params: {
        path: ['@scope', 'pkg', 'v', '1.0.0'],
      },
    })

    wrapper.unmount()
  })

  it('omits diff and download commands when package metadata does not support them', async () => {
    const { wrapper, flatCommands } = await captureCommandPalette({
      route: '/package/vue',
      packageContext: {
        packageName: 'vue',
        resolvedVersion: '3.5.0',
        latestVersion: '3.5.0',
        versions: ['3.5.0'],
      },
    })

    expect(flatCommands.value.find(command => command.id === 'package-download')).toBeUndefined()
    expect(flatCommands.value.find(command => command.id === 'package-diff')).toBeUndefined()

    wrapper.unmount()
  })
})
