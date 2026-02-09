import type {
  PackageFileTree,
  SkillFileCounts,
  SkillFrontmatter,
  SkillListItem,
  SkillWarning,
} from '#shared/types'

const MAX_SKILL_FILE_SIZE = 500 * 1024

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Returns { frontmatter, content } where content is the markdown body without frontmatter.
 */
export function parseFrontmatter(raw: string): { frontmatter: SkillFrontmatter; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) {
    throw createError({ statusCode: 400, message: 'Invalid SKILL.md: missing YAML frontmatter' })
  }

  const yamlBlock = match[1]!
  const content = match[2]!

  const frontmatter: Record<string, string | Record<string, string>> = {}
  let currentKey = ''
  let inMetadata = false
  const metadata: Record<string, string> = {}

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (line.startsWith('  ') && inMetadata) {
      const [key, ...valueParts] = trimmed.split(':')
      if (key && valueParts.length) {
        metadata[key.trim()] = valueParts
          .join(':')
          .trim()
          .replace(/^["']|["']$/g, '')
      }
    } else {
      const colonIndex = line.indexOf(':')
      if (colonIndex !== -1) {
        currentKey = line.slice(0, colonIndex).trim()
        const value = line.slice(colonIndex + 1).trim()
        inMetadata = currentKey === 'metadata' && !value
        if (!inMetadata && value) {
          frontmatter[currentKey] = value.replace(/^["']|["']$/g, '')
        }
      }
    }
  }

  if (Object.keys(metadata).length > 0) {
    frontmatter.metadata = metadata
  }

  if (!frontmatter.name || !frontmatter.description) {
    throw createError({
      statusCode: 400,
      message: 'Invalid SKILL.md: missing required name or description',
    })
  }

  return { frontmatter: frontmatter as unknown as SkillFrontmatter, content }
}

export interface SkillDirInfo {
  name: string
  children: PackageFileTree[]
}

/**
 * Find skill directories in a package file tree.
 * Returns skill names and their children for file counting.
 * @public
 */
export function findSkillDirs(tree: PackageFileTree[]): SkillDirInfo[] {
  const skillsDir = tree.find(node => node.type === 'directory' && node.name === 'skills')
  if (!skillsDir?.children) return []

  return skillsDir.children
    .filter(
      child =>
        child.type === 'directory' &&
        child.children?.some(f => f.type === 'file' && f.name === 'SKILL.md'),
    )
    .map(child => ({ name: child.name, children: child.children || [] }))
}

const countFilesRecursive = (nodes: PackageFileTree[]): number =>
  nodes.reduce((acc, n) => acc + (n.type === 'file' ? 1 : countFilesRecursive(n.children || [])), 0)

/**
 * Count files in skill subdirectories (scripts, references, assets).
 */
export function countSkillFiles(children: PackageFileTree[]): SkillFileCounts | undefined {
  const counts: SkillFileCounts = {}

  for (const child of children) {
    if (child.type !== 'directory') continue
    const name = child.name.toLowerCase()
    const count = countFilesRecursive(child.children || [])
    if (count === 0) continue
    if (name === 'scripts') counts.scripts = count
    else if (name === 'references' || name === 'refs')
      counts.references = (counts.references || 0) + count
    else if (name === 'assets') counts.assets = count
  }
  return Object.keys(counts).length ? counts : undefined
}

/**
 * Fetch file content from jsDelivr CDN with size limit.
 */
export async function fetchSkillFile(
  packageName: string,
  version: string,
  filePath: string,
): Promise<string> {
  const url = `https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filePath}`
  const response = await fetch(url)

  if (!response.ok) {
    if (response.status === 404) {
      throw createError({ statusCode: 404, message: 'File not found' })
    }
    throw createError({ statusCode: 502, message: 'Failed to fetch file from jsDelivr' })
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_SKILL_FILE_SIZE) {
    throw createError({
      statusCode: 413,
      message: `File too large (${(parseInt(contentLength, 10) / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_SKILL_FILE_SIZE / 1024}KB.`,
    })
  }

  const content = await response.text()

  if (content.length > MAX_SKILL_FILE_SIZE) {
    throw createError({
      statusCode: 413,
      message: `File too large (${(content.length / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_SKILL_FILE_SIZE / 1024}KB.`,
    })
  }

  return content
}

/**
 * Fetch and parse SKILL.md content for a skill.
 */
export async function fetchSkillContent(
  packageName: string,
  version: string,
  skillName: string,
): Promise<{ frontmatter: SkillFrontmatter; content: string }> {
  const raw = await fetchSkillFile(packageName, version, `skills/${skillName}/SKILL.md`)
  return parseFrontmatter(raw)
}

/**
 * Validate skill frontmatter and return warnings.
 */
export function validateSkill(frontmatter: SkillFrontmatter): SkillWarning[] {
  const warnings: SkillWarning[] = []
  if (!frontmatter.license) {
    warnings.push({ type: 'warning', message: 'No license specified' })
  }
  if (!frontmatter.compatibility) {
    warnings.push({ type: 'warning', message: 'No compatibility info' })
  }
  return warnings
}

/**
 * Fetch skill list with frontmatter for discovery endpoint.
 * @public
 */
export async function fetchSkillsList(
  packageName: string,
  version: string,
  skillDirs: SkillDirInfo[],
): Promise<SkillListItem[]> {
  const skills = await Promise.all(
    skillDirs.map(async ({ name: dirName, children }) => {
      try {
        const { frontmatter } = await fetchSkillContent(packageName, version, dirName)
        const warnings = validateSkill(frontmatter)
        const fileCounts = countSkillFiles(children)
        const item: SkillListItem = {
          name: frontmatter.name,
          description: frontmatter.description,
          dirName,
          license: frontmatter.license,
          compatibility: frontmatter.compatibility,
          warnings: warnings.length > 0 ? warnings : undefined,
          fileCounts,
        }
        return item
      } catch {
        return null
      }
    }),
  )
  return skills.filter((s): s is SkillListItem => s !== null)
}

export interface WellKnownSkillItem {
  name: string
  description: string
  files: string[]
}

/**
 * Fetch skill list for well-known index.json format (CLI compatibility).
 * @public
 */
export async function fetchSkillsListForWellKnown(
  packageName: string,
  version: string,
  skillNames: string[],
): Promise<WellKnownSkillItem[]> {
  const skills = await Promise.all(
    skillNames.map(async dirName => {
      try {
        const { frontmatter } = await fetchSkillContent(packageName, version, dirName)
        return { name: dirName, description: frontmatter.description, files: ['SKILL.md'] }
      } catch {
        return null
      }
    }),
  )
  return skills.filter((s): s is WellKnownSkillItem => s !== null)
}
