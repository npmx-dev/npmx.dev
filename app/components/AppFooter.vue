<script setup lang="ts">
const isMounted = shallowRef(false)
const isVisible = shallowRef(false)
const isScrollable = shallowRef(true)
const lastScrollY = shallowRef(0)
const footerRef = useTemplateRef('footerRef')

// Check if CSS scroll-state container queries are supported
// Once this becomes baseline, we can remove the JS scroll handling entirely
const supportsScrollStateQueries = useSupported(() => {
  return isMounted.value && CSS.supports('container-type', 'scroll-state')
})

function checkScrollable() {
  return document.documentElement.scrollHeight > window.innerHeight
}

function onScroll() {
  // Skip JS-based visibility logic if CSS scroll-state queries handle it
  if (supportsScrollStateQueries.value) return

  const currentY = window.scrollY
  const diff = lastScrollY.value - currentY
  const nearBottom = currentY + window.innerHeight >= document.documentElement.scrollHeight - 50

  // Scrolling UP or near bottom -> show
  if (Math.abs(diff) > 10) {
    isVisible.value = diff > 0 || nearBottom
    lastScrollY.value = currentY
  }

  // At top -> hide
  if (currentY < 100) {
    isVisible.value = false
  }

  // Near bottom -> always show
  if (nearBottom) {
    isVisible.value = true
  }
}

function updateFooterPadding() {
  const height = isScrollable.value && footerRef.value ? footerRef.value.offsetHeight : 0
  document.documentElement.style.setProperty('--footer-height', `${height}px`)
}

function onResize() {
  isScrollable.value = checkScrollable()
  updateFooterPadding()
}

useEventListener('scroll', onScroll, { passive: true })
useEventListener('resize', onResize, { passive: true })

onMounted(() => {
  nextTick(() => {
    lastScrollY.value = window.scrollY
    isScrollable.value = checkScrollable()
    updateFooterPadding()
    // Only apply dynamic classes after mount to avoid hydration mismatch
    isMounted.value = true
  })
})
</script>

<template>
  <footer
    ref="footerRef"
    aria-label="Site footer"
    class="border-t border-border bg-bg/90 backdrop-blur-md"
    :class="[
      // When CSS scroll-state queries are supported, use CSS-only approach
      supportsScrollStateQueries
        ? 'footer-scroll-state'
        : // JS-controlled: fixed position, hidden by default, transition only after mount
          isScrollable
          ? [
              'fixed bottom-0 left-0 right-0 z-40',
              isMounted && 'transition-transform duration-300 ease-out',
              isVisible ? 'translate-y-0' : 'translate-y-full',
            ]
          : 'mt-auto',
    ]"
  >
    <div class="container py-2 sm:py-6 flex flex-col gap-1 sm:gap-3 text-fg-subtle text-sm">
      <div class="flex flex-row items-center justify-between gap-2 sm:gap-4">
        <p class="font-mono m-0 hidden sm:block">{{ $t('tagline') }}</p>
        <!-- On mobile, show disclaimer here instead of tagline -->
        <p class="text-xs text-fg-muted m-0 sm:hidden">{{ $t('non_affiliation_disclaimer') }}</p>
        <div class="flex items-center gap-4 sm:gap-6">
          <a
            href="https://repo.npmx.dev"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs min-h-11 min-w- flex items-center"
          >
            {{ $t('footer.source') }}
          </a>
          <a
            href="https://social.npmx.dev"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs min-h-11 min-w-11 flex items-center"
          >
            {{ $t('footer.social') }}
          </a>
          <a
            href="https://chat.npmx.dev"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs min-h-11 min-w-11 flex items-center"
          >
            {{ $t('footer.chat') }}
          </a>
        </div>
      </div>
      <p class="text-xs text-fg-muted text-center sm:text-left m-0 hidden sm:block">
        {{ $t('trademark_disclaimer') }}
      </p>
    </div>
  </footer>
</template>

<style scoped>
/*
 * CSS scroll-state container queries (Chrome 133+)
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@container#scroll-state_container_descriptors
 *
 * This provides a pure CSS solution for showing/hiding the footer based on scroll state.
 * The JS fallback handles browsers without support.
 * Once scroll-state queries become baseline, we can remove the JS scroll handling entirely.
 */
@supports (container-type: scroll-state) {
  .footer-scroll-state {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 40;
    /* Hidden by default (translated off-screen) */
    transform: translateY(100%);
    transition: transform 0.3s ease-out;
  }

  /* Show footer when user can scroll up (meaning they've scrolled down) */
  @container scroll-state(scrollable: top) {
    .footer-scroll-state {
      transform: translateY(0);
    }
  }
}
</style>
