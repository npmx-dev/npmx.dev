import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import type { TocItem } from '#shared/types/readme'
import ReadmeTocDropdown from '~/components/ReadmeTocDropdown.vue'

const toc: TocItem[] = [
  { text: 'Installation', id: 'installation', depth: 2 },
  { text: 'Usage', id: 'usage', depth: 2 },
  { text: 'Basic Usage', id: 'basic-usage', depth: 3 },
  { text: 'Options', id: 'options', depth: 4 },
  // Fourth level: in the TOC, but not rendered in the menu
  { text: 'Deep Option', id: 'deep-option', depth: 5 },
  { text: 'API', id: 'api', depth: 2 },
]

let mounted: Awaited<ReturnType<typeof mountSuspended>> | undefined

async function mountDropdown(activeId?: string) {
  mounted = await mountSuspended(ReadmeTocDropdown, {
    props: { toc, activeId },
    attachTo: document.body,
  })
  return mounted
}

function getTrigger(): HTMLElement {
  return document.querySelector<HTMLElement>('button[aria-haspopup="menu"]')!
}

function getMenuItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
}

/** Wait for the open watcher's `nextTick` focus to run. */
async function flushOpen() {
  await nextTick()
  await nextTick()
}

describe('ReadmeTocDropdown', () => {
  afterEach(() => {
    mounted?.unmount()
    mounted = undefined
  })

  it('focuses the last item when ArrowUp opens the menu', async () => {
    await mountDropdown()
    getTrigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    await flushOpen()

    expect(document.activeElement).toBe(getMenuItems().at(-1))
  })

  it('focuses the active heading even when unrendered deeper headings precede it', async () => {
    await mountDropdown('api')
    getTrigger().click()
    await flushOpen()

    expect(document.activeElement?.textContent?.trim()).toBe('API')
  })

  it('closes the menu when the trigger is clicked while focus is inside it', async () => {
    await mountDropdown()
    getTrigger().click()
    await flushOpen()
    expect(getMenuItems()).not.toHaveLength(0)

    // A pointer press moves focus to the trigger before its click fires
    getTrigger().focus()
    getTrigger().click()
    await nextTick()

    expect(getTrigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('returns focus to the trigger when a page scroll closes the menu', async () => {
    await mountDropdown()
    getTrigger().click()
    await flushOpen()
    expect(getMenuItems()).toContain(document.activeElement)

    window.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(document.activeElement).toBe(getTrigger())
  })
})
