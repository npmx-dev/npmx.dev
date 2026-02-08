<script setup lang="ts">
const { searchProvider, isAlgolia } = useSearchProvider()

const isOpen = shallowRef(false)
const toggleRef = useTemplateRef('toggleRef')

onClickOutside(toggleRef, () => {
  isOpen.value = false
})

useEventListener('keydown', event => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
})
</script>

<template>
  <div ref="toggleRef" class="relative">
    <ButtonBase
      :aria-label="$t('settings.data_source.label')"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      size="small"
      class="border-none w-8 h-8 !px-0 justify-center"
      classicon="i-carbon:settings"
      @click="isOpen = !isOpen"
    />

    <Transition
      enter-active-class="transition-all duration-150"
      leave-active-class="transition-all duration-100"
      enter-from-class="opacity-0 translate-y-1"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute inset-ie-0 top-full pt-2 w-72 z-50"
        role="menu"
        :aria-label="$t('settings.data_source.label')"
      >
        <div
          class="bg-bg-subtle/80 backdrop-blur-sm border border-border-subtle rounded-lg shadow-lg shadow-bg-elevated/50 overflow-hidden p-1"
        >
          <!-- npm Registry option -->
          <button
            type="button"
            role="menuitem"
            class="w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-start transition-colors hover:bg-bg-muted"
            :class="[!isAlgolia ? 'bg-bg-muted' : '']"
            @click="
              () => {
                searchProvider = 'npm'
                isOpen = false
              }
            "
          >
            <span
              class="i-carbon:catalog w-4 h-4 mt-0.5 shrink-0"
              :class="!isAlgolia ? 'text-accent' : 'text-fg-muted'"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium" :class="!isAlgolia ? 'text-fg' : 'text-fg-muted'">
                {{ $t('settings.data_source.npm') }}
              </div>
              <p class="text-xs text-fg-subtle mt-0.5">
                {{ $t('settings.data_source.npm_description') }}
              </p>
            </div>
          </button>

          <!-- Algolia option -->
          <button
            type="button"
            role="menuitem"
            class="w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-start transition-colors hover:bg-bg-muted mt-1"
            :class="[isAlgolia ? 'bg-bg-muted' : '']"
            @click="
              () => {
                searchProvider = 'algolia'
                isOpen = false
              }
            "
          >
            <span
              class="i-carbon:search w-4 h-4 mt-0.5 shrink-0"
              :class="isAlgolia ? 'text-accent' : 'text-fg-muted'"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium" :class="isAlgolia ? 'text-fg' : 'text-fg-muted'">
                {{ $t('settings.data_source.algolia') }}
              </div>
              <p class="text-xs text-fg-subtle mt-0.5">
                {{ $t('settings.data_source.algolia_description') }}
              </p>
            </div>
          </button>

          <!-- Algolia attribution -->
          <div v-if="isAlgolia" class="border-t border-border mx-1 mt-1 pt-2 pb-1">
            <a
              href="https://www.algolia.com/developers"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-fg-subtle hover:text-fg-muted transition-colors inline-flex items-center gap-1 px-2"
            >
              {{ $t('search.algolia_disclaimer') }}
              <span class="i-carbon:launch w-3 h-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
