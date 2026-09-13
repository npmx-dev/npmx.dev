import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import LogoImg from './LogoImg.vue'
import LogoVercel from '~/assets/logos/sponsors/vercel.svg'
import LogoVercelLight from '~/assets/logos/sponsors/vercel-light.svg'
import LogoNuxt from '~/assets/logos/oss-partners/nuxt.svg'

const meta = {
  component: LogoImg,
  tags: ['autodocs'],
  decorators: [() => ({ template: '<div style="height: 36px; width: 160px;"><story /></div>' })],
} satisfies Meta<typeof LogoImg>

export default meta
type Story = StoryObj<typeof meta>

/** A single logo used regardless of theme. */
export const SingleSource: Story = {
  args: {
    src: LogoNuxt,
    alt: 'Nuxt',
  },
}

/** Separate assets swapped between dark and light themes. */
export const DarkAndLight: Story = {
  args: {
    src: {
      dark: LogoVercel,
      light: LogoVercelLight,
    },
    alt: 'Vercel',
  },
}

/**
 * A dark-only asset with `light: 'auto'` — grayscaled and inverted in light
 * mode so a single logo works on both backgrounds.
 */
export const AutoInvert: Story = {
  args: {
    src: {
      dark: LogoNuxt,
      light: 'auto',
    },
    alt: 'Nuxt',
  },
}
