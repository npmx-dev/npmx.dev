import { cp } from 'node:fs/promises'
import { join } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { joinURL, withoutTrailingSlash } from 'ufo'

/**
 * Copies the font files emitted by `@nuxt/fonts` into the prerenderer's public directory, so
 * OG images rendered at build time can load them. Nitro only copies public assets into the
 * output after prerendering.
 */
export default defineNuxtModule({
  meta: {
    name: 'og-image-fonts',
  },
  setup(_, nuxt) {
    const baseURL = joinURL(nuxt.options.app.buildAssetsDir, 'fonts')

    nuxt.hook('nitro:init', nitro => {
      nitro.hooks.hook('prerender:init', async prerenderer => {
        const fonts = nitro.options.publicAssets.find(
          asset => withoutTrailingSlash(asset.baseURL) === baseURL,
        )
        if (fonts) {
          await cp(fonts.dir, join(prerenderer.options.output.publicDir, baseURL), {
            recursive: true,
          })
        }
      })
    })
  },
})
