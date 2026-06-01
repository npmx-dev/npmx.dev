import NoodleKawaiiLogo from './Kawaii/Logo.vue'
import NoodlePride1Logo from './Pride1/Logo.vue'

export type Noodle = {
  // Unique identifier for the noodle
  key: string
  // Timezone for the noodle (default is auto, i.e. user's timezone)
  timezone?: string
  // Date for the noodle (YYYY-MM-DD)
  date?: `${number}-${number}-${number}`
  // `Date to` for the noodle (YYYY-MM-DD)
  dateTo?: `${number}-${number}-${number}`
  // Logo for the noodle - could be any component. Relative parent - intro section
  logo: Component
  // Show npmx tagline or not (default is true)
  tagline?: boolean
}

// Permanent noodles - always shown on specific query param (e.g. ?kawaii)
export const PERMANENT_NOODLES: Noodle[] = [
  {
    key: 'kawaii',
    logo: NoodleKawaiiLogo,
    tagline: false,
  },
]

// Active noodles - shown based on date and timezone
export const ACTIVE_NOODLES: Noodle[] = [
  {
    key: 'pride-1',
    logo: NoodlePride1Logo,
    date: '2026-06-01',
    dateTo: '2026-06-30',
    timezone: 'auto',
  },
]
