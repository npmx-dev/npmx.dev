<script setup lang="ts">
const props = defineProps<{
  html: string
  lines: number
  selectedLines: { start: number; end: number } | null
}>()

const emit = defineEmits<{
  lineClick: [lineNum: number, event: MouseEvent]
}>()

const codeRef = useTemplateRef('codeRef')

// Generate line numbers array
const lineNumbers = computed(() => {
  return Array.from({ length: props.lines }, (_, i) => i + 1)
})

// Used for CSS calculation of line number column width
const lineDigits = computed(() => {
  return String(props.lines).length
})

// Check if a line is selected
function isLineSelected(lineNum: number): boolean {
  if (!props.selectedLines) return false
  return lineNum >= props.selectedLines.start && lineNum <= props.selectedLines.end
}

// Handle line number click
function onLineClick(lineNum: number, event: MouseEvent) {
  emit('lineClick', lineNum, event)
}

// Apply highlighting to code lines when selection changes
function updateLineHighlighting() {
  if (!codeRef.value) return

  // Lines are inside pre > code > .line
  const lines = codeRef.value.querySelectorAll('code > .line')
  lines.forEach((line, index) => {
    const lineNum = index + 1
    if (isLineSelected(lineNum)) {
      line.classList.add('highlighted')
    } else {
      line.classList.remove('highlighted')
    }
  })
}

// Watch for changes to selection and HTML content
// Use deep watch and nextTick to ensure DOM is updated
watch(
  () => [props.selectedLines, props.html] as const,
  () => {
    nextTick(updateLineHighlighting)
  },
  { immediate: true },
)
</script>

<template>
  <div class="code-viewer flex min-h-full max-w-full">
    <!-- Line numbers column -->
    <div
      class="line-numbers shrink-0 bg-bg-subtle border-ie border-solid border-border text-end select-none relative"
      :style="{ '--line-digits': lineDigits }"
      aria-hidden="true"
    >
      <!-- This needs to be a native <a> element, because `LinkBase` (or specifically `NuxtLink`) does not seem to work when trying to prevent default behavior (jumping to the anchor) -->
      <a
        v-for="lineNum in lineNumbers"
        :id="`L${lineNum}`"
        :key="lineNum"
        :href="`#L${lineNum}`"
        tabindex="-1"
        class="line-number block px-3 py-0 font-mono text-sm leading-6 cursor-pointer transition-colors no-underline"
        :class="[
          isLineSelected(lineNum)
            ? 'bg-yellow-500/20 text-fg'
            : 'text-fg-subtle hover:text-fg-muted',
        ]"
        @click.prevent="onLineClick(lineNum, $event)"
      >
        {{ lineNum }}
      </a>
    </div>

    <!-- Code content -->
    <div class="code-content flex-1 overflow-x-auto min-w-0">
      <!-- eslint-disable vue/no-v-html -- HTML is generated server-side by Shiki -->
      <div ref="codeRef" class="code-lines w-fit" v-html="html" />
      <!-- eslint-enable vue/no-v-html -->
    </div>
  </div>
</template>

<style scoped>
.code-viewer {
  font-size: 14px;
}

.line-numbers {
  /* 1ch per digit + 1.5rem (px-3 * 2) padding */
  min-width: calc(var(--line-digits) * 1ch + 1.5rem);
}

.code-content :deep(pre) {
  margin: 0;
  padding: 0;
  background: transparent !important;
  overflow: visible;
}

.code-content :deep(code) {
  display: block;
  padding: 0 1rem;
  background: transparent !important;
}

.code-content :deep(.line) {
  display: block;
  /* Ensure consistent height matching line numbers */
  line-height: 24px;
  min-height: 24px;
  max-height: 24px;
  white-space: pre;
  overflow: hidden;
  transition: background-color 0.1s;
}

/* Highlighted lines in code content - extend full width with negative margin */
.code-content :deep(.line.highlighted) {
  background: rgb(234 179 8 / 0.2); /* yellow-500/20 */
  margin: 0 -1rem;
  padding: 0 1rem;
}

/* Clickable import links */
.code-content :deep(.import-link) {
  color: inherit;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: rgba(158, 203, 255, 0.5); /* syntax.str with transparency */
  text-underline-offset: 2px;
  transition:
    text-decoration-color 0.15s,
    text-decoration-style 0.15s;
  cursor: pointer;
}

.code-content :deep(.import-link:hover) {
  text-decoration-style: solid;
  text-decoration-color: #9ecbff; /* syntax.str - light blue */
}
</style>
