import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import Customize from './Customize.vue'

const meta = {
  component: Customize,
  tags: ['autodocs'],
  decorators: [() => ({ template: '<div class="max-w-3xl p-4"><story /></div>' })],
} satisfies Meta<typeof Customize>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Interactive brand logo customizer: pick an accent color and background, then
 * download the result as SVG or PNG.
 */
export const Default: Story = {}
