import type { StorybookConfig } from '@storybook-vue/nuxt'

const config = {
  stories: [
    // List welcome first in sidebar
    '../app/storybook/welcome.mdx',
    '../app/**/*.@(mdx|stories.@(js|ts))',
  ],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-themes',
    'storybook-i18n',
    'msw-storybook-addon',
  ],
  framework: {
    name: '@storybook-vue/nuxt',
    options: { docgen: { plugin: 'vue-component-meta', tsconfig: '.nuxt/tsconfig.app.json' } },
  },
  staticDirs: ['./.public', { from: '../public', to: '/' }],
  features: {
    backgrounds: false,
  },
  async viteFinal(newConfig) {
    newConfig.plugins ??= []

    newConfig.plugins.push({
      name: 'ignore-internals',
      transform(_, id) {
        if (id.includes('/app/pages/blog/') && id.endsWith('.md')) {
          return 'export default {}'
        }
      },
    })
    return newConfig
  },
} satisfies StorybookConfig

export default config
