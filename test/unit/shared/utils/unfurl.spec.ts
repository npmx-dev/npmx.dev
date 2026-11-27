import { describe, expect, it } from 'vite-plus/test'
import { isUnfurlUserAgent } from '#shared/utils/unfurl'

describe('isUnfurlUserAgent', () => {
  it.each([
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MicrosoftPreview/2.0',
    'Mozilla/5.0 (compatible; embedly/0.2; +http://support.embed.ly/)',
  ])('matches %s', userAgent => {
    expect(isUnfurlUserAgent(userAgent)).toBe(true)
  })

  it.each([
    undefined,
    '',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0',
  ])('does not match %s', userAgent => {
    expect(isUnfurlUserAgent(userAgent)).toBe(false)
  })
})
