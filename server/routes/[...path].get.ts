import type { H3Event } from 'h3'
import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { SkillNameSchema } from '#shared/schemas/skills'
import { CACHE_MAX_AGE_ONE_HOUR, CACHE_MAX_AGE_ONE_YEAR } from '#shared/utils/constants'

const CACHE_VERSION = 1

/**
 * Well-known skills endpoint for `npx skills add` CLI compatibility.
 *
 * URL patterns:
 * - /vue/.well-known/skills/index.json         → skills index
 * - /vue/.well-known/skills/my-skill/SKILL.md  → raw SKILL.md
 * - /@scope/pkg/.well-known/skills/...         → scoped packages
 */
export default defineCachedEventHandler(
  async event => {
    const path = getRouterParam(event, 'path') || ''

    const match = path.match(/^(.+?)\/\.well-known\/skills\/(.*)$/)
    if (!match) {
      // Not a well-known skills request, return 404 to let other handlers deal with it
      throw createError({ statusCode: 404, message: 'Not found' })
    }

    const [, pkgPath, skillsPath] = match
    const packageName = pkgPath!

    try {
      const validated = v.parse(PackageRouteParamsSchema, { packageName, version: undefined })

      // Always resolve to latest for well-known endpoint
      const packument = await fetchNpmPackage(validated.packageName)
      const version = packument['dist-tags']?.latest
      if (!version) {
        throw createError({ statusCode: 404, message: 'No latest version found' })
      }

      if (skillsPath === 'index.json' || skillsPath === '') {
        return await handleWellKnownIndex(event, validated.packageName, version)
      }

      const parts = skillsPath!.split('/')
      const skillName = v.parse(SkillNameSchema, parts[0])
      const fileName = parts.slice(1).join('/')

      if (fileName === 'SKILL.md' || fileName === '') {
        return await handleWellKnownSkillMd(event, validated.packageName, version, skillName)
      }

      throw createError({ statusCode: 404, message: 'File not found' })
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) throw error
      throw createError({ statusCode: 500, message: 'Failed to fetch skills' })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const path = getRouterParam(event, 'path') ?? ''
      return `well-known-skills:v${CACHE_VERSION}:${path.replace(/\/+$/, '').trim()}`
    },
  },
)

async function handleWellKnownIndex(event: H3Event, packageName: string, version: string) {
  const fileTree = await getPackageFileTree(packageName, version)
  const skillDirs = findSkillDirs(fileTree.tree)

  if (skillDirs.length === 0) {
    return { skills: [] }
  }

  const skillNames = skillDirs.map(s => s.name)
  const skills = await fetchSkillsListForWellKnown(packageName, version, skillNames)

  setHeader(event, 'Cache-Control', `public, max-age=${CACHE_MAX_AGE_ONE_HOUR}`)
  setHeader(event, 'Content-Type', 'application/json')

  return { skills }
}

async function handleWellKnownSkillMd(
  event: H3Event,
  packageName: string,
  version: string,
  skillName: string,
) {
  try {
    const content = await fetchSkillFile(packageName, version, `skills/${skillName}/SKILL.md`)

    setHeader(event, 'Cache-Control', `public, max-age=${CACHE_MAX_AGE_ONE_YEAR}, immutable`)
    setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')

    return content
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
      throw createError({ statusCode: 404, message: 'SKILL.md not found' })
    }
    throw error
  }
}
