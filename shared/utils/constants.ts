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

export interface AccentColorToken {
  light: { oklch: string; hex: string }
  dark: { oklch: string; hex: string }
}

export const ACCENT_COLOR_TOKENS = {
  sky: {
    light: { oklch: 'oklch(0.53 0.16 247.27)', hex: '#006fc2' },
    dark: { oklch: 'oklch(0.787 0.128 230.318)', hex: '#51c8fc' },
  },
  coral: {
    light: { oklch: 'oklch(0.56 0.17 10.75)', hex: '#c23d5c' },
    dark: { oklch: 'oklch(0.704 0.177 14.75)', hex: '#f9697c' },
  },
  amber: {
    light: { oklch: 'oklch(0.58 0.18 46.34)', hex: '#cb4c00' },
    dark: { oklch: 'oklch(0.828 0.165 84.429)', hex: '#f8bc1c' },
  },
  emerald: {
    light: { oklch: 'oklch(0.51 0.13 162.4)', hex: '#007c4f' },
    dark: { oklch: 'oklch(0.792 0.153 166.95)', hex: '#2edaa6' },
  },
  violet: {
    light: { oklch: 'oklch(0.56 0.13 282.067)', hex: '#6a68be' },
    dark: { oklch: 'oklch(0.78 0.148 286.067)', hex: '#b0a9ff' },
  },
  magenta: {
    light: { oklch: 'oklch(0.56 0.14 325)', hex: '#9c54a1' },
    dark: { oklch: 'oklch(0.78 0.15 330)', hex: '#ec92e5' },
  },
  neutral: {
    light: { oklch: 'oklch(0.145 0 0)', hex: '#0a0a0a' },
    dark: { oklch: 'oklch(1 0 0)', hex: '#ffffff' },
  },
} as const satisfies Record<AccentColorId, AccentColorToken>

export const BACKGROUND_THEMES = {
  neutral: 'oklch(0.555 0 0)',
  stone: 'oklch(0.555 0.013 58.123)',
  zinc: 'oklch(0.555 0.016 285.931)',
  slate: 'oklch(0.555 0.046 257.407)',
  black: 'oklch(0.4 0 0)',
} as const

export type BackgroundThemeId = 'neutral' | 'stone' | 'zinc' | 'slate' | 'black'

export interface BackgroundThemeToken {
  oklch: string
  hex: string
}

export const BACKGROUND_THEME_TOKENS = {
  neutral: { oklch: 'oklch(0.555 0 0)', hex: '#737373' },
  stone: { oklch: 'oklch(0.555 0.013 58.123)', hex: '#79716c' },
  zinc: { oklch: 'oklch(0.555 0.016 285.931)', hex: '#72727c' },
  slate: { oklch: 'oklch(0.555 0.046 257.407)', hex: '#62748e' },
  black: { oklch: 'oklch(0.4 0 0)', hex: '#484848' },
} as const satisfies Record<BackgroundThemeId, BackgroundThemeToken>

/**
 * Static theme tokens for the share card OG image.
 * Must use hex/rgb — satori (the OG image renderer) does not support oklch.
 * Background is not included here — use BACKGROUND_THEME_TOKENS for the card bg.
 * Values are hex equivalents of the corresponding CSS custom properties:
 *   border     → --border
 *   divider    → --border-subtle
 *   text       → --fg
 *   textMuted  → --fg-muted
 *   textSubtle → --fg-subtle
 */
export const SHARE_CARD_THEMES = {
  dark: {
    bg: '#101010',        // --bg:          oklch(0.171 0 0)
    border: '#262626',    // --border:      oklch(0.269 0 0)
    divider: '#1f1f1f',   // --border-subtle: oklch(0.239 0 0)
    text: '#f9f9f9',      // --fg:          oklch(0.982 0 0)
    textMuted: '#adadad', // --fg-muted:    oklch(0.749 0 0)
    textSubtle: '#969696', // --fg-subtle:  oklch(0.673 0 0)
  },
  light: {
    bg: '#ffffff',        // --bg:          oklch(1 0 0)
    border: '#cecece',    // --border:      oklch(0.8514 0 0)
    divider: '#e5e5e5',   // --border-subtle: oklch(0.922 0 0)
    text: '#0a0a0a',      // --fg:          oklch(0.146 0 0)
    textMuted: '#474747', // --fg-muted:    oklch(0.398 0 0)
    textSubtle: '#5d5d5d', // --fg-subtle:  oklch(0.48 0 0)
  },
} as const satisfies Record<'light' | 'dark', Record<string, string>>

// INFO: Regex for capture groups
export const BLUESKY_URL_EXTRACT_REGEX = /profile\/([^/]+)\/post\/([^/]+)/
export const BSKY_POST_AT_URI_REGEX =
  /^at:\/\/(did:[a-z]+:[\w.:%-]+)\/app\.bsky\.feed\.post\/([a-z0-9]+)$/
export const BLOG_META_TAG_REGEX =
  /<meta[^>]*(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*>/gi
export const META_TAG_TITLE_REGEX = /<title>([^<]*)<\/title>/i
