import { getFeed } from '../../utils/feeds'
import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(() => {
  return getFeed().rss2()
})
