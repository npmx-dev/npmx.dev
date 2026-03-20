import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommandPalette } from '#components'

let commandPalette: ReturnType<typeof useCommandPalette> | null = null
let currentWrapper: Awaited<ReturnType<typeof mountSuspended>> | null = null
let mountTarget: HTMLDivElement | null = null

const CommandPaletteHarness = defineComponent({
  name: 'CommandPaletteHarness',
  props: {
    autoOpen: {
      type: Boolean,
      default: true,
    },
    includeTrigger: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    commandPalette = useCommandPalette()

    onMounted(() => {
      if (props.autoOpen) {
        commandPalette?.open()
      }
    })

    onBeforeUnmount(() => {
      commandPalette?.close()
      commandPalette?.clearPackageContext()
    })

    return () =>
      h('div', [
        props.includeTrigger
          ? h('button', { id: 'palette-trigger', type: 'button' }, 'Open')
          : null,
        h(CommandPalette),
      ])
  },
})

async function flushPalette() {
  await nextTick()
  await nextTick()
}

async function mountPalette(options?: { autoOpen?: boolean; includeTrigger?: boolean }) {
  mountTarget = document.createElement('div')
  document.body.appendChild(mountTarget)

  currentWrapper = await mountSuspended(CommandPaletteHarness, {
    attachTo: mountTarget,
    props: {
      autoOpen: options?.autoOpen ?? true,
      includeTrigger: options?.includeTrigger ?? false,
    },
  })

  await flushPalette()

  return currentWrapper
}

afterEach(() => {
  currentWrapper?.unmount()
  currentWrapper = null
  mountTarget?.remove()
  mountTarget = null
  if (commandPalette) {
    commandPalette.announcement.value = ''
  }
  commandPalette?.close()
  commandPalette?.clearPackageContext()
  useSettings().settings.value.keyboardShortcuts = true
  commandPalette = null
})

describe('CommandPalette', () => {
  it('connects the input to an existing description, live status, and results region', async () => {
    await mountPalette()

    const input = document.getElementById('command-palette-modal-input')
    const description = document.getElementById('command-palette-modal-description')
    const status = document.getElementById('command-palette-modal-status')
    const results = document.getElementById('command-palette-modal-results')

    expect(input).not.toBeNull()
    expect(description?.textContent).toBeTruthy()
    expect(status?.getAttribute('role')).toBe('status')
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(results?.getAttribute('role')).toBe('region')

    expect(input?.getAttribute('aria-describedby')).toContain('command-palette-modal-description')
    expect(input?.getAttribute('aria-describedby')).toContain('command-palette-modal-status')
    expect(input?.getAttribute('aria-controls')).toBe('command-palette-modal-results')
  })

  it('updates the live region when the query changes', async () => {
    await mountPalette()

    const status = document.getElementById('command-palette-modal-status')
    expect(status).not.toBeNull()
    const initialStatus = status?.textContent

    commandPalette!.query.value = 'dark'
    await nextTick()

    expect(status?.textContent).not.toBe(initialStatus)
  })

  it('announces the active subview in the live status region', async () => {
    await mountPalette()

    const status = document.getElementById('command-palette-modal-status')
    expect(status?.textContent).toContain('command palette')

    commandPalette!.setView('languages')
    await flushPalette()
    expect(status?.textContent).toMatch(/Language|choose a language/i)

    commandPalette!.setView('accent-colors')
    await flushPalette()
    expect(status?.textContent).toContain('Accent colors')
  })

  it('updates the input placeholder for palette subviews', async () => {
    await mountPalette()

    const input = document.getElementById('command-palette-modal-input')
    expect(input?.getAttribute('placeholder')).toBe('type a command...')

    commandPalette!.setView('languages')
    await nextTick()
    expect(input?.getAttribute('placeholder')).toBe('Language')

    commandPalette!.setView('accent-colors')
    await nextTick()
    expect(input?.getAttribute('placeholder')).toBe('Accent colors')

    commandPalette!.setView('background-themes')
    await nextTick()
    expect(input?.getAttribute('placeholder')).toBe('Background shade')
  })

  it('renders navigation and external commands as links', async () => {
    await mountPalette()

    const settingsLink = document.querySelector('a[data-command-item="true"][href$="/settings"]')
    const chatLink = document.querySelector(
      'a[data-command-item="true"][href="https://chat.npmx.dev"]',
    )

    expect(settingsLink?.tagName).toBe('A')
    expect(chatLink?.tagName).toBe('A')
    expect(chatLink?.getAttribute('target')).toBe('_blank')
  })

  it('renders color previews for the current accent color and background shade on the root view', async () => {
    await mountPalette()

    const accentPreview = document.querySelector(
      '[data-command-id="accent-colors"] [data-command-preview="true"]',
    )
    const backgroundPreview = document.querySelector(
      '[data-command-id="background-themes"] [data-command-preview="true"]',
    )

    expect(accentPreview).not.toBeNull()
    expect(backgroundPreview).not.toBeNull()
  })

  it('announces setting changes after the palette closes', async () => {
    await mountPalette()

    const relativeDatesCommand = document.querySelector<HTMLElement>(
      '[data-command-id="relative-dates"]',
    )
    const announcer = document.getElementById('command-palette-modal-announcement')

    relativeDatesCommand?.click()
    await flushPalette()

    expect(commandPalette?.isOpen.value).toBe(false)
    expect(announcer?.textContent).toBe('Relative dates on.')
  })

  it('toggles with the global keyboard shortcut only when shortcuts are enabled', async () => {
    const { settings } = useSettings()
    await mountPalette({ autoOpen: false })

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'k' }))
    await flushPalette()

    expect(commandPalette?.isOpen.value).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'k' }))
    await flushPalette()

    expect(commandPalette?.isOpen.value).toBe(false)

    settings.value.keyboardShortcuts = false
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'k' }))
    await flushPalette()

    expect(commandPalette?.isOpen.value).toBe(false)
  })

  it('moves focus through commands with the arrow keys', async () => {
    await mountPalette()

    const input = document.getElementById('command-palette-modal-input')
    const commands = Array.from(
      document.querySelectorAll<HTMLElement>('[data-command-item="true"]'),
    )

    expect(document.activeElement).toBe(input)

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }))
    await nextTick()
    expect(document.activeElement).toBe(commands[0])

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }))
    await nextTick()
    expect(document.activeElement).toBe(commands[1])

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }))
    await nextTick()
    expect(document.activeElement).toBe(commands[0])

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }))
    await nextTick()
    expect(document.activeElement).toBe(input)
  })

  it('returns to the root view with ArrowLeft only when the input is empty', async () => {
    await mountPalette()

    const input = document.getElementById('command-palette-modal-input') as HTMLInputElement | null

    commandPalette!.setView('languages')
    await flushPalette()
    input?.focus()

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' }))
    await flushPalette()
    expect(input?.getAttribute('placeholder')).toBe('type a command...')

    commandPalette!.setView('languages')
    commandPalette!.query.value = 'fr'
    await flushPalette()
    input?.focus()

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' }))
    await flushPalette()
    expect(input?.getAttribute('placeholder')).toBe('Language')
  })

  it('matches commands by their group label', async () => {
    await mountPalette()

    commandPalette!.query.value = 'Settings'
    await flushPalette()

    const commands = Array.from(
      document.querySelectorAll<HTMLElement>('[data-command-item="true"]'),
    )
    const commandIds = commands.map(el => el.getAttribute('data-command-id'))

    expect(commandIds).toContain('relative-dates')
    expect(commandIds).toContain('accent-colors')
    expect(commandIds).toContain('background-themes')
  })

  it('closes on route changes and restores focus to the previous element', async () => {
    await mountPalette({ autoOpen: false, includeTrigger: true })

    const trigger = document.getElementById('palette-trigger') as HTMLButtonElement | null
    trigger?.focus()

    commandPalette!.open()
    await flushPalette()

    expect(commandPalette?.isOpen.value).toBe(true)

    await navigateTo('/settings')
    await vi.waitFor(() => {
      expect(commandPalette?.isOpen.value).toBe(false)
    })
    await flushPalette()

    expect(document.activeElement).toBe(trigger)
  })
})
