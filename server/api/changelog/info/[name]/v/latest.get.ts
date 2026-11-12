import eventHandler, { defaultChangelogCacheOptions } from './[version].get'
import { defineCachedEventHandler } from '#server/utils/cached-handler'

export default defineCachedEventHandler(eventHandler, {
  ...defaultChangelogCacheOptions,
  maxAge: CACHE_MAX_AGE_ONE_HOUR * 2,
})
