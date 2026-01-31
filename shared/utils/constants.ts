// Duration
export const CACHE_MAX_AGE_ONE_MINUTE = 60
export const CACHE_MAX_AGE_ONE_HOUR = 60 * 60
export const CACHE_MAX_AGE_ONE_DAY = 60 * 60 * 24
export const CACHE_MAX_AGE_ONE_YEAR = 60 * 60 * 24 * 365

// API Strings
export const NPM_REGISTRY = 'https://registry.npmjs.org'
export const ERROR_PACKAGE_ANALYSIS_FAILED = 'Failed to analyze package.'
export const ERROR_PACKAGE_VERSION_AND_FILE_FAILED = 'Version and file path are required.'
/** @public */
export const ERROR_PACKAGE_REQUIREMENTS_FAILED =
  'Package name, version, and file path are required.'
export const ERROR_FILE_LIST_FETCH_FAILED = 'Failed to fetch file list.'
export const ERROR_CALC_INSTALL_SIZE_FAILED = 'Failed to calculate install size.'
export const NPM_MISSING_README_SENTINEL = 'ERROR: No README data found!'
export const ERROR_JSR_FETCH_FAILED = 'Failed to fetch package from JSR registry.'
export const ERROR_NPM_FETCH_FAILED = 'Failed to fetch package from npm registry.'
export const UNSET_NUXT_SESSION_PASSWORD = 'NUXT_SESSION_PASSWORD not set'
/** @public */
export const ERROR_SUGGESTIONS_FETCH_FAILED = 'Failed to fetch suggestions.'

// microcosm services
export const CONSTELLATION_HOST = 'constellation.microcosm.blue'
export const SLINGSHOT_HOST = 'slingshot.microcosm.blue'

// Theming
export const ACCENT_COLORS = {
  rose: 'oklch(0.797 0.084 11.056)',
  amber: 'oklch(0.828 0.165 84.429)',
  emerald: 'oklch(0.792 0.153 166.95)',
  sky: 'oklch(0.787 0.128 230.318)',
  violet: 'oklch(0.714 0.148 286.067)',
  coral: 'oklch(0.704 0.177 14.75)',
} as const
