<script setup lang="ts">
type CompletionColorScheme = {
  low: number
  medium: number
  high: number
  full?: boolean
}

const props = withDefaults(
  defineProps<{
    val: number
    label: string
    scheme?: CompletionColorScheme
  }>(),
  {
    scheme: () => ({
      low: 50,
      medium: 75,
      high: 90,
      full: true,
    }),
  },
)

const completionClass = computed<string>(() => {
  if (props.scheme.full && props.val === 100) {
    return 'full'
  } else if (props.val > props.scheme.high) {
    return 'high'
  } else if (props.val > props.scheme.medium) {
    return 'medium'
  } else if (props.val > props.scheme.low) {
    return 'low'
  }

  return ''
})
</script>

<template>
  <progress
    class="flex-1 h-3 rounded-full overflow-hidden"
    max="100"
    :value="val"
    :class="completionClass"
    :aria-label="label"
  ></progress>
</template>

<style scoped>
/* Reset & Base */
progress {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  @apply bg-bg-muted; /* Background for container */
}

/* Webkit Container */
progress::-webkit-progress-bar {
  @apply bg-bg-muted;
}

/* Value Bar */
/* Default <= 50 */
progress::-webkit-progress-value {
  @apply bg-red-800 dark:bg-red-900;
}
progress::-moz-progress-bar {
  @apply bg-red-800 dark:bg-red-900;
}

/* Low > scheme.low (default: 50) */
progress.low::-webkit-progress-value {
  @apply bg-red-500 dark:bg-red-700;
}
progress.low::-moz-progress-bar {
  @apply bg-red-500 dark:bg-red-700;
}

/* Medium scheme.medium (default: 75) */
progress.medium::-webkit-progress-value {
  @apply bg-orange-500;
}
progress.medium::-moz-progress-bar {
  @apply bg-orange-500;
}

/* Good > scheme.high (default: 90) */
progress.high::-webkit-progress-value {
  @apply bg-green-500 dark:bg-green-700;
}
progress.high::-moz-progress-bar {
  @apply bg-green-500 dark:bg-green-700;
}

/* Completed = 100 */
progress.full::-webkit-progress-value {
  @apply bg-green-700 dark:bg-green-500;
}
progress.full::-moz-progress-bar {
  @apply bg-green-700 dark:bg-green-500;
}

details[dir='rtl']:not([open]) .icon-rtl {
  transform: scale(-1, 1);
}
</style>
