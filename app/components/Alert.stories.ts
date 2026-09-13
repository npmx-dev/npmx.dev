import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import Alert from './Alert.vue'

const meta = {
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['warning', 'error'],
    },
  },
  args: {
    variant: 'warning',
    title: 'Heads up',
    default: 'Something you might want to know about this package.',
  },
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

/** Non-critical notice, announced politely via `role="status"`. */
export const Warning: Story = {}

/** Critical notice, announced assertively via `role="alert"`. */
export const Error: Story = {
  args: {
    variant: 'error',
    title: 'Something went wrong',
    default: 'We could not load this data. Please try again.',
  },
}

/** The title is optional — the body slot renders on its own. */
export const WithoutTitle: Story = {
  args: {
    title: undefined,
    default: 'A short message with no heading.',
  },
}
