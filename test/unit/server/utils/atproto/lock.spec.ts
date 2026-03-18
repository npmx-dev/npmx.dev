import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockRedisSet = vi.fn()
const mockRedisGet = vi.fn()
const mockRedisDel = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: class {
    set = mockRedisSet
    get = mockRedisGet
    del = mockRedisDel
  },
}))

const mockLocalLock = vi.fn()
vi.mock('@atproto/oauth-client-node', () => ({
  requestLocalLock: mockLocalLock,
}))

const mockConfig = {
  upstash: {
    redisRestUrl: '',
    redisRestToken: '',
  },
}
vi.stubGlobal('useRuntimeConfig', () => mockConfig)

const LOCK_UUID = '00000000-0000-0000-0000-000000000000'
vi.spyOn(crypto, 'randomUUID').mockReturnValue(LOCK_UUID)

const { getOAuthLock } = await import('../../../../../server/utils/atproto/lock')

function getUpstashLock() {
  mockConfig.upstash.redisRestUrl = 'https://redis.example.com'
  mockConfig.upstash.redisRestToken = 'token-123'
  return getOAuthLock()
}

describe('lock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.upstash.redisRestUrl = ''
    mockConfig.upstash.redisRestToken = ''
  })

  it('returns local lock when upstash is not configured', () => {
    const lock = getOAuthLock()
    expect(lock).toBe(mockLocalLock)
  })

  it('returns local lock when only redisRestUrl is set', () => {
    mockConfig.upstash.redisRestUrl = 'https://totally-a-redis-server.com'
    const lock = getOAuthLock()
    expect(lock).toBe(mockLocalLock)
  })

  it('returns local lock when only redisRestToken is set', () => {
    mockConfig.upstash.redisRestToken = 'super-fancy-secret-token'
    const lock = getOAuthLock()
    expect(lock).toBe(mockLocalLock)
  })

  it('returns upstash lock when both url and token are configured', () => {
    mockConfig.upstash.redisRestUrl = 'https://redis.redis.redis'
    mockConfig.upstash.redisRestToken = 'token-123'
    const lock = getOAuthLock()
    expect(lock).not.toBe(mockLocalLock)
    expect(typeof lock).toBe('function')
  })

  it('acquires lock, runs fn, and releases lock', async () => {
    mockRedisSet.mockResolvedValueOnce('OK')
    mockRedisGet.mockResolvedValueOnce(LOCK_UUID)
    mockRedisDel.mockResolvedValueOnce(1)

    const lock = getUpstashLock()
    const result = await lock('test-key', () => 'hello')

    expect(result).toBe('hello')
    expect(mockRedisSet).toHaveBeenCalledOnce()
    expect(mockRedisSet).toHaveBeenCalledWith(`oauth:lock:test-key`, LOCK_UUID, {
      nx: true,
      ex: 30,
    })
    expect(mockRedisDel).toHaveBeenCalledWith('oauth:lock:test-key')
  })

  it('retries once if first acquire fails', async () => {
    mockRedisSet
      .mockResolvedValueOnce(null) // fail
      .mockResolvedValueOnce('OK') // success
    mockRedisGet.mockResolvedValueOnce(LOCK_UUID)
    mockRedisDel.mockResolvedValueOnce(1)

    const lock = getUpstashLock()
    const result = await lock('retry-key', () => 42)

    expect(result).toBe(42)
    expect(mockRedisSet).toHaveBeenCalledTimes(2)
    expect(mockRedisDel).toHaveBeenCalledWith('oauth:lock:retry-key')
  })

  it('proceeds without lock if both acquire attempts fail', async () => {
    mockRedisSet.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

    const lock = getUpstashLock()
    const result = await lock('no-lock-key', () => 'fallback')

    expect(result).toBe('fallback')
    expect(mockRedisSet).toHaveBeenCalledTimes(2)
    expect(mockRedisGet).not.toHaveBeenCalled()
    expect(mockRedisDel).not.toHaveBeenCalled()
  })

  it('does not delete lock if another instance took ownership', async () => {
    mockRedisSet.mockResolvedValueOnce('OK')
    mockRedisGet.mockResolvedValueOnce('some-other-uuid')

    const lock = getUpstashLock()
    await lock('stolen-key', () => 'done')

    expect(mockRedisGet).toHaveBeenCalledWith('oauth:lock:stolen-key')
    expect(mockRedisDel).not.toHaveBeenCalled()
  })

  it('releases lock even if fn throws', async () => {
    mockRedisSet.mockResolvedValueOnce('OK')
    mockRedisGet.mockResolvedValueOnce(LOCK_UUID)
    mockRedisDel.mockResolvedValueOnce(1)

    const lock = getUpstashLock()
    await expect(
      lock('error-key', () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    expect(mockRedisDel).toHaveBeenCalledWith('oauth:lock:error-key')
  })

  it('works with async fn', async () => {
    mockRedisSet.mockResolvedValueOnce('OK')
    mockRedisGet.mockResolvedValueOnce(LOCK_UUID)
    mockRedisDel.mockResolvedValueOnce(1)

    const lock = getUpstashLock()
    const result = await lock('async-key', async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return 'async-result'
    })

    expect(result).toBe('async-result')
  })
})
