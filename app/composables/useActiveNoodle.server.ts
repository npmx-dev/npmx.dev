import { activeNoodles, permanentNoodles, type ActiveNoodle } from '~/noodles'

function todayIn(timezone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone ?? 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// Server-only: pick the noodle to show on the homepage when it's SSR'd, so
// `useRoute` is available. Computes against the (server-side) noodle data and
// stores just the result in Nuxt's payload for the client to read.
function computeActiveNoodle(): ActiveNoodle | undefined {
  const route = useRoute()

  // Permanent noodles are only requested via their query param (?kawaii).
  const permanent = permanentNoodles.find(slot => route.query[slot.key] !== undefined)
  if (permanent) return { key: permanent.key, tagline: permanent.tagline }

  const current = activeNoodles.filter(slot => {
    const today = todayIn(slot.timezone)
    if (!slot.dateTo) return today === slot.date
    return today >= slot.date && today <= slot.dateTo
  })
  if (!current.length) return undefined

  const picked = current[Math.floor(Math.random() * current.length)]!
  return { key: picked.key, tagline: picked.tagline }
}

export const useActiveNoodle = () =>
  useState<ActiveNoodle | undefined>('activeNoodle', computeActiveNoodle)
