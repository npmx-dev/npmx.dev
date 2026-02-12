import type { JsDelivrFileNode, AgentFile, LlmsTxtResult } from '#shared/types'
import { NPM_MISSING_README_SENTINEL, NPM_REGISTRY } from '#shared/utils/constants'

/** Well-known agent instruction files at the package root */
const ROOT_AGENT_FILES: Record<string, string> = {
  'CLAUDE.md': 'Claude Code',
  'AGENTS.md': 'Agent Instructions',
  'AGENT.md': 'Agent Instructions',
  '.cursorrules': 'Cursor Rules',
  '.windsurfrules': 'Windsurf Rules',
  '.clinerules': 'Cline Rules',
}

/** Well-known agent files inside specific directories */
const DIRECTORY_AGENT_FILES: Record<string, string> = {
  '.github/copilot-instructions.md': 'GitHub Copilot',
}

/** Directories containing rule files (match *.md inside) */
const RULE_DIRECTORIES: Record<string, string> = {
  '.cursor/rules': 'Cursor Rules',
  '.windsurf/rules': 'Windsurf Rules',
}

/**
 * Discover agent instruction file paths from a jsDelivr file tree.
 * Scans root-level files, known subdirectory files, and rule directories.
 */
export function discoverAgentFiles(files: JsDelivrFileNode[]): string[] {
  const discovered: string[] = []

  for (const node of files) {
    // Root-level well-known files
    if (node.type === 'file' && node.name in ROOT_AGENT_FILES) {
      discovered.push(node.name)
    }

    // Directory-based files
    if (node.type === 'directory') {
      // .github/copilot-instructions.md
      if (node.name === '.github' && node.files) {
        for (const child of node.files) {
          const fullPath = `.github/${child.name}`
          if (child.type === 'file' && fullPath in DIRECTORY_AGENT_FILES) {
            discovered.push(fullPath)
          }
        }
      }

      // .cursor/rules/*.md and .windsurf/rules/*.md
      for (const dirPath of Object.keys(RULE_DIRECTORIES)) {
        const [topDir, subDir] = dirPath.split('/')
        if (node.name === topDir && node.files) {
          const rulesDir = node.files.find(f => f.type === 'directory' && f.name === subDir)
          if (rulesDir?.files) {
            for (const ruleFile of rulesDir.files) {
              if (ruleFile.type === 'file' && ruleFile.name.endsWith('.md')) {
                discovered.push(`${dirPath}/${ruleFile.name}`)
              }
            }
          }
        }
      }
    }
  }

  return discovered
}

/**
 * Get the display name for an agent file path.
 */
function getDisplayName(filePath: string): string {
  if (filePath in ROOT_AGENT_FILES) return ROOT_AGENT_FILES[filePath]!
  if (filePath in DIRECTORY_AGENT_FILES) return DIRECTORY_AGENT_FILES[filePath]!

  for (const [dirPath, displayName] of Object.entries(RULE_DIRECTORIES)) {
    if (filePath.startsWith(`${dirPath}/`))
      return `${displayName}: ${filePath.split('/').pop() ?? filePath}`
  }

  return filePath
}

/**
 * Fetch agent instruction files from jsDelivr CDN.
 * Fetches in parallel, gracefully skipping failures.
 */
export async function fetchAgentFiles(
  packageName: string,
  version: string,
  filePaths: string[],
): Promise<AgentFile[]> {
  const results = await Promise.all(
    filePaths.map(async (path): Promise<AgentFile | null> => {
      try {
        const url = `https://cdn.jsdelivr.net/npm/${packageName}@${version}/${path}`
        const response = await fetch(url)
        if (!response.ok) return null
        const content = await response.text()
        return { path, content, displayName: getDisplayName(path) }
      } catch {
        return null
      }
    }),
  )

  return results.filter((r): r is AgentFile => r !== null)
}

/**
 * Generate llms.txt markdown content per the llmstxt.org spec.
 *
 * Structure:
 * - H1 title with package name and version
 * - Blockquote description (if available)
 * - Metadata list (homepage, repository, npm)
 * - README section
 * - Agent Instructions section (one sub-heading per file, full mode only)
 */
export function generateLlmsTxt(result: LlmsTxtResult): string {
  const lines: string[] = []

  // Title
  lines.push(`# ${result.packageName}@${result.version}`)
  lines.push('')

  // Description blockquote
  if (result.description) {
    lines.push(`> ${result.description}`)
    lines.push('')
  }

  // Metadata
  const meta: string[] = []
  if (result.homepage) meta.push(`- Homepage: ${result.homepage}`)
  if (result.repositoryUrl) meta.push(`- Repository: ${result.repositoryUrl}`)
  meta.push(`- npm: https://www.npmjs.com/package/${result.packageName}/v/${result.version}`)
  lines.push(...meta)
  lines.push('')

  // README
  if (result.readme) {
    lines.push('## README')
    lines.push('')
    lines.push(result.readme)
    lines.push('')
  }

  // Agent instructions
  if (result.agentFiles.length > 0) {
    lines.push('## Agent Instructions')
    lines.push('')

    for (const file of result.agentFiles) {
      lines.push(`### ${file.displayName} (\`${file.path}\`)`)
      lines.push('')
      lines.push(file.content)
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}

/** Standard README filenames to try from jsDelivr CDN */
const README_FILENAMES = ['README.md', 'readme.md', 'Readme.md']

/** Fetch README from jsDelivr CDN as fallback */
async function fetchReadmeFromCdn(packageName: string, version: string): Promise<string | null> {
  for (const filename of README_FILENAMES) {
    try {
      const url = `https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filename}`
      const response = await fetch(url)
      if (response.ok) return await response.text()
    } catch {
      // Try next
    }
  }
  return null
}

/** Extract README from packument data */
function getReadmeFromPackument(
  packageData: Awaited<ReturnType<typeof fetchNpmPackage>>,
  requestedVersion?: string,
): string | null {
  const readme = requestedVersion
    ? packageData.versions[requestedVersion]?.readme
    : packageData.readme

  if (readme && readme !== NPM_MISSING_README_SENTINEL) {
    return readme
  }
  return null
}

/** Extract a clean repository URL from packument repository field */
function parseRepoUrl(
  repository?: { type?: string; url?: string; directory?: string } | string,
): string | undefined {
  if (!repository) return undefined
  const url = typeof repository === 'string' ? repository : repository.url
  if (!url) return undefined
  return url.replace(/^git\+/, '').replace(/\.git$/, '')
}

/**
 * Orchestrates fetching all data and generating llms.txt for a package.
 *
 * When `includeAgentFiles` is false (default, for llms.txt), skips the file tree
 * fetch and agent file discovery entirely — only returns README + metadata.
 * When true (for llms_full.txt), includes agent instruction files.
 */
export async function handleLlmsTxt(
  packageName: string,
  requestedVersion?: string,
  options?: { includeAgentFiles?: boolean },
): Promise<string> {
  const includeAgentFiles = options?.includeAgentFiles ?? false

  const packageData = await fetchNpmPackage(packageName)
  const resolvedVersion = requestedVersion ?? packageData['dist-tags']?.latest

  if (!resolvedVersion) {
    throw createError({ statusCode: 404, message: 'Could not resolve package version.' })
  }

  // Extract README from packument (sync)
  const readmeFromPackument = getReadmeFromPackument(packageData, requestedVersion)

  let agentFiles: AgentFile[] = []
  let cdnReadme: string | null = null

  if (includeAgentFiles) {
    // Full mode: fetch file tree for agent discovery + README fallback in parallel
    const [fileTreeData, readme] = await Promise.all([
      fetchFileTree(packageName, resolvedVersion),
      readmeFromPackument ? null : fetchReadmeFromCdn(packageName, resolvedVersion),
    ])
    cdnReadme = readme
    const agentFilePaths = discoverAgentFiles(fileTreeData.files)
    agentFiles = await fetchAgentFiles(packageName, resolvedVersion, agentFilePaths)
  } else if (!readmeFromPackument) {
    // Standard mode: only fetch README from CDN if packument lacks it
    cdnReadme = await fetchReadmeFromCdn(packageName, resolvedVersion)
  }

  const readme = readmeFromPackument ?? cdnReadme ?? undefined

  const result: LlmsTxtResult = {
    packageName,
    version: resolvedVersion,
    description: packageData.description,
    homepage: packageData.homepage,
    repositoryUrl: parseRepoUrl(packageData.repository),
    readme,
    agentFiles,
  }

  return generateLlmsTxt(result)
}

// Validation for org names (matches server/api/registry/org/[org]/packages.get.ts)
const NPM_ORG_NAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i

/**
 * Generate llms.txt for an npm organization/scope.
 * Lists all packages in the org with links to their llms.txt pages.
 */
export async function handleOrgLlmsTxt(orgName: string, baseUrl: string): Promise<string> {
  if (!orgName || orgName.length > 50 || !NPM_ORG_NAME_RE.test(orgName)) {
    throw createError({ statusCode: 404, message: `Invalid org name: ${orgName}` })
  }

  const data = await $fetch<Record<string, string>>(
    `${NPM_REGISTRY}/-/org/${encodeURIComponent(orgName)}/package`,
  )

  const packages = Object.keys(data).sort()

  if (packages.length === 0) {
    throw createError({ statusCode: 404, message: `No packages found for @${orgName}` })
  }

  const lines: string[] = []

  lines.push(`# @${orgName}`)
  lines.push('')
  lines.push(`> npm packages published under the @${orgName} scope`)
  lines.push('')
  lines.push(`- npm: https://www.npmjs.com/org/${orgName}`)
  lines.push('')
  lines.push('## Packages')
  lines.push('')

  for (const pkg of packages) {
    const encodedPkg = pkg.replace('/', '/')
    lines.push(`- [${pkg}](${baseUrl}/package/${encodedPkg}/llms.txt)`)
  }

  lines.push('')

  return lines.join('\n').trimEnd() + '\n'
}

/**
 * Generate the root /llms.txt explaining available routes.
 */
export function generateRootLlmsTxt(baseUrl: string): string {
  const lines: string[] = []

  lines.push('# npmx.dev')
  lines.push('')
  lines.push('> A fast, modern browser for the npm registry')
  lines.push('')
  lines.push('This site provides LLM-friendly documentation for npm packages.')
  lines.push('')
  lines.push('## Available Routes')
  lines.push('')
  lines.push('### Package Documentation (llms.txt)')
  lines.push('')
  lines.push('README and package metadata in markdown format.')
  lines.push('')
  lines.push(`- \`${baseUrl}/package/<name>/llms.txt\` — unscoped package (latest version)`)
  lines.push(
    `- \`${baseUrl}/package/<name>/v/<version>/llms.txt\` — unscoped package (specific version)`,
  )
  lines.push(`- \`${baseUrl}/package/@<org>/<name>/llms.txt\` — scoped package (latest version)`)
  lines.push(
    `- \`${baseUrl}/package/@<org>/<name>/v/<version>/llms.txt\` — scoped package (specific version)`,
  )
  lines.push('')
  lines.push('### Full Package Documentation (llms_full.txt)')
  lines.push('')
  lines.push(
    'README, package metadata, and agent instruction files (CLAUDE.md, .cursorrules, etc.).',
  )
  lines.push('')
  lines.push(`- \`${baseUrl}/package/<name>/llms_full.txt\` — unscoped package (latest version)`)
  lines.push(
    `- \`${baseUrl}/package/<name>/v/<version>/llms_full.txt\` — unscoped package (specific version)`,
  )
  lines.push(
    `- \`${baseUrl}/package/@<org>/<name>/llms_full.txt\` — scoped package (latest version)`,
  )
  lines.push(
    `- \`${baseUrl}/package/@<org>/<name>/v/<version>/llms_full.txt\` — scoped package (specific version)`,
  )
  lines.push('')
  lines.push('### Organization Packages (llms.txt)')
  lines.push('')
  lines.push('List of all packages under an npm scope with links to their documentation.')
  lines.push('')
  lines.push(`- \`${baseUrl}/package/@<org>/llms.txt\` — organization package listing`)
  lines.push('')
  lines.push('## Examples')
  lines.push('')
  lines.push(`- [nuxt llms.txt](${baseUrl}/package/nuxt/llms.txt)`)
  lines.push(`- [nuxt llms_full.txt](${baseUrl}/package/nuxt/llms_full.txt)`)
  lines.push(`- [@nuxt/kit llms.txt](${baseUrl}/package/@nuxt/kit/llms.txt)`)
  lines.push(`- [@nuxt org packages](${baseUrl}/package/@nuxt/llms.txt)`)
  lines.push('')

  return lines.join('\n').trimEnd() + '\n'
}
