/** User agent tokens of link preview bots, which need server-rendered meta tags. */
const UNFURL_USER_AGENT_TOKENS = [
  'Slackbot',
  'Discordbot',
  'Twitterbot',
  'facebookexternalhit',
  'LinkedInBot',
  'TelegramBot',
  'WhatsApp',
  'Mastodon',
  'Cardyb',
  'redditbot',
  'SkypeUriPreview',
  'MicrosoftPreview',
  'Iframely',
  'Embedly',
  'embedly',
]

/** Matches the whole user agent header of a link preview bot. */
export const UNFURL_USER_AGENT_PATTERN = `.*(?:${UNFURL_USER_AGENT_TOKENS.join('|')}).*`

const UNFURL_USER_AGENT_RE = new RegExp(`^${UNFURL_USER_AGENT_PATTERN}$`)

export function isUnfurlUserAgent(userAgent: string | undefined): boolean {
  return !!userAgent && UNFURL_USER_AGENT_RE.test(userAgent)
}
