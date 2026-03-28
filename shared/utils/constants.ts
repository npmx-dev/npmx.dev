import * as dev from '../types/lexicons/dev'

// Duration
export const CACHE_MAX_AGE_ONE_MINUTE = 60
export const CACHE_MAX_AGE_FIVE_MINUTES = 60 * 5
export const CACHE_MAX_AGE_ONE_HOUR = 60 * 60
export const CACHE_MAX_AGE_ONE_DAY = 60 * 60 * 24
export const CACHE_MAX_AGE_ONE_YEAR = 60 * 60 * 24 * 365

// API Strings
export const NPMX_SITE = 'https://npmx.dev'
export const NPMX_DOCS_SITE = 'https://docs.npmx.dev'
export const NPMX_DID = 'did:plc:u5zp7npt5kpueado77kuihyz'
export const BLUESKY_API = 'https://public.api.bsky.app'
export const BLUESKY_COMMENTS_REQUEST = '/api/atproto/bluesky-comments'
export const NPM_REGISTRY = 'https://registry.npmjs.org'
export const NPM_API = 'https://api.npmjs.org'
// Error Messages
export const ERROR_PACKAGE_ANALYSIS_FAILED = 'Failed to analyze package.'
export const ERROR_PACKAGE_VERSION_AND_FILE_FAILED = 'Version and file path are required.'
export const ERROR_PACKAGE_REQUIREMENTS_FAILED =
  'Package name, version, and file path are required.'
export const ERROR_PACKAGE_DETECT_CHANGELOG = 'failed to detect package has changelog'
export const ERROR_BLUESKY_URL_FAILED =
  'Invalid Bluesky URL format. Expected: https://bsky.app/profile/HANDLE/post/POST_ID'
export const ERROR_FILE_LIST_FETCH_FAILED = 'Failed to fetch file list.'
export const ERROR_CALC_INSTALL_SIZE_FAILED = 'Failed to calculate install size.'
export const NPM_MISSING_README_SENTINEL = 'ERROR: No README data found!'
/** The npm registry truncates the packument readme field at 65,536 characters (2^16) */
export const NPM_README_TRUNCATION_THRESHOLD = 64_000
export const ERROR_JSR_FETCH_FAILED = 'Failed to fetch package from JSR registry.'
export const ERROR_NPM_FETCH_FAILED = 'Failed to fetch package from npm registry.'
export const ERROR_PDS_FETCH_FAILED = 'Failed to fetch PDS repos.'
export const ERROR_PROVENANCE_FETCH_FAILED = 'Failed to fetch provenance.'
export const UNSET_NUXT_SESSION_PASSWORD = 'NUXT_SESSION_PASSWORD not set'
export const ERROR_SUGGESTIONS_FETCH_FAILED = 'Failed to fetch suggestions.'
export const ERROR_SKILLS_FETCH_FAILED = 'Failed to fetch skills.'
export const ERROR_SKILL_NOT_FOUND = 'Skill not found.'
export const ERROR_SKILL_FILE_NOT_FOUND = 'Skill file not found.'
export const ERROR_GRAVATAR_FETCH_FAILED = 'Failed to fetch Gravatar profile.'
export const ERROR_GRAVATAR_EMAIL_UNAVAILABLE = "User's email not accessible."
export const ERROR_NEED_REAUTH = 'User needs to reauthenticate'

export const ERROR_CHANGELOG_NOT_FOUND =
  'No releases or changelogs have been found for this package'
export const ERROR_CHANGELOG_RELEASES_FAILED = 'Failed to get releases'
export const ERROR_CHANGELOG_FILE_FAILED = 'Failed to get changelog markdown'
export const ERROR_THROW_INCOMPLETE_PARAM = "Couldn't do request due to incomplete parameters"
// for ungh.cc when api keys are exhausted, name is broad in case more proxies are going to be used
export const ERROR_UNGH_API_KEY_EXHAUSTED =
  "Couldn't fetch resources due to ungh api keys being exhausted"

// microcosm services
export const CONSTELLATION_HOST = 'constellation.microcosm.blue'
export const SLINGSHOT_HOST = 'slingshot.microcosm.blue'

// ATProtocol
// Refrences used to link packages to things that are not inherently atproto
export const PACKAGE_SUBJECT_REF = (packageName: string) =>
  `https://npmx.dev/package/${packageName}`
// OAuth scopes as we add new ones we need to check these on certain actions. If not redirect the user to login again to upgrade the scopes
export const LIKES_SCOPE = `repo:${dev.npmx.feed.like.$nsid}`
export const PROFILE_SCOPE = `repo:${dev.npmx.actor.profile.$nsid}`
export const NPMX_DEV_DID = 'did:plc:u5zp7npt5kpueado77kuihyz'
export const TID_CLOCK_ID = 3

// Discord
export const DISCORD_COMMUNITY_URL = 'https://chat.npmx.dev'
export const DISCORD_BUILDERS_URL = 'https://build.npmx.dev'

// Theming
export const ACCENT_COLOR_IDS = [
  'sky',
  'coral',
  'amber',
  'emerald',
  'violet',
  'magenta',
  'neutral',
] as const

export type AccentColorId = (typeof ACCENT_COLOR_IDS)[number]

export const ACCENT_COLORS = {
  light: {
    sky: 'oklch(0.53 0.16 247.27)',
    coral: 'oklch(0.56 0.17 10.75)',
    amber: 'oklch(0.58 0.18 46.34)',
    emerald: 'oklch(0.51 0.13 162.4)',
    violet: 'oklch(0.56 0.13 282.067)',
    magenta: 'oklch(0.56 0.14 325)',
    neutral: 'oklch(0.145 0 0)',
  },
  dark: {
    sky: 'oklch(0.787 0.128 230.318)',
    coral: 'oklch(0.704 0.177 14.75)',
    amber: 'oklch(0.828 0.165 84.429)',
    emerald: 'oklch(0.792 0.153 166.95)',
    violet: 'oklch(0.78 0.148 286.067)',
    magenta: 'oklch(0.78 0.15 330)',
    neutral: 'oklch(1 0 0)',
  },
} as const satisfies Record<'light' | 'dark', Record<AccentColorId, string>>

export const BACKGROUND_THEMES = {
  neutral: 'oklch(0.555 0 0)',
  stone: 'oklch(0.555 0.013 58.123)',
  zinc: 'oklch(0.555 0.016 285.931)',
  slate: 'oklch(0.555 0.046 257.407)',
  black: 'oklch(0.4 0 0)',
} as const

// INFO: Regex for capture groups
export const BLUESKY_URL_EXTRACT_REGEX = /profile\/([^/]+)\/post\/([^/]+)/
export const BSKY_POST_AT_URI_REGEX =
  /^at:\/\/(did:[a-z]+:[\w.:%-]+)\/app\.bsky\.feed\.post\/([a-z0-9]+)$/
export const BLOG_META_TAG_REGEX =
  /<meta[^>]*(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*>/gi
export const META_TAG_TITLE_REGEX = /<title>([^<]*)<\/title>/i
