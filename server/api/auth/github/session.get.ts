import { useServerSession } from '#server/utils/server-session'

export default defineEventHandler(async event => {
  const session = await useServerSession(event)
  const github = session.data.github

  if (!github?.username || !github.accessToken) {
    return null
  }

  return { username: github.username }
})
