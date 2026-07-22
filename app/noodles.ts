import type { Noodle } from '#shared/schemas/noodle'

// To add a noodle: drop a Logo.vue under app/components/Noodle/<Name>/,
// register the key in app/components/Noodle/index.ts, then append an entry below.

const ALEX = { name: 'Alex Savelyev', blueskyHandle: 'alexdln.com' }
const ALFON = { name: 'Alfon', blueskyHandle: 'alfon.dev' }
const GRAPHIEROS = { name: 'Graphieros', blueskyHandle: 'graphieros.npmx.social' }
const FELIX = { name: 'Felix Schneider', blueskyHandle: 'felixs.dev' }
const JVIIDE = { name: 'Joachim Viide', blueskyHandle: 'jviide.iki.fi' }

const entries: Noodle[] = [
  {
    key: 'tetris',
    title: 'World Tetris Day',
    slug: 'tetris',
    date: '2026-06-06',
    dateTo: '2026-06-08',
    timezone: 'auto',
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
  },
  {
    key: 'pride-1',
    title: 'Pride Month',
    slug: 'pride',
    date: '2026-06-01',
    dateTo: '2026-07-01',
    timezone: 'auto',
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
  },
  {
    key: 'press',
    title: 'Press Freedom Day',
    slug: 'press',
    date: '2026-05-01',
    dateTo: '2026-05-04',
    timezone: 'auto',
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
  },
  {
    key: 'kawaii',
    title: 'Kawaii',
    slug: 'kawaii',
    date: '2026-03-31',
    timezone: 'auto',
    tagline: false,
    occasion: "Our first noodle, and of course, in kawaii style. It's all about fun and joy.",
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/2346',
    authors: [ALFON],
    posterImage: '/extra/npmx-cute.svg',
  },
  {
    key: 'transgender-visibility-day',
    title: 'Transgender Visibility Day',
    slug: 'transgender-visibility-day',
    date: '2026-03-31',
    timezone: 'auto',
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
  },
  {
    key: 'nodejs',
    title: 'Node.js Initial Release',
    slug: 'nodejs',
    date: '2026-05-27',
    timezone: 'auto',
    occasion: 'console.log("happy birthday, nodejs")',
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/2778',
    authors: [ALEX, ALFON, GRAPHIEROS],
    references: [
      {
        label: 'Node.js v0.0.1 release',
        url: 'https://github.com/nodejs/node-v0.x-archive/releases/tag/v0.0.1',
      },
    ],
  },
  {
    key: 'emoji-day',
    title: 'World Emoji Day',
    slug: 'emoji-day',
    date: '2026-07-17',
    dateTo: '2026-07-19',
    timezone: 'auto',
    tagline: false,
    occasion: '📅🌍🚀💬🥳✨',
    prUrl: 'https://github.com/npmx-dev/npmx.dev/pull/3038',
    authors: [FELIX, JVIIDE],
    references: [
      { label: 'World Emoji Day Website', url: 'https://worldemojiday.com/' },
      { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/World_Emoji_Day' },
    ],
  },
]

export const noodles: Noodle[] = [...entries].sort(
  (a, b) => Date.parse(b.date) - Date.parse(a.date),
)

export function findNoodle(slug: string): Noodle | undefined {
  return noodles.find(n => n.slug === slug)
}
