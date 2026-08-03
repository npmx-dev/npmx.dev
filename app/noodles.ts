import { defineAsyncComponent, type Component } from 'vue'
import type { Noodle } from '#shared/schemas/noodle'
import { noodleLogoLoaders, type NoodleLogoKey } from './noodles/logos'

// To add a noodle: drop a Logo.vue under app/components/Noodle/<Name>/,
// register a lazy loader in app/noodles/logos.ts, then append an entry below
// (add `homepage`/`permanent`/`phases` to put it in the homepage rotation).

// Primary logo, loaded on demand. The archive / detail page only fetches the
// chunks for the noodles it actually renders.
const logo = (key: NoodleLogoKey): Component => {
  const loader = noodleLogoLoaders[key]
  return defineAsyncComponent(() => loader().then(m => m.default))
}

// A homepage rotation window: which logo, when, and with which tagline.
export type NoodlePhase = {
  key: NoodleLogoKey
  // Date for the noodle (YYYY-MM-DD)
  date: string
  // `Date to` for the noodle (YYYY-MM-DD)
  dateTo?: string
  // IANA timezone for the noodle (defaults to UTC when omitted)
  timezone?: string
  // Show npmx tagline or not (default is true)
  tagline?: boolean
}

// The server-decided active noodle, embedded into the SSR payload via
// `useState('activeNoodle')` so the client only ever loads the one logo it needs.
export type ActiveNoodle = {
  key: NoodleLogoKey
  tagline?: boolean
}

// A canonical noodle: the archive data plus its (lazy) visual and homepage
// rotation fields.
export type ArchiveNoodle = Noodle & {
  logo: Component
  // Always available behind its query param (e.g. ?kawaii), never date-gated.
  permanent?: boolean
  // Rotate on the homepage during this noodle's own date window.
  homepage?: boolean
  // Override the homepage rotation with one window per design (pride month).
  // Implies the noodle rotates on the homepage.
  phases?: NoodlePhase[]
}

// The entry `key` is the noodle's stable id; enforce that it always has a
// matching registered logo loader so the two can't drift apart.
type NoodleEntry = ArchiveNoodle & { key: NoodleLogoKey }

const ALEX = { name: 'Alex Savelyev', blueskyHandle: 'alexdln.com' }
const ALFON = { name: 'Alfon', blueskyHandle: 'alfon.dev' }
const GRAPHIEROS = { name: 'Graphieros', blueskyHandle: 'graphieros.npmx.social' }
const FELIX = { name: 'Felix Schneider', blueskyHandle: 'felixs.dev' }
const JVIIDE = { name: 'Joachim Viide', blueskyHandle: 'jviide.iki.fi' }
const MATTEO = { name: 'Matteo Gabriele', blueskyHandle: 'matteogabriele.bsky.social' }

const entries: NoodleEntry[] = [
  {
    key: 'tetris',
    title: 'World Tetris Day',
    slug: 'tetris',
    date: '2026-06-06',
    dateTo: '2026-06-08',
    timezone: 'UTC',
    tagline: false,
    occasion:
      'The legendary console turns 42. Yes, you matched the blocks correctly — but polyominoes are cool too!',
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/2855',
    authors: [ALEX],
    posterImage: '/extra/tetris.svg',
    references: [
      {
        label: 'Tetris (1984) - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Tetris',
      },
    ],
    logo: logo('tetris'),
    homepage: true,
  },
  {
    key: 'pride-1',
    title: 'Pride Month',
    slug: 'pride',
    date: '2026-06-01',
    dateTo: '2026-07-01',
    timezone: 'UTC',
    occasion: 'We stand together. Always, everywhere, for all of us. Happy Pride Month! 🏳️‍🌈',
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/2826',
    authors: [ALEX, ALFON],
    posterImage: '/extra/pride-1.svg',
    variants: ['/extra/pride-2.svg', '/extra/pride-3.png'],
    references: [
      {
        label: 'Pride Month - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Pride_Month',
      },
    ],
    logo: logo('pride-1'),
    phases: [
      {
        key: 'pride-1',
        date: '2026-06-01',
        dateTo: '2026-06-06',
        timezone: 'UTC',
      },
      {
        key: 'pride-2',
        date: '2026-06-08',
        dateTo: '2026-06-20',
        timezone: 'UTC',
      },
      {
        key: 'pride-3',
        date: '2026-06-20',
        dateTo: '2026-07-01',
        timezone: 'UTC',
      },
    ],
  },
  {
    key: 'press',
    title: 'Press Freedom Day',
    slug: 'press',
    date: '2026-05-01',
    dateTo: '2026-05-04',
    timezone: 'UTC',
    tagline: false,
    occasion:
      'We build open source to keep our work open. A free press keeps the entire world open.',
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/2666',
    authors: [ALEX, ALFON],
    posterImage: '/extra/npmx-dark-press.png',
    references: [
      {
        label: 'World Press Freedom Day - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/World_Press_Freedom_Day',
      },
    ],
    logo: logo('press'),
  },
  {
    key: 'kawaii',
    title: 'Kawaii',
    slug: 'kawaii',
    date: '2026-03-31',
    timezone: 'UTC',
    tagline: false,
    occasion: "Our first noodle, and of course, in kawaii style. It's all about fun and joy.",
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/2346',
    authors: [ALFON],
    posterImage: '/extra/npmx-cute.svg',
    logo: logo('kawaii'),
    permanent: true,
  },
  {
    key: 'transgender-visibility-day',
    title: 'Transgender Visibility Day',
    slug: 'transgender-visibility-day',
    date: '2026-03-31',
    timezone: 'UTC',
    tagline: false,
    occasion: 'Today and always ./🏳️‍⚧️',
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/2349',
    authors: [ALFON],
    posterImage: '/extra/npmx-cute-transgender.svg',
    references: [
      {
        label: 'International Transgender Day of Visibility - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/International_Transgender_Day_of_Visibility',
      },
    ],
    logo: logo('transgender-visibility-day'),
  },
  {
    key: 'artemis',
    title: 'Artemis II',
    slug: 'artemis',
    date: '2026-04-08',
    dateTo: '2026-04-12',
    timezone: 'America/Los_Angeles',
    tagline: true,
    occasion:
      'The first crewed flight beyond low Earth orbit since Apollo 17 in 1972. We watch and worry about them together with humanity.',
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/2421',
    authors: [ALEX, ALFON],
    posterImage: '/extra/npmx-dark-artemis.svg',
    references: [
      {
        label: 'Artemis II - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Artemis_II',
      },
    ],
    logo: logo('artemis'),
  },
  {
    key: 'nodejs',
    title: 'Node.js Initial Release',
    slug: 'nodejs',
    date: '2026-05-27',
    timezone: 'UTC',
    occasion: 'console.log("happy birthday, nodejs")',
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/2778',
    authors: [ALEX, ALFON, GRAPHIEROS],
    references: [
      {
        label: 'Node.js v0.0.1 release',
        url: 'https://github.com/nodejs/node-v0.x-archive/releases/tag/v0.0.1',
      },
    ],
    logo: logo('nodejs'),
  },
  {
    key: 'emoji-day',
    title: 'World Emoji Day',
    slug: 'emoji-day',
    date: '2026-07-17',
    dateTo: '2026-07-19',
    timezone: 'UTC',
    tagline: false,
    occasion: '📅🌍🚀💬🥳✨',
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/3038',
    authors: [FELIX, JVIIDE],
    references: [
      { label: 'World Emoji Day Website', url: 'https://worldemojiday.com/' },
      { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/World_Emoji_Day' },
    ],
    logo: logo('emoji-day'),
    homepage: true,
  },
  {
    key: 'gif-day',
    title: 'National GIF Day',
    slug: 'gif-day',
    date: '2026-09-05',
    dateTo: '2026-09-08',
    timezone: 'UTC',
    tagline: false,
    occasion: 'National GIF day',
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/2778',
    authors: [MATTEO],
    references: [
      {
        label: 'National GIF day',
        url: 'https://www.whatnationaldayisit.com/day/Gif/',
      },
    ],
    logo: logo('gif-day'),
    homepage: true,
  },
]

export const noodles: ArchiveNoodle[] = [...entries].sort(
  (a, b) => Date.parse(b.date) - Date.parse(a.date),
)

export function findNoodle(slug: string): ArchiveNoodle | undefined {
  return noodles.find(n => n.slug === slug)
}

// The homepage rotation, derived from the entries so the archive data and the
// homepage schedule can never drift apart. Consumed server-side only.
export const activeNoodles: NoodlePhase[] = entries.flatMap(noodle => {
  if (noodle.phases?.length) return noodle.phases
  if (!noodle.homepage) return []
  return [
    {
      key: noodle.key,
      date: noodle.date,
      dateTo: noodle.dateTo,
      timezone: noodle.timezone,
      tagline: noodle.tagline,
    },
  ]
})

export const permanentNoodles: ActiveNoodle[] = entries
  .filter(noodle => noodle.permanent)
  .map(noodle => ({ key: noodle.key, tagline: noodle.tagline }))
