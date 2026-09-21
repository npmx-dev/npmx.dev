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

  it('renders only the selected package manager in TerminalExecute', async () => {
    const selectedPackageManager = useSelectedPackageManager()
    selectedPackageManager.value = 'nub'

    const component = await mountSuspended(TerminalExecute, {
      props: { packageName: 'create-vite' },
    })

    const renderedCommands = component.findAll('[data-pm-cmd]')

    expect(renderedCommands).toHaveLength(1)
    expect(renderedCommands[0]?.attributes('data-pm-cmd')).toBe('nub')
    expect(component.text()).toContain('nubx create-vite')
  })

  it('renders only the selected package manager across all TerminalInstall sections', async () => {
    const selectedPackageManager = useSelectedPackageManager()
    selectedPackageManager.value = 'nub'

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
    expect(renderedCommands.every(command => command.attributes('data-pm-cmd') === 'nub')).toBe(
      true,
    )
    expect(component.text()).toContain('nub add vue')
    expect(component.text()).toContain('nub add -D @types/vue')
    expect(component.text()).toContain('nubx vue')
    expect(component.text()).toContain('nub create vue')
  })
})
