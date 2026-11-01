import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import Viewer from './Viewer.vue'

// Mimics the markup Shiki emits server-side: a <pre><code> with one
// `.line` span per line. Inline color styles keep the sample self-contained.
const lines = [
  `<span style="color:#F97583">export</span> <span style="color:#F97583">function</span> <span style="color:#B392F0">greet</span><span style="color:#E1E4E8">(</span><span style="color:#FFAB70">name</span><span style="color:#F97583">:</span> <span style="color:#79B8FF">string</span><span style="color:#E1E4E8">) {</span>`,
  `<span style="color:#E1E4E8">  </span><span style="color:#F97583">return</span> <span style="color:#9ECBFF">\`Hello, \${name}!\`</span></span>`,
  `<span style="color:#E1E4E8">}</span>`,
]

const html = `<pre class="shiki"><code>${lines
  .map(line => `<span class="line">${line}</span>`)
  .join('\n')}</code></pre>`

const meta = {
  component: Viewer,
  tags: ['autodocs'],
  args: {
    html,
    lines: lines.length,
    selectedLines: null,
  },
  decorators: [
    () => ({
      template: '<div class="border border-border bg-bg-subtle"><story /></div>',
    }),
  ],
} satisfies Meta<typeof Viewer>

export default meta
type Story = StoryObj<typeof meta>

/** Syntax-highlighted file with line numbers. */
export const Default: Story = {}

/** A range of lines highlighted, as when linking to a permalink. */
export const WithSelectedLines: Story = {
  args: {
    selectedLines: { start: 2, end: 2 },
  },
}
