import type { ProviderId, RepoRef } from '#shared/utils/git-providers'

/**
 * Result of checking for a release tag on a git provider
 */
export interface ReleaseTagResult {
  /** Whether the release tag exists */
  exists: boolean
  /** URL to the releases page if tag exists */
  url: string | null
  /** The tag that was found (if any) */
  tag: string | null
}

/**
 * Tag formats to try, in priority order (most common first)
 * Placeholders: {version} for semver, {name} for package name
 */
const TAG_FORMATS = [
  'v{version}', // v1.2.3 (most common)
  '{version}', // 1.2.3
  '{name}@{version}', // package@1.2.3 (monorepos like changesets)
  '{name}@v{version}', // package@v1.2.3
] as const

/**
 * Get the release URL for a tag on a given provider
 */
function getReleaseUrl(ref: RepoRef, tag: string): string {
  const encodedTag = encodeURIComponent(tag)

  switch (ref.provider) {
    case 'github':
      return `https://github.com/${ref.owner}/${ref.repo}/releases/tag/${encodedTag}`
    case 'gitlab': {
      const host = ref.host ?? 'gitlab.com'
      return `https://${host}/${ref.owner}/${ref.repo}/-/releases/${encodedTag}`
    }
    case 'codeberg':
      return `https://codeberg.org/${ref.owner}/${ref.repo}/releases/tag/${encodedTag}`
    case 'gitea':
    case 'forgejo': {
      const host = ref.host ?? 'codeberg.org'
      return `https://${host}/${ref.owner}/${ref.repo}/releases/tag/${encodedTag}`
    }
    default:
      return ''
  }
}

/**
 * Get the API URL to check for a release tag
 */
function getTagCheckUrl(ref: RepoRef, tag: string): string | null {
  const encodedTag = encodeURIComponent(tag)

  switch (ref.provider) {
    case 'github':
      return `https://api.github.com/repos/${ref.owner}/${ref.repo}/releases/tags/${encodedTag}`
    case 'gitlab': {
      const host = ref.host ?? 'gitlab.com'
      const encodedProject = encodeURIComponent(`${ref.owner}/${ref.repo}`)
      return `https://${host}/api/v4/projects/${encodedProject}/releases/${encodedTag}`
    }
    case 'codeberg':
      return `https://codeberg.org/api/v1/repos/${ref.owner}/${ref.repo}/releases/tags/${encodedTag}`
    case 'gitea':
    case 'forgejo': {
      const host = ref.host ?? 'codeberg.org'
      return `https://${host}/api/v1/repos/${ref.owner}/${ref.repo}/releases/tags/${encodedTag}`
    }
    // Bitbucket, Sourcehut, Gitee, Tangled, Radicle don't have easy release tag APIs
    default:
      return null
  }
}

/**
 * Generate tag candidates for a given version and package name
 */
function generateTagCandidates(version: string, packageName: string): string[] {
  // Extract the short name for scoped packages: @scope/pkg -> pkg
  const shortName = packageName.startsWith('@')
    ? packageName.slice(packageName.indexOf('/') + 1)
    : packageName

  return TAG_FORMATS.map(format =>
    format.replace('{version}', version).replace('{name}', shortName),
  )
}

/**
 * Providers that support release tag checking
 */
const SUPPORTED_PROVIDERS: Set<ProviderId> = new Set([
  'github',
  'gitlab',
  'codeberg',
  'gitea',
  'forgejo',
])

/**
 * Check if a release tag exists for a package version on the given git provider.
 * Tries multiple tag formats and returns the first successful match.
 *
 * @param ref - Repository reference from parseRepoUrl
 * @param version - Package version to check (e.g., "1.2.3")
 * @param packageName - Full package name (e.g., "@scope/pkg" or "pkg")
 * @returns Result indicating if a release tag exists and its URL
 */
export async function checkReleaseTag(
  ref: RepoRef,
  version: string,
  packageName: string,
): Promise<ReleaseTagResult> {
  // Skip unsupported providers
  if (!SUPPORTED_PROVIDERS.has(ref.provider)) {
    return { exists: false, url: null, tag: null }
  }

  const tagCandidates = generateTagCandidates(version, packageName)

  // Try each tag format sequentially, stop on first success
  for (const tag of tagCandidates) {
    const checkUrl = getTagCheckUrl(ref, tag)
    if (!checkUrl) continue

    try {
      const response = await fetch(checkUrl, {
        headers: {
          'Accept': 'application/json',
          // GitHub API requires User-Agent
          'User-Agent': 'npmx.dev',
        },
      })

      if (response.ok) {
        // Found a release with this tag
        return {
          exists: true,
          url: getReleaseUrl(ref, tag),
          tag,
        }
      }
      // 404 means tag doesn't exist, continue to next candidate
      // Other errors we also skip and try next
    } catch {
      // Network error, skip this tag and try next
      continue
    }
  }

  // No matching tag found
  return { exists: false, url: null, tag: null }
}
