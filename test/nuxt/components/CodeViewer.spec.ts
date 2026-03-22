import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CodeViewer from '~/components/Code/Viewer.vue'

const SAMPLE_HTML = '<code><span class="line">const x = 1</span></code>'

describe('CodeViewer', () => {
  it('renders when given html and line count', async () => {
    const wrapper = await mountSuspended(CodeViewer, {
      props: {
        html: SAMPLE_HTML,
        lines: 1,
        selectedLines: null,
        wordWrap: false,
      },
    })

    expect(wrapper.find('pre').exists() || wrapper.html().includes('line')).toBe(true)
  })

  it('applies word-wrap class to pre element when wordWrap prop is true', async () => {
    const wrapper = await mountSuspended(CodeViewer, {
      props: {
        html: SAMPLE_HTML,
        lines: 1,
        selectedLines: null,
        wordWrap: true,
      },
    })

    const html = wrapper.html()
    // When wordWrap is true, the code-lines div should have the 'word-wrap' class
    expect(html).toContain('word-wrap')
  })

  it('does not apply word-wrap class when wordWrap prop is false', async () => {
    const wrapper = await mountSuspended(CodeViewer, {
      props: {
        html: SAMPLE_HTML,
        lines: 1,
        selectedLines: null,
        wordWrap: false,
      },
    })

    const codeLines = wrapper.find('.code-lines')
    // Without word wrap, the code-lines div should NOT have the 'word-wrap' class
    expect(codeLines.classes()).not.toContain('word-wrap')
  })
})
