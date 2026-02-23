import { useServerSession } from '#server/utils/server-session'

export default defineEventHandler(async event => {
  const session = await useServerSession(event)

  await session.update({
    github: undefined,
  })

  return 'GitHub disconnected'
})
