import eventHandler, { defaultChangelogCacheOptions } from './[version].get'

export default defineCachedEventHandler(eventHandler, {
  ...defaultChangelogCacheOptions,
  maxAge: CACHE_MAX_AGE_ONE_HOUR * 2,
})
