<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    id?: string
    placeholder?: string
    hideSubmitButton?: boolean
  }>(),
  {
    id: 'home-search',
    placeholder: 'search packages...',
    hideSubmitButton: false,
  },
)

const modelValue = defineModel<string>({ default: '' })
const emit = defineEmits<{
  submit: []
  keydown: [event: KeyboardEvent]
}>()

const inputRef = ref<HTMLInputElement>()

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus, inputRef })
</script>

<template>
  <div
    class="group rounded-lg border border-border search-box relative grid grid-cols-[auto_1fr_auto] px-2 bg-bg-subtle items-center focus-within:border-accent/70"
  >
    <span
      class="px-2 text-fg-subtle font-mono text-sm pointer-events-none transition-colors duration-200 group-focus-within:text-accent z-1"
    >
      /
    </span>

    <input
      :id="props.id"
      ref="inputRef"
      v-model="modelValue"
      type="search"
      name="q"
      :placeholder="props.placeholder"
      autocomplete="off"
      class="bg-bg-subtle py-4 font-mono text-base text-fg placeholder:text-fg-subtle transition-all duration-300 focus:outline-none"
      @keydown="emit('keydown', $event)"
    />

    <button
      type="submit"
      class="px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 active:scale-95"
      :class="{ 'sr-only': hideSubmitButton }"
    >
      search
    </button>
  </div>
</template>
