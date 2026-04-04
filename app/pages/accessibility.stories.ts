import Accessibility from './accessibility.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import AppHeader from '~/components/AppHeader.vue'
import AppFooter from '~/components/AppFooter.vue'

const meta = {
  component: Accessibility,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    () => ({
      components: { AppHeader, AppFooter },
      template: `
        <div class="min-h-screen flex flex-col bg-bg text-fg">
          <AppHeader :show-logo="true" />
          <div id="main-content" class="flex-1 flex flex-col" tabindex="-1">
            <story />
          </div>
          <AppFooter />
        </div>
      `,
    }),
  ],
} satisfies Meta<typeof Accessibility>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
