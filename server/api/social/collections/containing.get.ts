/**
 * GET /api/social/collections/containing?subject=<subjectRef>&cursor=&limit=
 *
 * Collections whose items include `subject`, a package URL or a collection AT-URI.
 * `limit=0` returns only the total.
 */
export default defineEventHandler(async event => {
  const subject = getQuery(event).subject
  if (typeof subject !== 'string' || !parseSubjectRef(subject)) {
    throw createError({ status: 400, message: 'Invalid subject' })
  }

  try {
    const utils = new CollectionsUtils()
    if (getQuery(event).limit === '0') {
      return { total: await utils.countCollectionsContaining(subject), items: [] }
    }
    const { cursor, limit } = getPaginationQuery(event)
    return await utils.getCollectionsContaining(subject, limit, cursor)
  } catch (error: unknown) {
    handleApiError(error, { statusCode: 502, message: 'Failed to get containing collections' })
  }
})
