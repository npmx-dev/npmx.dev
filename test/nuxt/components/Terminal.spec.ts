import { beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TerminalExecute from '~/components/Terminal/Execute.vue'
import TerminalInstall from '~/components/Terminal/Install.vue'

describe('Terminal components', () => {
  beforeEach(() => {
    localStorage.clear()
    const selectedPackageManager = useSelectedPackageManager()
    selectedPackageManager.value = 'npm'
  })

  it.each([
    ['nub', 'nubx create-vite'],
    ['upm', 'upx create-vite'],
  ] as const)('renders only %s in TerminalExecute', async (packageManager, command) => {
    const selectedPackageManager = useSelectedPackageManager()
    selectedPackageManager.value = packageManager

    const component = await mountSuspended(TerminalExecute, {
      props: { packageName: 'create-vite' },
    })

    const renderedCommands = component.findAll('[data-pm-cmd]')

    expect(renderedCommands).toHaveLength(1)
    expect(renderedCommands[0]?.attributes('data-pm-cmd')).toBe(packageManager)
    expect(component.text()).toContain(command)
  })

  it.each([
    ['nub', 'nubx'],
    ['upm', 'upx'],
  ] as const)(
    'renders only %s across all TerminalInstall sections',
    async (packageManager, executeCommand) => {
      const selectedPackageManager = useSelectedPackageManager()
      selectedPackageManager.value = packageManager

      const component = await mountSuspended(TerminalInstall, {
        props: {
          packageName: 'vue',
          typesPackageName: '@types/vue',
          devDependencySuggestion: { recommended: true },
          executableInfo: { hasExecutable: true, primaryCommand: 'vue' },
          createPackageInfo: { packageName: 'create-vue' },
        },
      })

      const renderedCommands = component.findAll('[data-pm-cmd]')

      expect(renderedCommands).toHaveLength(5)
      expect(
        renderedCommands.every(command => command.attributes('data-pm-cmd') === packageManager),
      ).toBe(true)
      expect(component.text()).toContain(`${packageManager} add vue`)
      expect(component.text()).toContain(`${packageManager} add -D @types/vue`)
      expect(component.text()).toContain(`${executeCommand} vue`)
      expect(component.text()).toContain(`${packageManager} create vue`)
    },
  )
})
