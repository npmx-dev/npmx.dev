import type { H3Event } from 'h3'
import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { SkillNameSchema } from '#shared/schemas/skills'
import type { SkillsListResponse, SkillContentResponse } from '#shared/types'
import {
  CACHE_MAX_AGE_ONE_HOUR,
  CACHE_MAX_AGE_ONE_YEAR,
  ERROR_SKILLS_FETCH_FAILED,
  ERROR_SKILL_NOT_FOUND,
  ERROR_SKILL_FILE_NOT_FOUND,
} from '#shared/utils/constants'
import { parsePackageParam } from '#shared/utils/parse-package-param'

const CACHE_VERSION = 1

/**
 * Skills discovery and content endpoint.
 *
 * URL patterns:
 * - /skills/vue/v/3.4.0                         → discovery (list skills)
 * - /skills/vue/v/3.4.0/my-skill                → skill content (SKILL.md parsed)
 * - /skills/vue/v/3.4.0/my-skill/refs/guide.md  → supporting file (raw)
 * - /skills/@scope/pkg/v/1.0.0                  → scoped package
 */
export default defineCachedEventHandler(
  async event => {
    const pkgParam = getRouterParam(event, 'pkg')
    if (!pkgParam) {
      throw createError({ statusCode: 404, message: 'Package name is required' })
    }

    const { packageName, version: rawVersion, rest } = parsePackageParam(pkgParam)

    try {
      const validated = v.parse(PackageRouteParamsSchema, { packageName, version: rawVersion })

      let version = validated.version
      let isVersioned = !!version
      if (!version) {
        const packument = await fetchNpmPackage(validated.packageName)
        version = packument['dist-tags']?.latest
        if (!version) {
          throw createError({ statusCode: 404, message: 'No latest version found' })
        }
      }

      // Set cache headers: 1 year for versioned, 1 hour for latest
      if (isVersioned) {
        setHeader(event, 'Cache-Control', `public, max-age=${CACHE_MAX_AGE_ONE_YEAR}, immutable`)
      }

      if (rest.length === 0) {
        return await handleDiscovery(validated.packageName, version)
      }

      const skillName = v.parse(SkillNameSchema, rest[0])

      if (rest.length === 1) {
        return await handleSkillContent(validated.packageName, version, skillName)
      }

      const filePath = rest.slice(1).join('/')
      return await handleSkillFile(event, validated.packageName, version, skillName, filePath)
    } catch (error) {
      handleApiError(error, { statusCode: 502, message: ERROR_SKILLS_FETCH_FAILED })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `skills:v${CACHE_VERSION}:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)

async function handleDiscovery(packageName: string, version: string): Promise<SkillsListResponse> {
  const fileTree = await getPackageFileTree(packageName, version)
  const skillDirs = findSkillDirs(fileTree.tree)

  if (skillDirs.length === 0) {
    return { package: packageName, version, skills: [] }
  }

  const skills = await fetchSkillsList(packageName, version, skillDirs)
  return { package: packageName, version, skills }
}

async function handleSkillContent(
  packageName: string,
  version: string,
  skillName: string,
): Promise<SkillContentResponse> {
  try {
    const { frontmatter, content } = await fetchSkillContent(packageName, version, skillName)
    return { package: packageName, version, skill: skillName, frontmatter, content }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
      throw createError({ statusCode: 404, message: ERROR_SKILL_NOT_FOUND })
    }
    throw error
  }
}

async function handleSkillFile(
  event: H3Event,
  packageName: string,
  version: string,
  skillName: string,
  filePath: string,
): Promise<string> {
  // Validate file path to prevent directory traversal
  if (filePath.includes('..') || filePath.startsWith('/')) {
    throw createError({ statusCode: 400, message: 'Invalid file path' })
  }

  // Only allow files within skill subdirectories (scripts/, references/, assets/)
  const allowedPrefixes = ['scripts/', 'references/', 'assets/', 'refs/']
  if (!allowedPrefixes.some(p => filePath.startsWith(p))) {
    throw createError({
      statusCode: 400,
      message: 'File must be in scripts/, references/, or assets/ subdirectory',
    })
  }

  try {
    const content = await fetchSkillFile(packageName, version, `skills/${skillName}/${filePath}`)

    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const contentTypes: Record<string, string> = {
      md: 'text/markdown',
      txt: 'text/plain',
      json: 'application/json',
      js: 'text/javascript',
      ts: 'text/typescript',
      sh: 'text/x-shellscript',
      py: 'text/x-python',
    }
    setHeader(event, 'Content-Type', contentTypes[ext] || 'text/plain')

    return content
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
      throw createError({ statusCode: 404, message: ERROR_SKILL_FILE_NOT_FOUND })
    }
    throw error
  }
}
