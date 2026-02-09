import { defineNuxtModule, useNuxt } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'og-image-tweaks',
  },
  setup() {
    const nuxt = useNuxt()

    nuxt.hook('components:extend', components => {
      for (const component of [...components].toReversed()) {
        if (component.filePath.includes('og-image')) {
          components.splice(components.indexOf(component), 1)
        }
      }
    })
  },
})
