import type { Component } from 'vue'

// One lazy chunk per noodle logo. Nothing here is loaded until `loadNoodleLogo`
// (or a `defineAsyncComponent` built on it) is actually invoked, so a page only
// fetches the logo(s) it renders.
export type NoodleLogoLoader = () => Promise<{ default: Component }>

const artemis: NoodleLogoLoader = () => import('../components/Noodle/Artemis/Logo.vue')
const emojiDay: NoodleLogoLoader = () => import('../components/Noodle/EmojiDay/Logo.vue')
const gifDay: NoodleLogoLoader = () => import('../components/Noodle/GifDay/Logo.vue')
const kawaii: NoodleLogoLoader = () => import('../components/Noodle/Kawaii/Logo.vue')
const nodejs: NoodleLogoLoader = () => import('../components/Noodle/Nodejs/Logo.vue')
const press: NoodleLogoLoader = () => import('../components/Noodle/Press/Logo.vue')
const pride1: NoodleLogoLoader = () => import('../components/Noodle/Pride1/Logo.vue')
const pride2: NoodleLogoLoader = () => import('../components/Noodle/Pride2/Logo.vue')
const pride3: NoodleLogoLoader = () => import('../components/Noodle/Pride3/Logo.vue')
const tetris: NoodleLogoLoader = () => import('../components/Noodle/Tetris/Logo.vue')
const transgenderVisibility: NoodleLogoLoader = () =>
  import('../components/Noodle/TransgenderVisibility/Logo.vue')

export const noodleLogoLoaders = {
  'artemis': artemis,
  'emoji-day': emojiDay,
  'gif-day': gifDay,
  'kawaii': kawaii,
  'nodejs': nodejs,
  'press': press,
  'pride-1': pride1,
  'pride-2': pride2,
  'pride-3': pride3,
  'tetris': tetris,
  'transgender-visibility-day': transgenderVisibility,
} satisfies Record<string, NoodleLogoLoader>

// The union of every registered logo key, derived from the map so callers can't
// reference a logo that doesn't exist (e.g. `logo('tretris')` is a type error).
export type NoodleLogoKey = keyof typeof noodleLogoLoaders

export async function loadNoodleLogo(key: NoodleLogoKey): Promise<Component | undefined> {
  const loader = noodleLogoLoaders[key]
  if (!loader) return
  const mod = await loader()
  return mod.default
}
