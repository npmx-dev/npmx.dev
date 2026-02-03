import * as dev from '../types/lexicons/dev'

// Duration
export const CACHE_MAX_AGE_ONE_MINUTE = 60
export const CACHE_MAX_AGE_FIVE_MINUTES = 60 * 5
export const CACHE_MAX_AGE_ONE_HOUR = 60 * 60
export const CACHE_MAX_AGE_ONE_DAY = 60 * 60 * 24
export const CACHE_MAX_AGE_ONE_YEAR = 60 * 60 * 24 * 365

// API Strings
export const NPMX_SITE = 'https://npmx.dev'
export const BLUESKY_API = 'https://public.api.bsky.app/xrpc/'
export const BLUESKY_COMMENTS_REQUEST = '/api/atproto/bluesky-comments'
export const NPM_REGISTRY = 'https://registry.npmjs.org'
export const ERROR_PACKAGE_ANALYSIS_FAILED = 'Failed to analyze package.'
export const ERROR_PACKAGE_VERSION_AND_FILE_FAILED = 'Version and file path are required.'
export const ERROR_PACKAGE_REQUIREMENTS_FAILED =
  'Package name, version, and file path are required.'
export const ERROR_FILE_LIST_FETCH_FAILED = 'Failed to fetch file list.'
export const ERROR_CALC_INSTALL_SIZE_FAILED = 'Failed to calculate install size.'
export const NPM_MISSING_README_SENTINEL = 'ERROR: No README data found!'
export const ERROR_JSR_FETCH_FAILED = 'Failed to fetch package from JSR registry.'
export const ERROR_NPM_FETCH_FAILED = 'Failed to fetch package from npm registry.'
export const UNSET_NUXT_SESSION_PASSWORD = 'NUXT_SESSION_PASSWORD not set'
export const ERROR_SUGGESTIONS_FETCH_FAILED = 'Failed to fetch suggestions.'
export const ERROR_SKILLS_FETCH_FAILED = 'Failed to fetch skills.'
export const ERROR_SKILL_NOT_FOUND = 'Skill not found.'
export const ERROR_SKILL_FILE_NOT_FOUND = 'Skill file not found.'
/** @public */
export const ERROR_GRAVATAR_FETCH_FAILED = 'Failed to fetch Gravatar profile.'
/** @public */
export const ERROR_GRAVATAR_EMAIL_UNAVAILABLE = "User's email not accessible."
export const ERROR_NEED_REAUTH = 'User needs to reauthenticate'

// microcosm services
export const CONSTELLATION_HOST = 'constellation.microcosm.blue'
export const SLINGSHOT_HOST = 'slingshot.microcosm.blue'

// ATProtocol
// Refrences used to link packages to things that are not inherently atproto
export const PACKAGE_SUBJECT_REF = (packageName: string) =>
  `https://npmx.dev/package/${packageName}`
// OAuth scopes as we add new ones we need to check these on certain actions. If not redirect the user to login again to upgrade the scopes
export const LIKES_SCOPE = `repo:${dev.npmx.feed.like.$nsid}`

// Theming
export const ACCENT_COLORS = {
  light: {
    coral: 'oklch(0.70 0.19 14.75)',
    amber: 'oklch(0.8 0.25 84.429)',
    emerald: 'oklch(0.70 0.17 166.95)',
    sky: 'oklch(0.70 0.15 230.318)',
    violet: 'oklch(0.70 0.17 286.067)',
    magenta: 'oklch(0.75 0.18 330)',
  },
  dark: {
    coral: 'oklch(0.704 0.177 14.75)',
    amber: 'oklch(0.828 0.165 84.429)',
    emerald: 'oklch(0.792 0.153 166.95)',
    sky: 'oklch(0.787 0.128 230.318)',
    violet: 'oklch(0.78 0.148 286.067)',
    magenta: 'oklch(0.78 0.15 330)',
  },
} as const

export const BACKGROUND_THEMES = {
  neutral: 'oklch(0.555 0 0)',
  stone: 'oklch(0.555 0.013 58.123)',
  zinc: 'oklch(0.555 0.016 285.931)',
  slate: 'oklch(0.555 0.046 257.407)',
  black: 'oklch(0.4 0 0)',
} as const

// Regex
export const AT_URI_REGEX = /^at:\/\/(did:plc:[a-z0-9]+)\/app\.bsky\.feed\.post\/([a-z0-9]+)$/
