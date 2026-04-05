import type { StorybookConfig } from '@storybook-vue/nuxt'

const config = {
  stories: [
    // List welcome first in sidebar
    '../.storybook/docs/welcome.mdx',
    '../.storybook/docs/*.mdx',
    '../app/**/*.@(mdx|stories.@(js|ts))',
  ],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-themes',
    'storybook-i18n',
  ],
  framework: '@storybook-vue/nuxt',
  staticDirs: ['./.public', { from: '../public', to: '/' }],
  features: {
    backgrounds: false,
  },
  async viteFinal(newConfig) {
    newConfig.plugins ??= []

    // Bridge compatibility between Storybook v10 core and v9 @storybook-vue/nuxt
    // v10 expects module federation globals that v9 doesn't provide
    newConfig.plugins.push({
      name: 'storybook-v10-compat',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          const script = `
<script>
  // Minimal shims for Storybook v10 module federation system
  // These will be replaced when Storybook runtime loads
  window.__STORYBOOK_MODULE_GLOBAL__ = { global: window };
  window.__STORYBOOK_MODULE_CLIENT_LOGGER__ = {
    deprecate: console.warn.bind(console, '[deprecated]'),
    once: console.log.bind(console),
    logger: console
  };
  window.__STORYBOOK_MODULE_CHANNELS__ = {
    Channel: class { on() {} off() {} emit() {} once() {} },
    createBrowserChannel: () => new window.__STORYBOOK_MODULE_CHANNELS__.Channel()
  };
</script>`
          return html.replace(/<script>/, script + '<script>')
        },
      },
    })

    newConfig.plugins.push({
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
    const docgenPlugin = newConfig.plugins?.find(
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

    return newConfig
  },
} satisfies StorybookConfig

export default config
