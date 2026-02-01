import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#server/utils/npm', () => ({
  fetchUserEmail: vi.fn(),
}))

const { getGravatarFromUsername } = await import('../../../../server/utils/gravatar')
const { fetchUserEmail } = await import('#server/utils/npm')

const mockFetch = vi.fn()

describe('gravatar utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('returns null when username is empty', async () => {
    const url = await getGravatarFromUsername('')

    expect(url).toBeNull()
    expect(fetchUserEmail).not.toHaveBeenCalled()
  })

  it('returns null when email is not available', async () => {
    vi.mocked(fetchUserEmail).mockResolvedValue(null)

    const url = await getGravatarFromUsername('user')

    expect(url).toBeNull()
    expect(fetchUserEmail).toHaveBeenCalledOnce()
  })

  it('builds a gravatar data URL with a trimmed, lowercased email hash', async () => {
    const email = ' Test@Example.com '
    const normalized = 'test@example.com'
    const hash = createHash('md5').update(normalized).digest('hex')
    const imageBytes = new Uint8Array([1, 2, 3])
    const base64 = Buffer.from(imageBytes).toString('base64')
    vi.mocked(fetchUserEmail).mockResolvedValue(email)
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: vi.fn().mockResolvedValue(imageBytes.buffer),
    })

    const url = await getGravatarFromUsername('user')

    expect(url).toBe(`data:image/png;base64,${base64}`)
    expect(mockFetch).toHaveBeenCalledWith(`https://www.gravatar.com/avatar/${hash}?s=80&d=404`)
  })

  it('supports custom size', async () => {
    const email = 'user@example.com'
    const hash = createHash('md5').update(email).digest('hex')
    const imageBytes = new Uint8Array([4, 5, 6])
    const base64 = Buffer.from(imageBytes).toString('base64')
    vi.mocked(fetchUserEmail).mockResolvedValue(email)
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: vi.fn().mockResolvedValue(imageBytes.buffer),
    })

    const url = await getGravatarFromUsername('user', 128)

    expect(url).toBe(`data:image/png;base64,${base64}`)
    expect(mockFetch).toHaveBeenCalledWith(`https://www.gravatar.com/avatar/${hash}?s=128&d=404`)
  })

  it('trims the username before lookup', async () => {
    vi.mocked(fetchUserEmail).mockResolvedValue('user@example.com')

    await getGravatarFromUsername('  user  ')

    expect(fetchUserEmail).toHaveBeenCalledWith('user')
  })
})
