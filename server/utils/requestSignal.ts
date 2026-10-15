import type { H3Event } from 'h3'

/**
 * A signal that aborts when the client disconnects, so upstream requests stop
 * fetching a response nobody is waiting for. `forges` combines it with its own
 * timeout, so this only adds cancellation on top.
 */
export function requestSignal(event: H3Event): AbortSignal {
  const controller = new AbortController()
  event.node.req.once('close', () => controller.abort())
  return controller.signal
}
