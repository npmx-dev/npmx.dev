import type { Author, ResolvedAuthor } from '#shared/schemas/blog'

/**
 * Fetches author avatar URLs and profile links from the Bluesky API (AT Protocol).
 *
 * Makes a server-side request to `/api/atproto/bluesky-author-profiles`, which looks up
 * each author's Bluesky profile to retrieve their avatar. Results are cached for 1 day.
 *
 * While the fetch is pending (or if it fails), returns authors with `avatar: null`
 * and a constructed profile URL as fallback.
 */
export function useBlueskyAuthorProfiles(authors: Author[]) {
  const authorsJson = JSON.stringify(authors)

  const { data } = useFetch('/api/atproto/bluesky-author-profiles', {
    query: {
      authors: authorsJson,
    },
  })

  const resolvedAuthors = computed<ResolvedAuthor[]>(
    () => data.value?.authors ?? withoutBlueskyData(authors),
  )

  return {
    resolvedAuthors,
  }
}

function withoutBlueskyData(authors: Author[]): ResolvedAuthor[] {
  return authors.map(author => ({
    ...author,
    avatar: null,
    profileUrl: author.blueskyHandle ? `https://bsky.app/profile/${author.blueskyHandle}` : null,
  }))
}
