import type { Author, ResolvedAuthor } from '#shared/schemas/blog'

/**
 * @public
 */
export function useAuthorProfiles(authors: Author[]) {
  const authorsJson = JSON.stringify(authors)

  const { data } = useFetch('/api/atproto/author-profiles', {
    query: {
      authors: authorsJson,
    },
  })

  const resolvedAuthors = computed<ResolvedAuthor[]>(
    () =>
      data.value?.authors ??
      authors.map(author => ({
        ...author,
        avatar: null,
        profileUrl: author.blueskyHandle
          ? `https://bsky.app/profile/${author.blueskyHandle}`
          : null,
      })),
  )

  return {
    resolvedAuthors,
  }
}
