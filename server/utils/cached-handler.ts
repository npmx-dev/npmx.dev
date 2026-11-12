import type { RequestEvent } from 'nuxt/server'
import type { EventHandler, EventHandlerRequest } from 'nitro/h3'
import { defineCachedHandler } from 'nitro/cache'

type CachedHandlerOptions = Omit<
  NonNullable<Parameters<typeof defineCachedHandler>[1]>,
  'getKey' | 'shouldBypassCache'
> & {
  getKey?: (event: RequestEvent) => string | Promise<string>
  shouldBypassCache?: (event: RequestEvent) => boolean | Promise<boolean>
}

type CachedEventHandler<Result> = EventHandler<EventHandlerRequest, Result>

/**
 * Nitro's cached handler options type the event as ocache's bare `HTTPEvent`,
 * which has no h3 context; the runtime event is a full `H3Event`.
 */
export function defineCachedEventHandler<Result>(
  handler: CachedEventHandler<Result>,
  options?: CachedHandlerOptions,
): CachedEventHandler<Result> {
  return defineCachedHandler(
    handler,
    options as Parameters<typeof defineCachedHandler>[1],
  ) as CachedEventHandler<Result>
}
