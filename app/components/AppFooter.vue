<script setup lang="ts">
const route = useRoute()
const isHome = computed(() => route.name === 'index')

const modalRef = useTemplateRef('modalRef')
const showModal = () => modalRef.value?.showModal?.()
</script>

<template>
  <footer class="border-t border-border mt-auto">
    <div class="container py-3 sm:py-8 flex flex-col gap-2 sm:gap-4 text-fg-subtle text-sm">
      <div
        class="flex flex-col sm:flex-row sm:flex-wrap items-center sm:items-baseline justify-between gap-2 sm:gap-4"
      >
        <div>
          <p class="font-mono text-balance m-0 hidden sm:block">{{ $t('tagline') }}</p>
          <BuildEnvironment v-if="!isHome" footer />
        </div>
        <!-- Desktop: Show all links. Mobile: Links are in MobileMenu -->
        <div class="hidden sm:flex items-center gap-6 min-h-11 text-xs">
          <LinkBase :to="{ name: 'about' }">
            {{ $t('footer.about') }}
          </LinkBase>
          <LinkBase :to="{ name: 'privacy' }">
            {{ $t('privacy_policy.title') }}
          </LinkBase>
          <LinkBase to="https://docs.npmx.dev">
            {{ $t('footer.docs') }}
          </LinkBase>
          <LinkBase to="https://repo.npmx.dev">
            {{ $t('footer.source') }}
          </LinkBase>
          <LinkBase to="https://social.npmx.dev">
            {{ $t('footer.social') }}
          </LinkBase>
          <LinkBase to="https://chat.npmx.dev">
            {{ $t('footer.chat') }}
          </LinkBase>

          <button
            type="button"
            class="group inline-flex gap-x-1 items-center justify-center underline-offset-[0.2rem] underline decoration-1 decoration-fg/30 font-mono text-fg hover:(decoration-accent text-accent) focus-visible:(decoration-accent text-accent) transition-colors duration-200"
            @click.prevent="showModal"
            aria-haspopup="dialog"
          >
            {{ $t('footer.keyboard_shortcuts') }}
          </button>

          <Modal
            ref="modalRef"
            :modalTitle="$t('footer.keyboard_shortcuts')"
            class="w-auto max-w-lg"
          >
            <p class="mb-2 font-mono text-fg-subtle">
              {{ $t('shortcuts.section.global') }}
            </p>
            <ul class="mb-6 flex flex-col gap-2">
              <li class="flex gap-2 items-center">
                <kbd class="kbd">,</kbd>
                <span>{{ $t('shortcuts.settings') }}</span>
              </li>
              <li class="flex gap-2 items-center">
                <kbd class="kbd">c</kbd>
                <span>{{ $t('shortcuts.compare') }}</span>
              </li>
            </ul>
            <p class="mb-2 font-mono text-fg-subtle">
              {{ $t('shortcuts.section.search') }}
            </p>
            <ul class="mb-6 flex flex-col gap-2">
              <li class="flex gap-2 items-center">
                <kbd class="kbd">↑</kbd>/<kbd class="kbd">↓</kbd>
                <span>{{ $t('shortcuts.navigate_results') }}</span>
              </li>
              <li class="flex gap-2 items-center">
                <kbd class="kbd">Enter</kbd>
                <span>{{ $t('shortcuts.go_to_result') }}</span>
              </li>
            </ul>
            <p class="mb-2 font-mono text-fg-subtle">
              {{ $t('shortcuts.section.package') }}
            </p>
            <ul class="mb-6 flex flex-col gap-2">
              <li class="flex gap-2 items-center">
                <kbd class="kbd">.</kbd>
                <span>{{ $t('shortcuts.open_code_view') }}</span>
              </li>
              <li class="flex gap-2 items-center">
                <kbd class="kbd">d</kbd>
                <span>{{ $t('shortcuts.open_docs') }}</span>
              </li>
              <li class="flex gap-2 items-center">
                <kbd class="kbd">c</kbd>
                <span>{{ $t('shortcuts.open_compare_prefilled') }}</span>
              </li>
            </ul>
          </Modal>
        </div>
      </div>
      <p class="text-xs text-fg-muted text-center sm:text-start m-0">
        <span class="sm:hidden">{{ $t('non_affiliation_disclaimer') }}</span>
        <span class="hidden sm:inline">{{ $t('trademark_disclaimer') }}</span>
      </p>
    </div>
  </footer>
</template>

<style scoped>
.kbd {
  @apply items-center justify-center text-sm text-fg bg-bg-muted border border-border rounded px-2;
}
</style>
