import { beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TerminalExecute from '~/components/Terminal/Execute.vue'

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
})
