import { createHash } from 'node:crypto'
import { fetchUserEmail } from '#server/utils/npm'

export async function getGravatarFromUsername(username: string): Promise<string | null> {
  const handle = username.trim()
  if (!handle) return null

  const email = await fetchUserEmail(handle)
  if (!email) return null

  const trimmedEmail = email.trim().toLowerCase()
  return createHash('md5').update(trimmedEmail).digest('hex')
}
