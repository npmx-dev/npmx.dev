import { describe, expect, it } from 'vitest'
import { createHeadingVersionMatcher } from '~/utils/header-version-matcher'

describe('createHeadingVersionMatcher', () => {
  it('should only match version 3.5.1', () => {
    const isMatching = createHeadingVersionMatcher('3.5.1')

    expect(isMatching('test-pkg@3.5.1')).toBe(true)
    expect(isMatching('test-pkg: 3.5.1')).toBe(true)
    expect(isMatching('v3.5.1 (2026-03-03)')).toBe(true)
    expect(isMatching('3.5.1')).toBe(true)
    expect(isMatching('3.5.1/3.5.2')).toBe(true)
    expect(isMatching('v3.5.0/v3.5.1')).toBe(true)

    expect(isMatching('test-pkg@3.5.15')).toBe(false)
    expect(isMatching('test-pkg: 3.5.15')).toBe(false)
    expect(isMatching('v3.5.15 (2026-03-03)')).toBe(false)
    expect(isMatching('3.5.15')).toBe(false)
    expect(isMatching('3.5.12/3.5.20')).toBe(false)
    expect(isMatching('3.5.9/3.5.10')).toBe(false)
  })
})
