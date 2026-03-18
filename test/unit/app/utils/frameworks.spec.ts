import { describe, expect, it } from 'vitest'
import {
  SHOWCASED_FRAMEWORKS,
  getFrameworkColor,
  isListedFramework,
  type ShowcasedFramework,
} from '../../../../app/utils/frameworks'

describe('getFrameworkColor', () => {
  it('returns the color a listed framework', () => {
    SHOWCASED_FRAMEWORKS.forEach((framework: ShowcasedFramework) => {
      expect(getFrameworkColor(framework.package)).toBe(framework.color)
    })
  })
})

describe('isListedFramework', () => {
  it('returns true for a listed framework', () => {
    SHOWCASED_FRAMEWORKS.forEach((framework: ShowcasedFramework) => {
      expect(isListedFramework(framework.package)).toBe(true)
    })
  })

  it('returns false for non listed frameworks', () => {
    expect(isListedFramework('leftpad')).toBe(false)
  })
})
