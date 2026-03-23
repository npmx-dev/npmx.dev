import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import AppFooter from '~/components/AppFooter.vue'
import AppHeader from '~/components/AppHeader.vue'
import About from './about.vue'

const meta = {
  component: About,
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
} satisfies Meta<typeof About>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
