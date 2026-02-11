/**
 * Creates a computed property that uses route query parameters by default,
 * with an option to use local state instead.
 */
export function usePermalink<T extends string = string>(
  queryKey: string,
  defaultValue: T = '' as T,
  options: { permanent?: boolean } = {},
): WritableComputedRef<T> {
  const { permanent = true } = options
  const localValue = shallowRef<T>(defaultValue)
  const routeValue = useRouteQuery<T>(queryKey, defaultValue)

  const permalinkValue = computed({
    get: () => (permanent ? routeValue.value : localValue.value),
    set: (value: T) => {
      if (permanent) {
        routeValue.value = value
      } else {
        localValue.value = value
      }
    },
  })

  return permalinkValue
}
