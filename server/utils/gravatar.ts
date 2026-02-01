import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { fetchUserEmail } from '#server/utils/npm'

const DEFAULT_GRAVATAR_SIZE = 80

export async function getGravatarFromUsername(
  username: string,
  size: number = DEFAULT_GRAVATAR_SIZE,
): Promise<string | null> {
  const handle = username.trim()
  if (!handle) return null

  const email = await fetchUserEmail(handle)
  if (!email) return null

  const trimmedEmail = email.trim().toLowerCase()
  const md5Hash = createHash('md5').update(trimmedEmail).digest('hex')
  const gravatarUrl = `https://www.gravatar.com/avatar/${md5Hash}?s=${size}&d=404`

  try {
    const response = await fetch(gravatarUrl)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}
