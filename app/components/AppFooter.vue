<script setup lang="ts">
const isVisible = ref(false)
const isScrollable = ref(true)
const lastScrollY = ref(0)
const footerRef = ref<HTMLElement>()

function checkScrollable() {
  const mainContent = document.getElementById('main-content')
  if (!mainContent) return true
  return mainContent.scrollHeight > window.innerHeight
}

function onScroll() {
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

onMounted(() => {
  nextTick(() => {
    lastScrollY.value = window.scrollY
    isScrollable.value = checkScrollable()
    updateFooterPadding()
  })

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener(
    'resize',
    () => {
      isScrollable.value = checkScrollable()
      updateFooterPadding()
    },
    { passive: true },
  )
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <footer
    ref="footerRef"
    class="border-t border-border bg-bg"
    :class="
      isScrollable
        ? [
            'fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-out',
            isVisible ? 'translate-y-0' : 'translate-y-full',
          ]
        : 'mt-auto'
    "
  >
    <div class="container py-6 flex flex-col gap-3 text-fg-subtle text-sm">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="font-mono m-0">a better browser for the npm registry</p>
        <div class="flex items-center gap-6">
          <a
            href="https://github.com/danielroe/npmx.dev"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs"
          >
            source
          </a>
          <span class="text-border">|</span>
          <a href="https://roe.dev" rel="noopener noreferrer" class="link-subtle font-mono text-xs">
            @danielroe
          </a>
        </div>
      </div>
      <p class="text-xs text-fg-subtle/60 text-center sm:text-left m-0">
        npm is a registered trademark of npm, Inc. This site is not affiliated with npm, Inc.
      </p>
    </div>
  </footer>
</template>
