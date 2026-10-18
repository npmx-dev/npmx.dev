import { beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TerminalExecute from '~/components/Terminal/Execute.vue'

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
})
