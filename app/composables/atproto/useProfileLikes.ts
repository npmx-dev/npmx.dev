export type LikesResult = {
  records: {
    value: {
      subjectRef: string
    }
  }[]
}

export function useProfileLikes(handle: MaybeRefOrGetter<string>) {
  const asyncData = useLazyFetch<LikesResult>(() => `/api/social/profile/${toValue(handle)}/likes`)

  return asyncData
}
