/**
 * Indexes dev.npmx.collection records, and likes and follows of them, from Jetstream for browse.
 * Vercel Cron runs it through /api/cron/collections-index. In dev, run it from
 * Nuxt devtools or GET /_nitro/tasks/collections:index.
 */
export default defineTask({
  meta: {
    name: 'collections:index',
    description: 'Index collections and their likes and follows from Jetstream',
  },
  async run() {
    const result = await drainJetstream({
      store: getCollectionsIndexStore(),
      subscribe: webSocketMessages,
    })
    return { result }
  },
})
