<script setup lang="ts">
const route = useRoute()

// Pages where scroll-to-top should NOT be shown
const excludedRoutes = new Set(['index', 'code'])

const isActive = computed(() => !excludedRoutes.has(route.name as string))

const isMounted = useMounted()
const isVisible = shallowRef(false)
const scrollThreshold = 300
const { isSupported: supportsScrollStateQueries } = useCssSupports(
  'container-type',
  'scroll-state',
  { ssrValue: false },
)

function onScroll() {
  if (!supportsScrollStateQueries.value) {
    return
  }
  isVisible.value = window.scrollY > scrollThreshold
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

useEventListener('scroll', onScroll, { passive: true })

onMounted(() => {
  onScroll()
})
</script>

<template>
  <!-- When CSS scroll-state is supported, use CSS-only visibility -->
  <button
    v-if="isActive && supportsScrollStateQueries"
    type="button"
    class="scroll-to-top-css fixed bottom-4 inset-ie-4 z-50 w-12 h-12 bg-bg-elevated border border-border rounded-full shadow-lg md:hidden flex items-center justify-center text-fg-muted hover:text-fg transition-colors active:scale-95"
    :aria-label="$t('common.scroll_to_top')"
    @click="scrollToTop"
  >
    <span class="i-carbon:arrow-up w-5 h-5" aria-hidden="true" />
  </button>

  <!-- JS fallback for browsers without scroll-state support -->
  <Transition
    v-else
    enter-active-class="transition-all duration-200"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <button
      v-if="isActive && isMounted && isVisible"
      type="button"
      class="fixed bottom-4 inset-ie-4 z-50 w-12 h-12 bg-bg-elevated border border-border rounded-full shadow-lg md:hidden flex items-center justify-center text-fg-muted hover:text-fg transition-colors active:scale-95"
      :aria-label="$t('common.scroll_to_top')"
      @click="scrollToTop"
    >
      <span class="i-carbon:arrow-up w-5 h-5" aria-hidden="true" />
    </button>
  </Transition>
</template>

<style scoped>
/*
 * CSS scroll-state container queries (Chrome 133+)
 * Hide button by default, show when page can be scrolled up (user has scrolled down)
 */
@supports (container-type: scroll-state) {
  .scroll-to-top-css {
    opacity: 0;
    transform: translateY(0.5rem);
    pointer-events: none;
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
  }

  @container scroll-state(scrollable: top) {
    .scroll-to-top-css {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
  }
}
</style>
