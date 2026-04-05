/**
 * Calculates the next semantic version based on conventional commits since the
 * last reachable `v*` tag.
 *
 * Zero external dependencies — uses `child_process` to shell out to `git`.
 *
 * ### Imported as a module
 *
 * ```ts
 * import { getNextVersion } from './scripts/next-version'
 * const { current, next, from } = await getNextVersion()
 * ```
 *
 * ### CLI usage  (outputs JSON to stdout)
 *
 * ```sh
 * node scripts/next-version.ts                # { "current": "0.1.0", "next": "0.2.0", "from": "v0.1.0" }
 * node scripts/next-version.ts --next         # 0.2.0
 * node scripts/next-version.ts --current      # 0.1.0
 * node scripts/next-version.ts --from         # v0.1.0
 * ```
 */

import { execFileSync } from 'node:child_process'

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

export interface VersionInfo {
  /** The current version (from the latest tag), e.g. `"0.1.0"` */
  current: string
  /** The computed next version, e.g. `"0.2.0"` */
  next: string
  /** The git ref used as the starting point, e.g. `"v0.1.0"` or an initial commit SHA */
  from: string
}

export async function getNextVersion(): Promise<VersionInfo> {
  let current: string
  let from: string

  try {
    const tag = git('describe', '--tags', '--abbrev=0', '--match', 'v*', 'origin/release')
    current = tag.replace(/^v/, '')
    from = tag
  } catch {
    try {
      // Fallback: check tags reachable from HEAD (works in local dev)
      const tag = git('describe', '--tags', '--abbrev=0', '--match', 'v*')
      current = tag.replace(/^v/, '')
      from = tag
    } catch {
      // No reachable tags — start from the initial commit
      current = '0.0.0'
      from = git('rev-list', '--max-parents=0', 'HEAD')
    }
  }

  // Collect commit subjects since last tag (exclude merges)
  let commits: string[]
  try {
    const log = git('log', `${from}..HEAD`, '--format=%s%n%b', '--no-merges')
    commits = log ? log.split('\n') : []
  } catch {
    commits = []
  }

  let hasBreaking = false
  let hasFeat = false
  let hasFix = false

  for (const line of commits) {
    if (/BREAKING CHANGE|!:/.test(line)) hasBreaking = true
    if (/^feat(?:\([^)]*\))?!?:/.test(line)) hasFeat = true
    if (/^fix(?:\([^)]*\))?!?:/.test(line)) hasFix = true
  }

  const [major = 0, minor = 0, patch = 0] = current.split('.').map(Number)

  let next: string
  if (hasBreaking) {
    next = major > 0 ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`
  } else if (hasFeat) {
    next = `${major}.${minor + 1}.0`
  } else if (hasFix || commits.length > 0) {
    // Any non-empty diff bumps at least a patch
    next = `${major}.${minor}.${patch + 1}`
  } else {
    // HEAD is exactly on the latest tag
    next = current
  }

  return { current, next, from }
}

// --- CLI entry point ---
const isCLI =
  process.argv[1] &&
  (process.argv[1].endsWith('/next-version.ts') || process.argv[1].endsWith('/next-version'))

if (isCLI) {
  const flag = process.argv[2]
  getNextVersion()
    .then(info => {
      if (flag === '--next') console.log(info.next)
      else if (flag === '--current') console.log(info.current)
      else if (flag === '--from') console.log(info.from)
      else console.log(JSON.stringify(info))
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}
