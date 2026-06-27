import type { Component } from 'vue'
import NoodleArtemisLogo from './Artemis/Logo.vue'
import NoodleKawaiiLogo from './Kawaii/Logo.vue'
import NoodleNodejsLogo from './Nodejs/Logo.vue'
import NoodlePressLogo from './Press/Logo.vue'
import NoodlePride1Logo from './Pride1/Logo.vue'
import NoodleTransgenderVisibilityLogo from './TransgenderVisibility/Logo.vue'
import NoodlePride2Logo from './Pride2/Logo.vue'
import NoodlePride3Logo from './Pride3/Logo.vue'
import NoodleTetrisLogo from './Tetris/Logo.vue'

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
    dateTo: '2026-06-06',
    timezone: 'auto',
  },
  {
    key: 'tetris',
    logo: NoodleTetrisLogo,
    date: '2026-06-06',
    dateTo: '2026-06-08',
    timezone: 'auto',
    tagline: false,
  },
  {
    key: 'pride-2',
    logo: NoodlePride2Logo,
    date: '2026-06-08',
    dateTo: '2026-06-20',
    timezone: 'auto',
  },
  {
    key: 'pride-3',
    logo: NoodlePride3Logo,
    date: '2026-06-20',
    dateTo: '2026-07-01',
    timezone: 'auto',
  },
]

// Logo registry for the /noodles archive, keyed by the entry's `key` in
// app/noodles.ts. The homepage only renders PERMANENT_NOODLES + ACTIVE_NOODLES
// above; the archive resolves any past noodle's logo through this map.
const NOODLE_LOGOS: Record<string, Component> = {
  'press': NoodlePressLogo,
  'kawaii': NoodleKawaiiLogo,
  'transgender-visibility-day': NoodleTransgenderVisibilityLogo,
  'artemis': NoodleArtemisLogo,
  'nodejs': NoodleNodejsLogo,
  'pride-1': NoodlePride1Logo,
  'tetris': NoodleTetrisLogo,
}

export function resolveNoodleLogo(key: string): Component | undefined {
  return NOODLE_LOGOS[key]
}
