/**
 * GET /api/cron/collections-index
 *
 * Runs the Jetstream indexer. Vercel Cron calls this (nuxt.config.ts) with `CRON_SECRET` as a
 * bearer token; Nitro's `scheduledTasks` doesn't run on Vercel.
 */
export default defineEventHandler(async event => {
  const secret = process.env.CRON_SECRET
  if (!secret || getHeader(event, 'authorization') !== `Bearer ${secret}`) {
    throw createError({ status: 401, message: 'Unauthorized' })
  }
  const { result } = await runTask('collections:index')
  return result
})
