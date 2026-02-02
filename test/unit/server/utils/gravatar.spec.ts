import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#server/utils/npm', () => ({
  fetchUserEmail: vi.fn(),
}))

const { getGravatarFromUsername } = await import('../../../../server/utils/gravatar')
const { fetchUserEmail } = await import('#server/utils/npm')

describe('gravatar utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when username is empty', async () => {
    const hash = await getGravatarFromUsername('')

    expect(hash).toBeNull()
    expect(fetchUserEmail).not.toHaveBeenCalled()
  })

  it('returns null when email is not available', async () => {
    vi.mocked(fetchUserEmail).mockResolvedValue(null)

    const hash = await getGravatarFromUsername('user')

    expect(hash).toBeNull()
    expect(fetchUserEmail).toHaveBeenCalledOnce()
  })

  it('returns md5 hash of trimmed, lowercased email', async () => {
    const email = ' Test@Example.com '
    const normalized = 'test@example.com'
    const expectedHash = createHash('md5').update(normalized).digest('hex')
    vi.mocked(fetchUserEmail).mockResolvedValue(email)

    const hash = await getGravatarFromUsername('user')

    expect(hash).toBe(expectedHash)
  })

  it('trims the username before lookup', async () => {
    vi.mocked(fetchUserEmail).mockResolvedValue('user@example.com')

    await getGravatarFromUsername('  user  ')

    expect(fetchUserEmail).toHaveBeenCalledWith('user')
  })
})
