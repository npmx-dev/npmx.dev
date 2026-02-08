import type { ProgressMessage } from './types'

/**
 * emitted during package initialization and bundling.
 */
export const progress = createEventHook<ProgressMessage>()
