import NoodleKawaiiLogo from './Kawaii/Logo.vue'
import NoodleArtemisLogo from './Artemis/Logo.vue'
// import NoodleTkawaiiLogo from './Tkawaii/Logo.vue'

export type Noodle = {
  // Unique identifier for the noodle
  key: string
  // Timezone for the noodle (default is auto, i.e. user's timezone)
  timezone?: string
  // Date for the noodle
  date?: string
  // Date to for the noodle
  dateTo?: string
  // Logo for the noodle - could be any component. Relative parent - intro section
  logo: Component
  // Show npmx tagline or not (default is true)
  tagline?: boolean
}

// Archive noodles - might be shown on special page
// export const ARCHIVE_NOODLES: Noodle[] = [
//   {
//     key: 'tkawaii',
//     date: '2026-04-08T12:00:00UTC',
//     timezone: 'auto',
//     logo: NoodleTkawaiiLogo,
//     tagline: false,
//   },
// ]

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
    key: 'artemis',
    logo: NoodleArtemisLogo,
    date: '2026-04-08T12:00:00Z',
    dateTo: '2026-04-12T01:00:00Z',
    timezone: 'America/Los_Angeles',
    tagline: true,
  },
]
