export default defineNuxtPlugin({
  enforce: 'pre',
  setup(nuxtApp) {
    // TODO: investigate why this is needed
    nuxtApp.payload.data ||= {}

    // When a _payload.json returns an ISR fallback (empty payload), data fetching composables
    // with non-undefined defaults skip refetching during hydration. After hydration completes,
    // refresh all async data so these composables (e.g. README, skills, package analysis) fetch
    // fresh data.
    if (
      nuxtApp.isHydrating &&
      nuxtApp.payload.serverRendered &&
      !Object.keys(nuxtApp.payload.data).length
    ) {
      nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
        refreshNuxtData()
      })
    }
  },
})
