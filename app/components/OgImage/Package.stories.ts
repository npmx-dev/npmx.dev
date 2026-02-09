import type { Meta, StoryObj } from '@nuxtjs/storybook'
import Component from './Package.vue'

const meta = {
  component: Component,
  decorators: [
    () => ({
      template: '<div style="width:1200px;height:630px; outline:1px solid red"><story/></div>',
    }),
  ],
} satisfies Meta<typeof Component>

export default meta
type Story = StoryObj<typeof meta>

export const Package: Story = {
  args: { name: 'vue', version: 'latest' },
}
