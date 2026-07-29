import { getFeed } from '../utils/feeds'

export default defineEventHandler(() => {
  return getFeed().json1()
})
