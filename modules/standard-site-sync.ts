import process from 'node:process'
import { createHash } from 'node:crypto'
import { defineNuxtModule, useNuxt, createResolver } from 'nuxt/kit'
import { safeParse } from 'valibot'
import * as site from '../shared/types/lexicons/site'
import { BlogPostSchema } from '../shared/schemas/blog'
import { NPMX_SITE } from '../shared/utils/constants'
import { read } from 'gray-matter'
import { TID } from '@atproto/common'
import { Client } from '@atproto/lex'

const syncedDocuments = new Map<string, string>()
const CLOCK_ID_THREE = 3
const DATE_TO_MICROSECONDS = 1000

// TODO: Currently logging quite a lot, can remove some later if we want
export default defineNuxtModule({
  meta: { name: 'standard-site-sync' },
  async setup() {
    const nuxt = useNuxt()
    const { resolve } = createResolver(import.meta.url)
    const contentDir = resolve('../app/pages/blog')

    // Authentication with PDS using an app password
    const pdsUrl = process.env.NPMX_PDS_URL
    if (!pdsUrl) {
      console.warn('[standard-site-sync] NPMX_PDS_URL not set, skipping sync')
      return
    }
    // Instantiate a single new client instance that is reused for every file
    const client = new Client(pdsUrl)

    if (nuxt.options._prepare) return

    nuxt.hook('build:before', async () => {
      const { glob } = await import('tinyglobby')
      const files: string[] = await glob(`${contentDir}/**/*.md`)

      // INFO: Arbitrarily chosen concurrency limit, can be changed if needed
      const concurrencyLimit = 5
      for (let i = 0; i < files.length; i += concurrencyLimit) {
        const batch = files.slice(i, i + concurrencyLimit)
        // Process files in parallel
        await Promise.all(
          batch.map(file =>
            syncFile(file, NPMX_SITE, client).catch(error =>
              console.error(`[standard-site-sync] Error in ${file}:` + error),
            ),
          ),
        )
      }
    })

    nuxt.hook('builder:watch', async (event, path) => {
      if (!path.endsWith('.md')) return

      // Ignore deleted files
      if (event === 'unlink') {
        console.log(`[standard-site-sync] File deleted: ${path}`)
        return
      }

      // Process add/change events only
      await syncFile(resolve(nuxt.options.rootDir, path), NPMX_SITE, client).catch(err =>
        console.error(`[standard-site-sync] Failed ${path}:`, err),
      )
    })
  },
})

/*
 * INFO: Loads record to atproto and ensures uniqueness by checking the date the article is published
 * publishedAt is an id that does not change
 * Atomicity is enforced with upsert using publishedAt so we always update existing records instead of creating new ones
 * Clock id(3) provides a deterministic ID
 * WARN: DOES NOT CATCH ERRORS, THIS MUST BE HANDLED
 */
const syncFile = async (filePath: string, siteUrl: string, client: Client) => {
  const { data: frontmatter } = read(filePath)

  // Schema expects 'path' & frontmatter provides 'slug'
  const normalizedFrontmatter = {
    ...frontmatter,
    path: typeof frontmatter.slug === 'string' ? `/blog/${frontmatter.slug}` : frontmatter.path,
  }

  const result = safeParse(BlogPostSchema, normalizedFrontmatter)
  if (!result.success) {
    console.warn(`[standard-site-sync] Validation failed for ${filePath}`, result.issues)
    return
  }

  const data = result.output

  // filter drafts
  if (data.draft) {
    if (process.env.DEBUG === 'true') {
      console.debug(`[standard-site-sync] Skipping draft: ${data.path}`)
    }
    return
  }

  // Keys are sorted to provide a more stable hash
  const hash = createHash('sha256')
    .update(JSON.stringify(data, Object.keys(data).sort()))
    .digest('hex')

  if (syncedDocuments.get(data.path) === hash) {
    return
  }

  const document = site.standard.document.$build({
    site: siteUrl as `${string}:${string}`,
    path: data.path,
    title: data.title,
    description: data.description ?? data.excerpt,
    tags: data.tags,
    // This can be extended to update the site.standard.document .updatedAt if it is changed and use the posts date here
    publishedAt: new Date(data.date).toISOString(),
  })

  const dateInMicroSeconds = new Date(result.output.date).getTime() * DATE_TO_MICROSECONDS

  // Clock id(3) needs to be the same everytime to get the same TID from a timestamp
  const tid = TID.fromTime(dateInMicroSeconds, CLOCK_ID_THREE)

  // client.put is async and needs to be awaited
  await client.put(site.standard.document, document, {
    rkey: tid.str,
  })

  syncedDocuments.set(data.path, hash)
}
