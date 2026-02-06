<script setup lang="ts">
defineProps<{
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', searchQuery: string): void
  (e: 'blur'): void
  (e: 'focus'): void
}>()

const searchQuery = defineModel<string>({
  default: '',
})

function handleSubmit() {
  emit('submit', searchQuery.value)
}

function handleBlur() {
  emit('blur')
}
function handleFocus() {
  emit('focus')
}

// Expose focus method for parent components
const inputRef = useTemplateRef('inputRef')
function focus() {
  inputRef.value?.focus()
}

defineExpose({
  focus,
})
</script>

<template>
  <search class="w-full @container">
    <form method="GET" action="/search" class="relative" @submit.prevent="handleSubmit">
      <label for="search-box" class="sr-only">
        {{ $t('search.label') }}
      </label>

      <div class="relative group">
        <div
          class="absolute -inset-px rounded-lg bg-gradient-to-r from-fg/0 via-fg/5 to-fg/0 opacity-0 transition-opacity duration-500 blur-sm group-[.is-focused]:opacity-100"
        />

        <div class="search-box relative flex items-center">
          <span
            class="absolute text-fg-subtle font-mono pointer-events-none transition-colors duration-200 motion-reduce:transition-none [.group:hover:not(:focus-within)_&]:text-fg/80 group-focus-within:text-accent z-1"
            :class="compact ? 'inset-is-3 text-sm' : 'inset-is-4 text-xl'"
          >
            /
          </span>

          <input
            id="search-box"
            ref="inputRef"
            v-model.trim="searchQuery"
            type="search"
            name="q"
            :placeholder="$t('search.placeholder')"
            v-bind="noCorrect"
            class="w-full bg-bg-subtle border border-border text-base font-mono text-fg placeholder:text-fg-subtle transition-[border-color,outline-color] duration-300 motion-reduce:transition-none hover:border-fg-subtle outline-2 outline-transparent focus:border-accent focus-visible:(outline-2 outline-accent/70)"
            :class="
              compact ? 'ps-7 pe-3 py-1.5 rounded-md text-sm!' : 'ps-8 pe-24 h-14 py-4 rounded-xl'
            "
            @blur="handleBlur"
            @focus="handleFocus"
          />

          <button
            type="submit"
            class="absolute hidden @xs:block group inset-ie-2.5 font-mono text-sm transition-[background-color,transform] duration-200 active:scale-95 focus-visible:outline-accent/70"
            :class="
              compact
                ? 'px-1.5 py-0.5 @md:ps-4 @md:pe-4'
                : 'rounded-md px-2.5 @md:ps-4 @md:pe-4 py-2 text-bg bg-fg/90 hover:bg-fg! group-focus-within:bg-fg/80'
            "
          >
            <span
              class="inline-block i-carbon:search align-middle w-4 h-4 @md:me-2"
              aria-hidden="true"
            ></span>
            <span class="sr-only @md:not-sr-only">
              {{ $t('search.button') }}
            </span>
          </button>
        </div>
      </div>
    </form>
  </search>
</template>
