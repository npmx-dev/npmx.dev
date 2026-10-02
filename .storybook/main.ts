import type { StorybookConfig } from '@storybook-vue/nuxt'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  framework: '@storybook-vue/nuxt',
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
          } catch (err) {
            // oxlint-disable-next-line no-console -- Log and swallow errors to avoid breaking the Storybook build when vue-docgen-api encounters an unparseable component.
            console.warn(
              '[storybook:vue-docgen-plugin] Suppressed docgen error (component docs may be missing):',
              err,
            )
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
