import { PublicUserSessionSchema } from '#shared/schemas/publicUserSession'
import { safeParse } from 'valibot'

export default defineEventHandler(async event => {
  const serverSession = await useServerSession(event)
  const result = safeParse(PublicUserSessionSchema, serverSession.data.public)
  if (!result.success) {
    return null
  }

  return result.output
})
