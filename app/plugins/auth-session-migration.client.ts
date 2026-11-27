import { initSessionHintMigration } from '~/utils/atproto/session-hint'

export default defineNuxtPlugin({
  enforce: 'pre',
  env: { islands: false },
  setup() {
    initSessionHintMigration()
  },
})
