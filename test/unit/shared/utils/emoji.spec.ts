import { describe, expect, it } from 'vitest'
import { convertToEmoji } from '#shared/utils/emoji'

describe('convertToEmoji', () => {
  it('converts :1234: to emoji', () => {
    expect(convertToEmoji('<p>:1234:</p>')).toBe('<p>🔢</p>')
  })

  it('leaves :1234: in codeblocks untouched', () => {
    expect(convertToEmoji('<code>:1234:</code>')).toBe('<code>:1234:</code>')
  })

  it('converts :1234: to emoji outside of codeblock', () => {
    expect(convertToEmoji('<p>:1234:</p><code>:1234:</code>')).toBe('<p>🔢</p><code>:1234:</code>')
    expect(convertToEmoji('<code>:1234:</code><p>:1234:</p>')).toBe('<code>:1234:</code><p>🔢</p>')
  })
})
