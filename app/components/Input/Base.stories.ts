import type { Meta, StoryObj } from '@nuxtjs/storybook'
import { expect, fn, userEvent, within } from '@storybook/test'
import Component from './Base.vue'

const meta = {
  component: Component,

  argTypes: {
    disabled: { control: 'boolean' },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
    noCorrect: {
      control: 'boolean',
      description: 'Whether to disable browser autocorrect',
    },
    onFocus: {
      action: 'focus',
      description: 'Fired when the input gains focus',
    },
    onBlur: {
      action: 'blur',
      description: 'Fired when the input loses focus',
    },
  },
} satisfies Meta<typeof Component>

export default meta
type Story = StoryObj<typeof meta>

export const Snapshot: Story = {
  render: () => ({
    template: `
      <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem;">
          <Component size="small" model-value="Small input" />
          <Component size="medium" model-value="Medium input" />
          <Component size="large" model-value="Large input" />
          <Component size="large" model-value="disabled" disabled />
      </div>
    `,
    components: { Component },
  }),
}

export const Event: Story = {
  args: {
    onFocus: fn(),
    onBlur: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox')

    await userEvent.click(input)
    await expect(args.onFocus).toHaveBeenCalled()

    await userEvent.tab()
    await expect(args.onBlur).toHaveBeenCalled()
  },
}

export const Disable: Story = {
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox')

    await expect(input).toBeDisabled()
    await userEvent.click(input)
    await expect(args.onFocus).not.toHaveBeenCalled()
  },
}

export const NoCorrect: Story = {
  args: {
    noCorrect: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox')

    await expect(input).toHaveAttribute('autocapitalize', 'off')
    await expect(input).toHaveAttribute('autocorrect', 'off')
    await expect(input).toHaveAttribute('autocomplete', 'off')
    await expect(input).toHaveAttribute('spellcheck', 'false')
  },
}
