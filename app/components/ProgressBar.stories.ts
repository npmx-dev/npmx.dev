import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import ProgressBar from './ProgressBar.vue'

const meta = {
  component: ProgressBar,
  tags: ['autodocs'],
  argTypes: {
    val: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
  },
  args: {
    val: 82,
    label: 'Completion',
  },
  decorators: [() => ({ template: '<div class="flex w-80"><story /></div>' })],
} satisfies Meta<typeof ProgressBar>

export default meta
type Story = StoryObj<typeof meta>

/** Colour shifts with the value: red → orange → green as it fills. */
export const Default: Story = {}

export const Low: Story = {
  args: { val: 30 },
}

export const Medium: Story = {
  args: { val: 68 },
}

export const High: Story = {
  args: { val: 95 },
}

/** A full bar (100%) gets the strongest "complete" colour. */
export const Complete: Story = {
  args: { val: 100 },
}
