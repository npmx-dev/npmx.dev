/**
 * Utilities for detecting install scripts in package.json.
 *
 * Install scripts (preinstall, install, postinstall) run automatically
 * when a package is installed as a dependency - important for security awareness.
 *
 * Also extracts npx package calls from those scripts.
 */

import type { InstallScriptsInfo } from '#shared/types'

// Scripts that run when installing a package as a dependency
const INSTALL_SCRIPTS = new Set(['preinstall', 'install', 'postinstall'])

// Pattern to match npx commands with various flags
// Captures the package name (with optional scope and version)
const NPX_PATTERN = /\bnpx\s+(?:--?\w+(?:=\S+)?\s+)*(@?[\w.-]+(?:\/[\w.-]+)?(?:@[\w.^~<>=|-]+)?)/g

// Pattern to extract package name and version from captured group
const PACKAGE_VERSION_PATTERN = /^(@[\w.-]+\/[\w.-]+|[\w.-]+)(?:@(.+))?$/

/**
 * Extract packages from npx calls in install scripts.
 * Only considers preinstall, install, postinstall - scripts that run for end-users.
 *
 * @param scripts - The scripts object from package.json
 * @returns Record of package name to version (or "latest" if none specified)
 */
export function extractNpxDependencies(
  scripts: Record<string, string> | undefined,
): Record<string, string> {
  if (!scripts) return {}

  const npxPackages: Record<string, string> = {}

  for (const [scriptName, script] of Object.entries(scripts)) {
    // Only check scripts that run during installation
    if (!INSTALL_SCRIPTS.has(scriptName)) continue
    // Reset regex state
    NPX_PATTERN.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = NPX_PATTERN.exec(script)) !== null) {
      const captured = match[1]
      if (!captured) continue

      // Extract package name and version
      const parsed = PACKAGE_VERSION_PATTERN.exec(captured)
      if (parsed && parsed[1]) {
        const packageName = parsed[1]
        const version = parsed[2] || 'latest'

        // Skip common built-in commands that aren't packages
        if (isBuiltinCommand(packageName)) continue

        // Only add if not already present (first occurrence wins)
        if (!(packageName in npxPackages)) {
          npxPackages[packageName] = version
        }
      }
    }
  }

  return npxPackages
}

/**
 * Check if a command is a built-in/common command that isn't an npm package
 */
function isBuiltinCommand(name: string): boolean {
  const builtins = new Set([
    // Common shell commands that might be mistakenly captured
    'env',
    'node',
    'npm',
    'yarn',
    'pnpm',
    // npx flags that might look like packages
    'yes',
    'no',
    'quiet',
    'shell',
  ])
  return builtins.has(name)
}

/**
 * Extract install script information from package.json scripts.
 * Returns info about which install scripts exist and any npx packages they call.
 *
 * @param scripts - The scripts object from package.json
 * @returns Info about install scripts and npx dependencies, or null if no install scripts
 */
export function extractInstallScriptsInfo(
  scripts: Record<string, string> | undefined,
): InstallScriptsInfo | null {
  if (!scripts) return null

  const presentScripts: ('preinstall' | 'install' | 'postinstall')[] = []
  const content: Record<string, string> = {}

  for (const scriptName of INSTALL_SCRIPTS) {
    if (scripts[scriptName]) {
      presentScripts.push(scriptName as 'preinstall' | 'install' | 'postinstall')
      content[scriptName] = scripts[scriptName]
    }
  }

  if (presentScripts.length === 0) return null

  return {
    scripts: presentScripts,
    content,
    npxDependencies: extractNpxDependencies(scripts),
  }
}
