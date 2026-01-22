export default defineCachedEventHandler(
  async (event) => {
    const query = getQuery(event)
    const text = String(query.q ?? '')
    const size = Math.min(Number(query.size) || 20, 250)
    const from = Number(query.from) || 0

    if (!text.trim()) {
      return { objects: [], total: 0, time: new Date().toISOString() }
    }

    try {
      return await fetchNpmSearch(text, size, from)
    }
    catch {
      throw createError({ statusCode: 502, message: 'Failed to search npm registry' })
    }
  },
  {
    maxAge: 60 * 2,
    getKey: (event) => {
      const query = getQuery(event)
      return `${query.q}:${query.size}:${query.from}`
    },
  },
)
