import { describe, expect, it } from 'vitest'
import { getNextVersion } from '../../../scripts/next-version'

describe('getNextVersion', () => {
  it('returns current, next, and from fields', async () => {
    const result = await getNextVersion()

    expect(result).toHaveProperty('current')
    expect(result).toHaveProperty('next')
    expect(result).toHaveProperty('from')
  })

  it('returns valid semver strings', async () => {
    const result = await getNextVersion()

    expect(result.current).toMatch(/^\d+\.\d+\.\d+$/)
    expect(result.next).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('returns a next version >= current version', async () => {
    const result = await getNextVersion()

    const [curMajor, curMinor, curPatch] = result.current.split('.').map(Number)
    const [nextMajor, nextMinor, nextPatch] = result.next.split('.').map(Number)

    const curNum = curMajor! * 1_000_000 + curMinor! * 1_000 + curPatch!
    const nextNum = nextMajor! * 1_000_000 + nextMinor! * 1_000 + nextPatch!

    expect(nextNum).toBeGreaterThanOrEqual(curNum)
  })
})
