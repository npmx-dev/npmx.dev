import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CodeViewer from '~/components/Code/Viewer.vue'

const html = [
  '<pre><code>',
  '<span class="line">import { ref } from <a class="import-link" href="#package-vue">"vue"</a></span>',
  '<span class="line">const count = ref(0)</span>',
  '<span class="line">export { count }</span>',
  '</code></pre>',
].join('')

const updatedHtml = html.replace('const count = ref(0)', 'const counter = ref(0)')

async function mountCodeViewer(
  selectedLines: { start: number; end: number } | null = null,
  componentHtml: string = html,
) {
  return mountSuspended(CodeViewer, {
    attachTo: document.body,
    props: {
      html: componentHtml,
      lines: 3,
      selectedLines,
    },
  })
}

function getRenderedCodeLines(wrapper: Awaited<ReturnType<typeof mountCodeViewer>>) {
  const root = wrapper.element as HTMLElement
  return Array.from(root.querySelectorAll('code > .line')) as HTMLElement[]
}

describe('CodeViewer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('renders line numbers, highlights the selected range, and emits clicks', async () => {
    const wrapper = await mountCodeViewer()

    try {
      const lineNumbers = wrapper.findAll('.line-number')
      expect(lineNumbers).toHaveLength(3)
      expect(lineNumbers.map(line => line.text())).toEqual(['1', '2', '3'])
      expect(wrapper.find('.line-numbers').attributes('style')).toContain('--line-digits: 1')

      await wrapper.setProps({ selectedLines: { start: 2, end: 3 } })
      await nextTick()
      await vi.waitFor(() => {
        const codeLines = getRenderedCodeLines(wrapper)
        expect(codeLines[0]?.classList.contains('highlighted')).toBe(false)
        expect(codeLines[1]?.classList.contains('highlighted')).toBe(true)
        expect(codeLines[2]?.classList.contains('highlighted')).toBe(true)
      })

      expect(lineNumbers[0]?.classes()).toContain('text-fg-subtle')
      expect(lineNumbers[1]?.classes()).toContain('bg-yellow-500/20')
      expect(lineNumbers[2]?.classes()).toContain('bg-yellow-500/20')

      await lineNumbers[1]!.trigger('click')
      expect(wrapper.emitted('lineClick')).toHaveLength(1)
      expect(wrapper.emitted('lineClick')?.[0]?.[0]).toBe(2)
      expect(wrapper.emitted('lineClick')?.[0]?.[1]).toBeInstanceOf(MouseEvent)
    } finally {
      wrapper.unmount()
    }
  })

  it('updates highlighted lines when the selected range changes or clears', async () => {
    const wrapper = await mountCodeViewer()

    try {
      await wrapper.setProps({ selectedLines: { start: 1, end: 1 } })
      await nextTick()
      await vi.waitFor(() => {
        expect(getRenderedCodeLines(wrapper)[0]?.classList.contains('highlighted')).toBe(true)
      })

      await wrapper.setProps({ selectedLines: { start: 3, end: 3 } })
      await nextTick()
      await vi.waitFor(() => {
        const codeLines = getRenderedCodeLines(wrapper)
        expect(codeLines[0]?.classList.contains('highlighted')).toBe(false)
        expect(codeLines[1]?.classList.contains('highlighted')).toBe(false)
        expect(codeLines[2]?.classList.contains('highlighted')).toBe(true)
      })

      await wrapper.setProps({ selectedLines: null })
      await nextTick()
      await vi.waitFor(() => {
        getRenderedCodeLines(wrapper).forEach(line => {
          expect(line.classList.contains('highlighted')).toBe(false)
        })
      })
    } finally {
      wrapper.unmount()
    }
  })

  it('routes import-link clicks through vue-router and preserves modifier-assisted navigation', async () => {
    const wrapper = await mountCodeViewer(null, updatedHtml)

    try {
      const router = useRouter()
      const pushSpy = vi.spyOn(router, 'push').mockImplementation(() => Promise.resolve())

      await wrapper.setProps({ html })
      await nextTick()
      const anchor = wrapper.find('a.import-link')
      expect(anchor.exists()).toBe(true)

      const plainClick = new MouseEvent('click', { bubbles: true, cancelable: true })
      anchor.element.dispatchEvent(plainClick)

      expect(plainClick.defaultPrevented).toBe(true)
      expect(pushSpy).toHaveBeenCalledWith('#package-vue')

      const ctrlClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })
      anchor.element.dispatchEvent(ctrlClick)

      expect(ctrlClick.defaultPrevented).toBe(false)
      expect(pushSpy).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
    }
  })

  it('ignores import-link clicks without an href', async () => {
    const router = useRouter()
    const pushSpy = vi.spyOn(router, 'push').mockImplementation(() => Promise.resolve())

    const wrapper = await mountSuspended(CodeViewer, {
      attachTo: document.body,
      props: {
        html: '<pre><code><span class="line"><a class="import-link" href="#placeholder">placeholder</a></span></code></pre>',
        lines: 1,
        selectedLines: null,
      },
    })

    try {
      await wrapper.setProps({
        html: '<pre><code><span class="line"><a class="import-link">missing href</a></span></code></pre>',
      })
      const anchor = wrapper.find('a.import-link')
      await nextTick()
      const click = new MouseEvent('click', { bubbles: true, cancelable: true })
      anchor.element.dispatchEvent(click)

      expect(click.defaultPrevented).toBe(false)
      expect(pushSpy).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })
})
