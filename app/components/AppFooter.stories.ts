import type { Meta, StoryObj } from '@nuxtjs/storybook'
import AppFooter from './AppFooter.vue'

const meta = {
  component: AppFooter,
  parameters: {
    layout: 'fullscreen',
  },
  globals: {
    viewport: { value: undefined },
  },
} satisfies Meta<typeof AppFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InContext: Story = {
  render: () => ({
    components: { AppFooter },
    template: `
      <div style="display: flex; flex-direction: column; min-height: 100vh;">
        <div style="flex: 1; padding: 2rem;">
          <h1>Some page content</h1>
          <span>See footer at the bottom</span>
        </div>
        <AppFooter />
      </div>
    `,
  }),
}

export const InLongPage: Story = {
  render: () => ({
    components: { AppFooter },
    template: `
      <div style="display: flex; flex-direction: column; min-height: 100vh;">
        <div style="flex: 1; padding: 2rem;">
          <h1>Footer is all the way at the bottom!</h1> <br />
          ${Array.from({ length: 50 }, (_, i) => `<p key="${i}">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>`).join('')}
        </div>
        <AppFooter />
      </div>
    `,
  }),
}

export const MobileView: Story = {
  ...InContext,
  globals: {
    viewport: { value: 'mobile1' },
  },
}

export const TabletView: Story = {
  ...InContext,
  globals: {
    viewport: { value: 'tablet' },
  },
}
