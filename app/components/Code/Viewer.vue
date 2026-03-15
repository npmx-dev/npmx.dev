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

const LINE_HEIGHT_PX = 24
const lineMultipliers = ref<number[]>([])

function updateLineMultipliers() {
  if (!codeRef.value) return
  const lines = codeRef.value.querySelectorAll<HTMLElement>('code > .line')
  const result: number[] = Array.from({ length: lines.length })
  for (let i = 0; i < lines.length; i++)
    result[i] = Math.max(1, Math.round(lines[i]!.offsetHeight / LINE_HEIGHT_PX))
  lineMultipliers.value = result
}

watch(
  () => props.html,
  () => nextTick(updateLineMultipliers),
  { immediate: true },
)
useResizeObserver(codeRef, updateLineMultipliers)

const lineDigits = computed(() => String(props.lines).length)

function isLineSelected(lineNum: number): boolean {
  if (!props.selectedLines) return false
  return lineNum >= props.selectedLines.start && lineNum <= props.selectedLines.end
}

const lineNumbersHtml = computed(() => {
  const multipliers = lineMultipliers.value
  const total = props.lines
  const parts: string[] = []

  for (let i = 0; i < total; i++) {
    const num = i + 1
    const cls = isLineSelected(num)
      ? 'bg-yellow-500/20 text-fg'
      : 'text-fg-subtle hover:text-fg-muted'
    parts.push(
      `<a id="L${num}" href="#L${num}" tabindex="-1" class="line-number block px-3 py-0 font-mono text-sm leading-6 cursor-pointer transition-colors no-underline ${cls}" data-line="${num}">${num}</a>`,
    )

    const extra = (multipliers[i] ?? 1) - 1
    for (let j = 0; j < extra; j++) parts.push('<span class="block px-3 leading-6">\u00a0</span>')
  }

  return parts.join('')
})

function onLineNumberClick(event: MouseEvent) {
  const target = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-line]')
  if (!target) return
  event.preventDefault()
  const lineNum = Number(target.dataset.line)
  if (lineNum) emit('lineClick', lineNum, event)
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

// Use Nuxt's `navigateTo` for the rendered import links
function handleImportLinkNavigate() {
  if (!codeRef.value) return

  const anchors = codeRef.value.querySelectorAll<HTMLAnchorElement>('a.import-link')
  anchors.forEach(anchor => {
    // NOTE: We do not need to remove previous listeners because we re-create the entire HTML content on each html update
    anchor.addEventListener('click', event => {
      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return
      const href = anchor.getAttribute('href')
      if (href) {
        event.preventDefault()
        navigateTo(href)
      }
    })
  })
}

watch(
  () => props.html,
  () => {
    nextTick(handleImportLinkNavigate)
  },
  { immediate: true },
)
</script>

<template>
  <div class="code-viewer flex min-h-full max-w-full" :style="{ '--line-digits': lineDigits }">
    <!-- Line numbers column — raw HTML + event delegation to avoid v-for overhead on large files -->
    <!-- eslint-disable vue/no-v-html -->
    <div
      class="line-numbers shrink-0 bg-bg-subtle border-ie border-solid border-border text-end select-none relative"
      aria-hidden="true"
      v-html="lineNumbersHtml"
      @click="onLineNumberClick"
    />
    <!-- eslint-enable vue/no-v-html -->

    <!-- Code content -->
    <div class="code-content">
      <!-- eslint-disable vue/no-v-html -- HTML is generated server-side by Shiki -->
      <div ref="codeRef" class="code-lines" v-html="html" />
      <!-- eslint-enable vue/no-v-html -->
    </div>
  </div>
</template>

<style scoped>
.code-viewer {
  font-size: 14px;
  /* 1ch per digit + 1.5rem (px-3 * 2) padding */
  --line-numbers-width: calc(var(--line-digits) * 1ch + 1.5rem);
}

.line-numbers {
  min-width: var(--line-numbers-width);
}

.code-content {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - var(--line-numbers-width));
}

.code-content:deep(pre) {
  margin: 0;
  padding: 0;
  background: transparent !important;
  overflow: visible;
  max-width: 100%;
}

.code-content:deep(code) {
  display: block;
  padding: 0 1rem;
  background: transparent !important;
  max-width: 100%;
}

.code-content:deep(.line) {
  display: flex;
  flex-wrap: wrap;
  /* Ensure consistent height matching line numbers */
  line-height: calc(v-bind(LINE_HEIGHT_PX) * 1px);
  min-height: calc(v-bind(LINE_HEIGHT_PX) * 1px);
  white-space: pre-wrap;
  overflow: hidden;
  transition: background-color 0.1s;
  max-width: 100%;
}

/* Highlighted lines in code content - extend full width with negative margin */
.code-content:deep(.line.highlighted) {
  @apply bg-yellow-500/20;
  margin: 0 -1rem;
  padding: 0 1rem;
}

/* Clickable import links */
.code-content:deep(.import-link) {
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

.code-content:deep(.import-link:hover) {
  text-decoration-style: solid;
  text-decoration-color: #9ecbff; /* syntax.str - light blue */
}
</style>
