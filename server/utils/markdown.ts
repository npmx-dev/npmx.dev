import type { Packument, PackumentVersion } from '#shared/types'
import type { RepositoryInfo } from '#shared/utils/git-providers'
import { joinURL } from 'ufo'

const SPARKLINE_CHARS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const
const MAX_README_SIZE = 500 * 1024 // 500KB, matching MAX_FILE_SIZE in file API

export function generateSparkline(data: number[]): string {
  if (!data.length) return ''

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min

  // If all values are the same, use middle bar
  if (range === 0) {
    return SPARKLINE_CHARS[4].repeat(data.length)
  }

  return data
    .map(val => {
      const normalized = (val - min) / range
      const index = Math.round(normalized * (SPARKLINE_CHARS.length - 1))
      return SPARKLINE_CHARS[index]
    })
    .join('')
}

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

function normalizeGitUrl(url: string): string {
  return url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .replace(/^ssh:\/\/git@github\.com/, 'https://github.com')
    .replace(/^git@github\.com:/, 'https://github.com/')
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function getRepositoryUrl(repository?: {
  type?: string
  url?: string
  directory?: string
}): string | null {
  if (!repository?.url) return null
  let url = normalizeGitUrl(repository.url)
  // Append directory for monorepo packages
  if (repository.directory) {
    url = joinURL(`${url}/tree/HEAD`, repository.directory)
  }
  return url
}

function buildWeeklyTotals(dailyDownloads: Array<{ day: string; downloads: number }>): number[] {
  if (!dailyDownloads.length) return []

  // Sort by date
  const sorted = [...dailyDownloads].sort((a, b) => a.day.localeCompare(b.day))

  // Group into weeks (7 days each)
  const weeks: number[] = []
  let weekTotal = 0
  let dayCount = 0

  for (const entry of sorted) {
    weekTotal += entry.downloads
    dayCount++

    if (dayCount === 7) {
      weeks.push(weekTotal)
      weekTotal = 0
      dayCount = 0
    }
  }

  // Include partial last week if any days remain
  if (dayCount > 0) {
    weeks.push(weekTotal)
  }

  return weeks
}

export interface PackageMarkdownOptions {
  pkg: Packument
  version: PackumentVersion
  readme?: string | null
  weeklyDownloads?: number
  dailyDownloads?: Array<{ day: string; downloads: number }>
  installSize?: number
  repoInfo?: RepositoryInfo
}

export function generatePackageMarkdown(options: PackageMarkdownOptions): string {
  const {
    pkg,
    version,
    readme,
    weeklyDownloads,
    dailyDownloads,
    installSize,
    repoInfo: _repoInfo,
  } = options

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
    metaParts.push(`**License:** ${pkg.license}`)
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

  // Weekly downloads with sparkline
  if (weeklyDownloads !== undefined) {
    statsHeaders.push('Downloads (weekly)')
    statsSeparators.push('---')

    let downloadCell = formatNumber(weeklyDownloads)
    if (dailyDownloads && dailyDownloads.length > 0) {
      const weeklyTotals = buildWeeklyTotals(dailyDownloads)
      if (weeklyTotals.length > 1) {
        downloadCell += ` ${generateSparkline(weeklyTotals)}`
      }
    }
    statsValues.push(downloadCell)
  }

  // Dependencies count
  const depCount = version.dependencies ? Object.keys(version.dependencies).length : 0
  statsHeaders.push('Dependencies')
  statsSeparators.push('---')
  statsValues.push(String(depCount))

  // Install size
  if (installSize) {
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

  // Install section
  lines.push('## Install')
  lines.push('')
  lines.push('```bash')
  lines.push(`npm install ${pkg.name}`)
  lines.push('```')
  lines.push('')

  // Links section
  const links: Array<{ label: string; url: string }> = []

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
      // npm API returns username but @npm/types Contact doesn't include it
      const username = (maintainer as { username?: string }).username
      const name = maintainer.name || username || 'Unknown'
      if (username) {
        lines.push(`- [${name}](https://www.npmjs.com/~${username})`)
      } else {
        lines.push(`- ${name}`)
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
