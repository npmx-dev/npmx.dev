<script setup lang="ts">
const { selectedPackages, selectedPackagesParam, clearSelectedPackages } = usePackageSelection()

const shortcutKey = 'b'
const actionBar = useTemplateRef('actionBarRef')
onKeyStroke(
  e => {
    const target = e.target as HTMLElement
    const isCheckbox = target.hasAttribute('data-package-card-checkbox')
    return isKeyWithoutModifiers(e, shortcutKey) && (!isEditableElement(target) || isCheckbox)
  },
  e => {
    if (selectedPackages.value.length === 0) {
      return
    }

    e.preventDefault()
    actionBar.value?.focus()
  },
)
</script>

<template>
  <Transition name="action-bar-slide" appear>
    <section
      v-if="selectedPackages.length"
      aria-labelledby="action-bar-title"
      class="fixed bottom-10 inset-is-0 w-full flex items-center justify-center z-36 pointer-events-none"
    >
      <h3 id="action-bar-title" class="sr-only">
        {{ $t('action_bar.title') }}
      </h3>
      <div
        ref="actionBarRef"
        tabindex="-1"
        aria-keyshortcuts="b"
        class="pointer-events-auto bg-bg shadow-2xl shadow-accent/20 border-2 border-accent/60 p-3 min-w-[300px] rounded-xl flex gap-3 items-center justify-between animate-in ring-1 ring-accent/30"
      >
        <div aria-live="polite" aria-atomic="true" class="sr-only">
          {{ $t('action_bar.selection', selectedPackages.length) }}.
          {{ $t('action_bar.shortcut', { key: shortcutKey }) }}.
        </div>

        <div class="flex items-center gap-2">
          <span class="text-fg font-semibold text-sm flex items-center gap-1.5">
            <i class="i-ph:check-circle-fill text-accent text-base" aria-hidden="true"></i>
            {{ $t('action_bar.selection', selectedPackages.length) }}
          </span>
          <button
            @click="clearSelectedPackages"
            class="flex items-center ms-1 text-fg-muted hover:(text-fg bg-accent/10) p-1.5 rounded-lg transition-colors"
            aria-label="Close action bar"
          >
            <span class="i-lucide:x text-sm" aria-hidden="true" />
          </button>
        </div>

        <LinkBase
          :to="{ name: 'compare', query: { packages: selectedPackagesParam } }"
          variant="button-secondary"
          classicon="i-lucide:git-compare"
        >
          {{ $t('package.links.compare') }}
        </LinkBase>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
/* Action bar slide/fade animation */
.action-bar-slide-enter-active,
.action-bar-slide-leave-active {
  transition:
    opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.action-bar-slide-enter-from,
.action-bar-slide-leave-to {
  opacity: 0;
  transform: translateY(40px) scale(0.98);
}
.action-bar-slide-enter-to,
.action-bar-slide-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
