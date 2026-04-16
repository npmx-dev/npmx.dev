import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import ButtonBase from './Base.vue'
import ButtonGroup from './Group.vue'

const meta = {
  component: ButtonGroup,
  parameters: {
    docs: {
      source: {
        type: 'dynamic',
        transform: (code: string) =>
          code
            .replace(/<Base\b/g, '<ButtonBase')
            .replace(/<\/Base>/g, '</ButtonBase>')
            .replace(/<Group\b/g, '<ButtonGroup')
            .replace(/<\/Group>/g, '</ButtonGroup>'),
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ButtonGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: {
    docs: {
      source: {
        code: `
        <template>
            <ButtonGroup>
                <ButtonBase>Back</ButtonBase>
                <ButtonBase>Settings</ButtonBase>
                <ButtonBase>Compare</ButtonBase>
            </ButtonGroup>
        </template>
        `,
      },
    },
  },
  render: () => ({
    components: { ButtonBase, ButtonGroup },
    template: `
      <ButtonGroup>
        <ButtonBase>{{ $t('nav.back') }}</ButtonBase>
        <ButtonBase>{{ $t('nav.settings') }}</ButtonBase>
        <ButtonBase>{{ $t('nav.compare') }}</ButtonBase>
      </ButtonGroup>
    `,
  }),
}

export const WithVariants: Story = {
  parameters: {
    docs: {
      source: {
        code: `
        <template>
            <ButtonGroup>
                <ButtonBase variant="primary">Back</ButtonBase>
                <ButtonBase variant="primary">Settings</ButtonBase>
                <ButtonBase variant="primary">Compare</ButtonBase>
            </ButtonGroup>
        </template>
        `,
      },
    },
  },
  render: () => ({
    components: { ButtonBase, ButtonGroup },
    template: `
      <ButtonGroup>
        <ButtonBase variant="primary">{{ $t('nav.back') }}</ButtonBase>
        <ButtonBase variant="primary">{{ $t('nav.settings') }}</ButtonBase>
        <ButtonBase variant="primary">{{ $t('nav.compare') }}</ButtonBase>
      </ButtonGroup>
    `,
  }),
}

export const WithIcons: Story = {
  parameters: {
    docs: {
      source: {
        code: `
        <template>
            <ButtonGroup>
                <ButtonBase variant="secondary" classicon="i-lucide:x">Close</ButtonBase>
                <ButtonBase variant="secondary" classicon="i-lucide:search">Search</ButtonBase>
            </ButtonGroup>
        </template>
        `,
      },
    },
  },
  render: () => ({
    components: { ButtonBase, ButtonGroup },
    template: `
      <ButtonGroup>
        <ButtonBase variant="secondary" classicon="i-lucide:x">{{ $t('common.close') }}</ButtonBase>
        <ButtonBase variant="secondary" classicon="i-lucide:search">{{ $t('filters.search') }}</ButtonBase>
      </ButtonGroup>
    `,
  }),
}
