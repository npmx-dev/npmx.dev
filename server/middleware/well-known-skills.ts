import type { H3Event } from 'h3'
import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { SkillNameSchema } from '#shared/schemas/skills'
import { CACHE_MAX_AGE_ONE_HOUR, CACHE_MAX_AGE_ONE_YEAR } from '#shared/utils/constants'

/**
 * Serves /.well-known/skills endpoints for `npx skills add` CLI.
 * Middleware pattern allows non-matching paths to pass through to Nuxt.
 */
export default defineEventHandler(event => {
  const url = getRequestURL(event)
  const match = url.pathname.match(/^\/(.+?)\/\.well-known\/skills\/(.*)$/)
  if (!match) return

  return cachedHandler(event)
})

const cachedHandler = defineCachedEventHandler(
  async (event: H3Event) => {
    const url = getRequestURL(event)
    const match = url.pathname.match(/^\/(.+?)\/\.well-known\/skills\/(.*)$/)!
    const [, pkgPath, skillsPath] = match

    const validated = v.parse(PackageRouteParamsSchema, {
      packageName: pkgPath,
      version: undefined,
    })
    const packument = await fetchNpmPackage(validated.packageName)
    const version = packument['dist-tags']?.latest
    if (!version) throw createError({ statusCode: 404, message: 'No latest version found' })

    if (skillsPath === 'index.json' || skillsPath === '') {
      const fileTree = await getPackageFileTree(validated.packageName, version)
      const skillDirs = findSkillDirs(fileTree.tree)
      const skills = skillDirs.length
        ? await fetchSkillsListForWellKnown(
            validated.packageName,
            version,
            skillDirs.map(s => s.name),
          )
        : []
      setHeader(event, 'Cache-Control', `public, max-age=${CACHE_MAX_AGE_ONE_HOUR}`)
      setHeader(event, 'Content-Type', 'application/json')
      return { skills }
    }

    const [skillName, ...rest] = skillsPath!.split('/')
    const fileName = rest.join('/')
    if (fileName === 'SKILL.md' || fileName === '') {
      const content = await fetchSkillFile(
        validated.packageName,
        version,
        `skills/${v.parse(SkillNameSchema, skillName)}/SKILL.md`,
      )
      setHeader(event, 'Cache-Control', `public, max-age=${CACHE_MAX_AGE_ONE_YEAR}, immutable`)
      setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
      return content
    }

    throw createError({ statusCode: 404, message: 'File not found' })
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: (event: H3Event) =>
      `well-known-skills:v1:${getRequestURL(event).pathname.replace(/\/+$/, '')}`,
  },
)
