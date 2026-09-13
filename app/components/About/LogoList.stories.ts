import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import LogoList from './LogoList.vue'
import { SPONSORS } from '~/assets/logos/sponsors'
import { OSS_PARTNERS } from '~/assets/logos/oss-partners'

const meta = {
  component: LogoList,
  tags: ['autodocs'],
} satisfies Meta<typeof LogoList>

export default meta
type Story = StoryObj<typeof meta>

/** Sponsor logos laid out in the wide grid used on the about page. */
export const Sponsors: Story = {
  args: {
    list: SPONSORS.gold,
  },
  render: args => ({
    components: { LogoList },
    setup() {
      return { args }
    },
    template: `<LogoList v-bind="args" class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 grid-flow-row-dense" />`,
  }),
}

/**
 * OSS partners use a denser grid and include a grouped entry, which renders
 * with the bracketed container spanning multiple columns.
 */
export const OssPartners: Story = {
  args: {
    list: OSS_PARTNERS,
  },
  render: args => ({
    components: { LogoList },
    setup() {
      return { args }
    },
    template: `<LogoList v-bind="args" class="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-4 grid-flow-row-dense" />`,
  }),
}
