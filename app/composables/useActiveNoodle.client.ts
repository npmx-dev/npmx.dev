import type { ActiveNoodle } from '~/noodles'

// Client-only: read the `ActiveNoodle` the server composable computed and
// embedded in the SSR payload. No noodle data is shipped to the client.
export const useActiveNoodle = () => useState<ActiveNoodle | undefined>('activeNoodle')
