import type { NpmsScore } from '#server/api/registry/score/[...pkg].get'

export function usePackageScore(name: MaybeRefOrGetter<string>) {
  return useLazyFetch<NpmsScore>(() => `/api/registry/score/${toValue(name)}`)
}
