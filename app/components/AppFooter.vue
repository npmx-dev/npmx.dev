<script setup lang="ts">
import { NPMX_DOCS_SITE } from '#shared/utils/constants'

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
          <p class="font-mono text-balance m-0 hidden sm:block">
            {{ $t('tagline') }}
          </p>
        </div>
        <!-- Desktop: Show all links. Mobile: Links are in MobileMenu -->
        <div class="hidden sm:flex items-center gap-6 min-h-11 text-xs">
          <LinkBase :to="{ name: 'about' }">
            {{ $t('footer.about') }}
          </LinkBase>
          <LinkBase :to="{ name: 'privacy' }">
            {{ $t('privacy_policy.title') }}
          </LinkBase>
          <LinkBase :to="{ name: 'accessibility' }">
            {{ $t('a11y.footer_title') }}
          </LinkBase>
          <button
            type="button"
            class="group cursor-pointer gap-x-1 items-center rounded-sm font-mono text-fg hover:decoration-accent active:scale-[0.98] underline underline-offset-[0.2rem] decoration-1 decoration-fg/30 outline-2 outline-transparent focus-visible:(outline-offset-2 outline-accent text-accent) transition-colors duration-200"
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
                <kbd class="kbd">/</kbd>
                <span>{{ $t('shortcuts.focus_search') }}</span>
              </li>
              <li class="flex gap-2 items-center">
                <kbd class="kbd">?</kbd>
                <span>{{ $t('shortcuts.show_kbd_hints') }}</span>
              </li>
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
                <span>{{ $t('shortcuts.compare_from_package') }}</span>
              </li>
            </ul>
          </Modal>
          <LinkBase :to="NPMX_DOCS_SITE">
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
        </div>
      </div>
      <BuildEnvironment v-if="!isHome" footer />
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
