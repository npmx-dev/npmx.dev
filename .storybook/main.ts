import type { StorybookConfig } from '@storybook-vue/nuxt'

const config = {
  stories: ['../app/**/*.stories.@(js|ts)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs', '@storybook/addon-themes'],
  framework: '@storybook-vue/nuxt',
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
    // Replace the built-in vue-docgen plugin with a fault-tolerant version.
    // vue-docgen-api can crash on components that import types from other
    // .vue files (it tries to parse the SFC with @babel/parser as plain TS).
    // This wrapper catches those errors so the build doesn't fail.
    const docgenPlugin = config.plugins?.find(
      (p): p is Extract<typeof p, { name: string }> =>
        !!p && typeof p === 'object' && 'name' in p && p.name === 'storybook:vue-docgen-plugin',
    )

    if (docgenPlugin && 'transform' in docgenPlugin) {
      const hook = docgenPlugin.transform
      // Vite plugin hooks can be a function or an object with a `handler` property
      const originalFn = typeof hook === 'function' ? hook : hook?.handler
      if (originalFn) {
        const wrapped = async function (this: unknown, ...args: unknown[]) {
          try {
            return await originalFn.apply(this, args)
          } catch {
            return undefined
          }
        }
        if (typeof hook === 'function') {
          docgenPlugin.transform = wrapped as typeof hook
        } else if (hook) {
          hook.handler = wrapped as typeof hook.handler
        }
      }
    }

    return config
  },
} satisfies StorybookConfig

export default config
