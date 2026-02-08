<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { onClickOutside, onKeyDown } from '@vueuse/core'
import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'

const route = useRoute()
const isHome = computed(() => route.name === 'index')

const triggerRef = ref<HTMLElement | null>(null)
const popoverRef = useTemplateRef<HTMLElement>('popoverRef')
const showPopover = ref(false)

const togglePopover = (e?: Event) => {
  e?.stopPropagation()
  showPopover.value = !showPopover.value
}

onClickOutside(
  popoverRef,
  () => {
    showPopover.value = false
  },
  { ignore: [triggerRef] },
)

onKeyDown(
  'Escape',
  (e: KeyboardEvent) => {
    if (!showPopover.value) return
    e.preventDefault()
    e.stopImmediatePropagation()
    showPopover.value = false
  },
  { dedupe: true },
)

const { activate, deactivate } = useFocusTrap(popoverRef, { allowOutsideClick: true })
watch(showPopover, async open => {
  if (open) {
    await nextTick()
    activate()
    popoverRef.value?.focus?.()
  } else {
    deactivate()
    triggerRef.value?.focus?.()
  }
})
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
            ref="triggerRef"
            type="button"
            class="group inline-flex gap-x-1 items-center justify-center underline-offset-[0.2rem] underline decoration-1 decoration-fg/30 font-mono text-fg hover:(decoration-accent text-accent) focus-visible:(decoration-accent text-accent) transition-colors duration-200"
            @click.prevent="togglePopover"
            :aria-expanded="showPopover ? 'true' : 'false'"
            aria-haspopup="dialog"
          >
            {{ $t('footer.keyboard_shortcuts') }}
          </button>

          <Teleport to="body">
            <Transition
              enter-active-class="transition-opacity duration-0 motion-reduce:transition-none"
              leave-active-class="transition-opacity duration-0 motion-reduce:transition-none"
              enter-from-class="opacity-0"
              leave-to-class="opacity-0"
            >
              <div v-show="showPopover">
                <div
                  class="fixed inset-0 bg-bg-elevated/70 dark:bg-bg-elevated/90 z-[9998]"
                  @click="showPopover = false"
                  aria-hidden="true"
                ></div>

                <div class="fixed inset-0 z-[9999] flex items-center justify-center">
                  <div
                    ref="popoverRef"
                    tabindex="-1"
                    class="mx-4 max-w-lg w-full p-6 bg-bg border border-border rounded-lg shadow-xl text-sm text-fg"
                    role="dialog"
                    :aria-label="$t('footer.keyboard_shortcuts')"
                  >
                    <div class="flex justify-between mb-8">
                      <p class="m-0 font-mono text-fg-subtle">
                        {{ $t('footer.keyboard_shortcuts') }}
                      </p>
                      <button
                        class="text-xs text-link hover:underline flex items-center gap-2"
                        type="button"
                        @click="showPopover = false"
                      >
                        <span aria-hidden="true" class="size-5 i-lucide-x" />
                        <span class="sr-only">{{ $t('common.close') }}</span>
                      </button>
                    </div>
                    <p class="mb-2 font-mono text-fg-subtle">
                      {{ $t('shortcuts.section.global') }}
                    </p>
                    <ul class="mb-8 flex flex-col gap-2">
                      <li class="flex gap-2 items-center">
                        <kbd
                          class="items-center justify-center text-sm text-fg bg-bg-muted border border-border rounded px-2"
                          >,</kbd
                        ><span>{{ $t('shortcuts.settings') }}</span>
                      </li>
                      <li class="flex gap-2 items-center">
                        <kbd
                          class="items-center justify-center text-sm text-fg bg-bg-muted border border-border rounded px-2"
                          >c</kbd
                        ><span>{{ $t('shortcuts.compare') }}</span>
                      </li>
                    </ul>
                    <p class="mb-2 font-mono text-fg-subtle">
                      {{ $t('shortcuts.section.search') }}
                    </p>
                    <ul class="mb-8 flex flex-col gap-2">
                      <li class="flex gap-2 items-center">
                        <kbd
                          class="items-center justify-center text-sm text-fg bg-bg-muted border border-border rounded px-2"
                          >↑</kbd
                        >/<kbd
                          class="items-center justify-center text-sm text-fg bg-bg-muted border border-border rounded px-2"
                          >↓</kbd
                        ><span>{{ $t('shortcuts.navigate_results') }}</span>
                      </li>
                      <li class="flex gap-2 items-center">
                        <kbd
                          class="items-center justify-center text-sm text-fg bg-bg-muted border border-border rounded px-2"
                          >Enter</kbd
                        ><span>{{ $t('shortcuts.go_to_result') }}</span>
                      </li>
                    </ul>
                    <p class="mb-2 font-mono text-fg-subtle">
                      {{ $t('shortcuts.section.package') }}
                    </p>
                    <ul class="mb-0 flex flex-col gap-2">
                      <li class="flex gap-2 items-center">
                        <kbd
                          class="items-center justify-center text-sm text-fg bg-bg-muted border border-border rounded px-2"
                          >.</kbd
                        ><span>{{ $t('shortcuts.open_code_view') }}</span>
                      </li>
                      <li class="flex gap-2 items-center">
                        <kbd
                          class="items-center justify-center text-sm text-fg bg-bg-muted border border-border rounded px-2"
                          >d</kbd
                        ><span>{{ $t('shortcuts.open_docs') }}</span>
                      </li>
                      <li class="flex gap-2 items-center">
                        <kbd
                          class="items-center justify-center text-sm text-fg bg-bg-muted border border-border rounded px-2"
                          >c</kbd
                        ><span>{{ $t('shortcuts.open_compare_prefilled') }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>
        </div>
      </div>
      <p class="text-xs text-fg-muted text-center sm:text-start m-0">
        <span class="sm:hidden">{{ $t('non_affiliation_disclaimer') }}</span>
        <span class="hidden sm:inline">{{ $t('trademark_disclaimer') }}</span>
      </p>
    </div>
  </footer>
</template>
