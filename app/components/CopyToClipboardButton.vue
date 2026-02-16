<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  copied: boolean
  copyText?: string
  copiedText?: string
  ariaLabelCopy?: string
  ariaLabelCopied?: string
}>()

const buttonCopyText = computed(() => props.copyText || $t('common.copy'))
const buttonCopiedText = computed(() => props.copiedText || $t('common.copied'))
const buttonAriaLabelCopy = computed(() => props.ariaLabelCopy || $t('common.copy'))
const buttonAriaLabelCopied = computed(() => props.ariaLabelCopied || $t('common.copied'))

const emit = defineEmits<{
  click: []
}>()

function handleClick() {
  emit('click')
}
</script>

<template>
  <div class="group relative" v-bind="$attrs">
    <slot />
    <button
      type="button"
      @click="handleClick"
      class="absolute z-20 inset-is-0 top-full inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-mono whitespace-nowrap transition-all duration-150 opacity-0 -translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:translate-y-0 focus-visible:pointer-events-auto"
      :class="[
        $style.copyButton,
        copied ? 'text-accent bg-accent/10' : 'text-fg-muted bg-bg border-border',
      ]"
      :aria-label="copied ? buttonAriaLabelCopied : buttonAriaLabelCopy"
    >
      <span
        :class="copied ? 'i-lucide:check' : 'i-lucide:copy'"
        class="w-3.5 h-3.5"
        aria-hidden="true"
      />
      {{ copied ? buttonCopiedText : buttonCopyText }}
    </button>
  </div>
</template>

<style module>
.copyButton {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  width: 1px;
  transition:
    opacity 0.25s 0.1s,
    translate 0.15s 0.1s,
    clip 0.01s 0.34s allow-discrete,
    clip-path 0.01s 0.34s allow-discrete,
    height 0.01s 0.34s allow-discrete,
    width 0.01s 0.34s allow-discrete;
}

:global(.group):hover .copyButton,
.copyButton:focus-visible {
  clip: auto;
  clip-path: none;
  height: auto;
  overflow: visible;
  width: auto;
  transition:
    opacity 0.15s,
    translate 0.15s;
}

@media (hover: none) {
  .copyButton {
    display: none;
  }
}
</style>
