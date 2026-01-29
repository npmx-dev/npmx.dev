<script setup lang="ts">
import type { DiffLine as DiffLineType } from '#shared/types'
import { getClientHighlighter } from '~/utils/shiki-client'

const props = defineProps<{
  line: DiffLineType
}>()

const diffContext = inject<{
  fileStatus: ComputedRef<'add' | 'delete' | 'modify'>
  language?: ComputedRef<string>
  enableShiki?: ComputedRef<boolean>
  wordWrap?: ComputedRef<boolean>
}>('diffContext')

const colorMode = useColorMode()

const lineNumberNew = computed(() => {
  if (props.line.type === 'normal') {
    return props.line.newLineNumber
  }
  return props.line.lineNumber ?? props.line.newLineNumber
})

const lineNumberOld = computed(() => {
  if (props.line.type === 'normal') {
    return props.line.oldLineNumber
  }
  return props.line.type === 'delete'
    ? (props.line.lineNumber ?? props.line.oldLineNumber)
    : undefined
})

const rowClasses = computed(() => {
  const shouldWrap = diffContext?.wordWrap?.value ?? false
  const classes = ['whitespace-pre-wrap', 'box-border', 'border-none']
  if (shouldWrap) classes.push('min-h-6')
  else classes.push('h-6', 'min-h-6')
  const fileStatus = diffContext?.fileStatus.value

  if (props.line.type === 'insert' && fileStatus !== 'add') {
    classes.push('bg-[var(--code-added)]/10')
  }
  if (props.line.type === 'delete' && fileStatus !== 'delete') {
    classes.push('bg-[var(--code-removed)]/10')
  }

  return classes
})

const borderClasses = computed(() => {
  const classes = ['border-transparent', 'w-1', 'border-l-3']

  if (props.line.type === 'insert') {
    classes.push('border-[color:var(--code-added)]/60')
  }
  if (props.line.type === 'delete') {
    classes.push('border-[color:var(--code-removed)]/80')
  }

  return classes
})

const contentClasses = computed(() => {
  const shouldWrap = diffContext?.wordWrap?.value ?? false
  return ['pr-6', shouldWrap ? 'whitespace-pre-wrap break-words' : 'text-nowrap']
})

type RenderedSegment = { html: string; type: 'insert' | 'delete' | 'normal' }
const renderedSegments = shallowRef<RenderedSegment[]>(
  props.line.content.map(seg => ({ html: escapeHtml(seg.value), type: seg.type })),
)

function normalizeLanguage(raw?: string): 'javascript' | 'typescript' | 'json' | 'plaintext' {
  if (!raw) return 'plaintext'
  const lang = raw.toLowerCase()
  if (lang.includes('json')) return 'json'
  if (lang === 'ts' || lang.includes('typescript') || lang.includes('tsx')) return 'typescript'
  if (lang === 'js' || lang.includes('javascript') || lang.includes('mjs') || lang.includes('cjs'))
    return 'javascript'
  return 'plaintext'
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function highlightSegments() {
  if (!import.meta.client) return

  const lang = normalizeLanguage(diffContext?.language?.value)
  // If language unsupported, keep escaped plain text
  if (lang === 'plaintext') {
    renderedSegments.value = props.line.content.map(seg => ({
      html: escapeHtml(seg.value),
      type: seg.type,
    }))
    return
  }

  const theme = colorMode.value === 'light' ? 'github-light' : 'github-dark'
  const highlighter = await getClientHighlighter()

  renderedSegments.value = props.line.content.map(seg => {
    const code = seg.value.length ? seg.value : ' '
    const html = highlighter.codeToHtml(code, { lang, theme })
    const inner = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1] ?? escapeHtml(code)
    return { html: inner, type: seg.type }
  })
}

watch(
  () => [props.line, diffContext?.language?.value, colorMode.value],
  () => {
    highlightSegments()
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <tr
    :data-line-new="lineNumberNew"
    :data-line-old="lineNumberOld"
    :data-line-kind="line.type"
    :class="rowClasses"
  >
    <!-- Border indicator -->
    <td :class="borderClasses" />

    <!-- Line number -->
    <td class="tabular-nums text-center opacity-50 px-2 text-xs select-none w-12 shrink-0">
      {{ line.type === 'delete' ? '–' : lineNumberNew }}
    </td>

    <!-- Line content -->
    <td :class="contentClasses">
      <component :is="line.type === 'insert' ? 'ins' : line.type === 'delete' ? 'del' : 'span'">
        <span
          v-for="(seg, i) in renderedSegments"
          :key="i"
          :class="{
            'bg-[var(--code-added)]/20': seg.type === 'insert',
            'bg-[var(--code-removed)]/20': seg.type === 'delete',
          }"
          v-html="seg.html"
        />
      </component>
    </td>
  </tr>
</template>

<style scoped>
ins,
del {
  text-decoration: none;
}
</style>
