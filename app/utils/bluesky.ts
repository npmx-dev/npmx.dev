export function atUriToWebUrl(atUri: string): string | null {
  // Convert AT URI to bsky.app URL
  // at://did:plc:xxx/app.bsky.feed.post/rkey -> https://bsky.app/profile/did:plc:xxx/post/rkey
  const match = atUri.match(AT_URI_REGEX)
  if (!match) return null
  const [, did, rkey] = match
  return `https://bsky.app/profile/${did}/post/${rkey}`
}
