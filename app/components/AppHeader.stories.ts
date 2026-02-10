import type { Meta, StoryObj } from '@nuxtjs/storybook'
import AppHeader from './AppHeader.vue'

const meta = {
  component: AppHeader,
  parameters: {
    layout: 'fullscreen',
  },
  globals: {
    viewport: { value: undefined },
  },
} satisfies Meta<typeof AppHeader>

export default meta

export const Default: StoryObj<typeof AppHeader> = {}

export const Mobile: StoryObj<typeof AppHeader> = {
  globals: {
    viewport: { value: 'mobile1' },
  },
}
