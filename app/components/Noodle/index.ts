import NoodleKawaiiLogo from './Kawaii/Logo.vue'
import NoodleNodejsLogo from './Nodejs/Logo.vue'

export type Noodle = {
  // Unique identifier for the noodle
  key: string
  // Timezone for the noodle (default is auto, i.e. user's timezone)
  timezone?: string
  // Date for the noodle
  date?: string
  // `Date to` for the noodle
  dateTo?: string
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
    key: 'nodejs',
    logo: NoodleNodejsLogo,
    date: '2026-05-27',
    timezone: 'auto',
  },
]
