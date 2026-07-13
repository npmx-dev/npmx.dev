import { describe, expect, it } from 'vitest'
import { convertToEmoji } from '#shared/utils/emoji'

describe('convertToEmoji', () => {
  it('converts :1234: to emoji', () => {
    expect(convertToEmoji('Count :1234:')).toBe('Count 🔢')
  })

  it('leaves unknown shortcodes untouched', () => {
    expect(convertToEmoji(':not-an-emoji:')).toBe(':not-an-emoji:')
  })
})
