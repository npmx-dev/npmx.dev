<script setup lang="ts">
const props = defineProps<{
  packageName: string
  checked: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'change', packageName: string): void
}>()

const { t } = useI18n()
const disabledText = t('package.card.select_maximum', MAX_PACKAGE_SELECTION)
</script>

<template>
  <div class="relative z-1">
    <label>
      <span class="sr-only" v-if="disabled">{{ disabledText }}</span>
      <span class="sr-only" v-else> {{ $t('package.card.select') }}: {{ packageName }} </span>

      <TooltipApp v-if="disabled" :text="disabledText" position="top">
        <input
          class="opacity-0 group-hover:opacity-100 size-4 accent-accent border border-fg-muted/30 hover:cursor-not-allowed"
          :class="{ 'opacity-100! disabled:opacity-30!': isTouchDevice() }"
          type="checkbox"
          :disabled
        />
      </TooltipApp>

      <input
        v-else
        data-package-card-checkbox
        class="opacity-0 group-focus-within:opacity-100 checked:opacity-100 group-hover:opacity-100 size-4 cursor-pointer accent-accent border border-fg-muted/30 hover:border-accent transition-colors disabled:group-hover:opacity-30 disabled:hover:cursor-not-allowed"
        :class="{ 'opacity-100! disabled:opacity-30!': isTouchDevice() }"
        type="checkbox"
        :checked
        :disabled
        @change="emit('change', packageName)"
      />
    </label>
  </div>
</template>
