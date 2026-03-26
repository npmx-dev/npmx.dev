import type { Packument, PackumentVersion } from '#shared/types'
import { normalizeGitUrl } from '#shared/utils/git-providers'
import { joinURL } from 'ufo'

const MAX_README_SIZE = 500 * 1024 // 500KB, matching MAX_FILE_SIZE in file API

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function escapeMarkdown(text: string): string {
  return text.replace(/([*_`[\]\\])/g, '\\$1')
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function getRepositoryUrl(
  repository?:
    | {
        type?: string
        url?: string
        directory?: string
      }
    | string,
): string | null {
  if (!repository) return null
  // Handle both string and object forms of repository field
  const repoUrl = typeof repository === 'string' ? repository : repository.url
  if (!repoUrl) return null
  const normalized = normalizeGitUrl(repoUrl)
  // normalizeGitUrl returns null for empty/invalid URLs, and may return non-HTTP URLs
  if (!normalized || !isHttpUrl(normalized)) return null
  // Strip .git suffix for cleaner display URLs
  const cleanUrl = normalized.replace(/\.git$/, '')
  // Append directory for monorepo packages (only available in object form)
  if (typeof repository !== 'string' && repository.directory) {
    return joinURL(`${cleanUrl}/tree/HEAD`, repository.directory)
  }
  return cleanUrl
}

export interface PackageMarkdownOptions {
  pkg: Packument
  version: PackumentVersion
  readme?: string | null
  weeklyDownloads?: number
  installSize?: number
}

export function generatePackageMarkdown(options: PackageMarkdownOptions): string {
  const { pkg, version, readme, weeklyDownloads, installSize } = options

  const lines: string[] = []

  // Title
  lines.push(`# ${pkg.name}`)
  lines.push('')

  // Description
  if (pkg.description) {
    lines.push(`> ${escapeMarkdown(pkg.description)}`)
    lines.push('')
  }

  // Version and metadata line
  const metaParts: string[] = []
  metaParts.push(`**Version:** ${version.version}`)

  if (pkg.license) {
    const licenseText = typeof pkg.license === 'string' ? pkg.license : pkg.license.type
    metaParts.push(`**License:** ${escapeMarkdown(licenseText)}`)
  }

  if (pkg.time?.modified) {
    const date = new Date(pkg.time.modified)
    metaParts.push(`**Updated:** ${date.toLocaleDateString('en-US', { dateStyle: 'medium' })}`)
  }

  lines.push(metaParts.join(' | '))
  lines.push('')

  // Stats section
  lines.push('## Stats')
  lines.push('')

  // Build stats table
  const statsHeaders: string[] = []
  const statsSeparators: string[] = []
  const statsValues: string[] = []

  // Weekly downloads
  if (weeklyDownloads !== undefined) {
    statsHeaders.push('Downloads (weekly)')
    statsSeparators.push('---')
    statsValues.push(formatNumber(weeklyDownloads))
  }

  // Dependencies count
  const depCount = version.dependencies ? Object.keys(version.dependencies).length : 0
  statsHeaders.push('Dependencies')
  statsSeparators.push('---')
  statsValues.push(String(depCount))

  // Install size
  if (installSize !== undefined) {
    statsHeaders.push('Install Size')
    statsSeparators.push('---')
    statsValues.push(formatBytes(installSize))
  } else if (version.dist?.unpackedSize) {
    statsHeaders.push('Package Size')
    statsSeparators.push('---')
    statsValues.push(formatBytes(version.dist.unpackedSize))
  }

  if (statsHeaders.length > 0) {
    lines.push(`| ${statsHeaders.join(' | ')} |`)
    lines.push(`| ${statsSeparators.join(' | ')} |`)
    lines.push(`| ${statsValues.join(' | ')} |`)
    lines.push('')
  }

  // Links section
  const links: Array<{ label: string; url: string }> = []

  links.push({ label: 'npmx', url: `https://npmx.dev/package/${pkg.name}` })
  links.push({ label: 'npm', url: `https://www.npmjs.com/package/${pkg.name}` })

  const repoUrl = getRepositoryUrl(pkg.repository)
  if (repoUrl) {
    links.push({ label: 'Repository', url: repoUrl })
  }

  if (version.homepage && version.homepage !== repoUrl && isHttpUrl(version.homepage)) {
    links.push({ label: 'Homepage', url: version.homepage })
  }

  if (version.bugs?.url && isHttpUrl(version.bugs.url)) {
    links.push({ label: 'Issues', url: version.bugs.url })
  }

  if (links.length > 0) {
    lines.push('## Links')
    lines.push('')
    for (const link of links) {
      lines.push(`- [${link.label}](${link.url})`)
    }
    lines.push('')
  }

  // Compatibility (engines)
  if (version.engines && Object.keys(version.engines).length > 0) {
    lines.push('## Compatibility')
    lines.push('')
    for (const [engine, range] of Object.entries(version.engines)) {
      lines.push(`- **${escapeMarkdown(engine)}:** ${escapeMarkdown(range)}`)
    }
    lines.push('')
  }

  // Dist-tags
  const distTags = pkg['dist-tags']
  if (distTags && Object.keys(distTags).length > 0) {
    lines.push('## Dist-tags')
    lines.push('')
    for (const [tag, tagVersion] of Object.entries(distTags)) {
      lines.push(`- **${escapeMarkdown(tag)}:** ${tagVersion}`)
    }
    lines.push('')
  }

  // Keywords
  if (version.keywords && version.keywords.length > 0) {
    lines.push('## Keywords')
    lines.push('')
    lines.push(version.keywords.slice(0, 20).join(', '))
    lines.push('')
  }

  // Maintainers
  if (pkg.maintainers && pkg.maintainers.length > 0) {
    lines.push('## Maintainers')
    lines.push('')
    for (const maintainer of pkg.maintainers.slice(0, 10)) {
      // npm API returns username but `@npm/types` `Contact` doesn't include it
      // maintainers is user-supplied so we escape both name and username
      const username = (maintainer as { username?: string }).username
      const safeName = escapeMarkdown(maintainer.name || username || 'Unknown')
      if (username) {
        lines.push(`- [${safeName}](https://npmx.dev/~${encodeURIComponent(username)})`)
      } else {
        lines.push(`- ${safeName}`)
      }
    }
    lines.push('')
  }

  // README section
  if (readme && readme.trim()) {
    lines.push('---')
    lines.push('')
    lines.push('## README')
    lines.push('')
    const trimmedReadme = readme.trim()
    if (trimmedReadme.length > MAX_README_SIZE) {
      lines.push(trimmedReadme.slice(0, MAX_README_SIZE))
      lines.push('')
      lines.push('*[README truncated due to size]*')
    } else {
      lines.push(trimmedReadme)
    }
    lines.push('')
  }

  return lines.join('\n')
}
