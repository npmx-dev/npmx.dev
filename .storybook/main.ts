import type { StorybookConfig } from '@storybook-vue/nuxt'

const config = {
  stories: ['../app/**/*.stories.@(js|ts)'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-themes',
    'storybook-i18n',
  ],
  framework: '@storybook-vue/nuxt',
  staticDirs: ['./.public'],
  features: {
    backgrounds: false,
  },
  async viteFinal(config) {
    config.plugins ??= []

    config.plugins.push({
      name: 'ignore-internals',
      transform(_, id) {
        if (id.includes('/app/pages/blog/') && id.endsWith('.md')) {
          return 'export default {}'
        }
      },
    })

    return config
  },
} satisfies StorybookConfig

export default config
