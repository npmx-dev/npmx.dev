<script setup lang="ts">
defineProps<{
  html: string
}>()

const router = useRouter()
const { copy } = useClipboard()

// Combined click handler for:
// 1. Intercepting npmjs.com links to route internally
// 2. Copy button functionality for code blocks
function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement | undefined
  if (!target) return

  // Handle copy button clicks
  const copyTarget = target.closest('[data-copy]')
  if (copyTarget) {
    const wrapper = copyTarget.closest('.readme-code-block')
    if (!wrapper) return

    const pre = wrapper.querySelector('pre')
    if (!pre?.textContent) return

    copy(pre.textContent)

    const icon = copyTarget.querySelector('span')
    if (!icon) return

    const originalIcon = 'i-carbon:copy'
    const successIcon = 'i-carbon:checkmark'

    icon.classList.remove(originalIcon)
    icon.classList.add(successIcon)

    setTimeout(() => {
      icon.classList.remove(successIcon)
      icon.classList.add(originalIcon)
    }, 2000)
    return
  }

  // Handle npmjs.com link clicks - route internally
  const anchor = target.closest('a')
  if (!anchor) return

  const href = anchor.getAttribute('href')
  if (!href) return

  const match = href.match(/^(?:https?:\/\/)?(?:www\.)?npmjs\.(?:com|org)(\/.+)$/)
  if (!match || !match[1]) return

  const route = router.resolve(match[1])
  if (route) {
    event.preventDefault()
    router.push(route)
  }
}
</script>

<template>
  <article
    class="readme prose prose-invert max-w-[70ch] lg:max-w-none px-1"
    v-html="html"
    @click="handleClick"
  />
</template>

<style scoped>
/* README prose styling */
.readme {
  color: var(--fg-muted);
  line-height: 1.75;
  /* Prevent horizontal overflow on mobile */
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
  /* Contain all children */
  overflow: hidden;
  min-width: 0;
}

/* README headings - styled by visual level (data-level), not semantic level */
.readme :deep(h3),
.readme :deep(h4),
.readme :deep(h5),
.readme :deep(h6) {
  color: var(--fg);
  @apply font-mono;
  font-weight: 500;
  margin-top: 1rem;
  margin-bottom: 1rem;
  line-height: 1.3;

  a {
    text-decoration: none;
  }
}

/* Visual styling based on original README heading level */
.readme :deep([data-level='1']) {
  font-size: 1.5rem;
}
.readme :deep([data-level='2']) {
  font-size: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
.readme :deep([data-level='3']) {
  font-size: 1.125rem;
}
.readme :deep([data-level='4']) {
  font-size: 1rem;
}
.readme :deep([data-level='5']) {
  font-size: 0.925rem;
}
.readme :deep([data-level='6']) {
  font-size: 0.875rem;
}

.readme :deep(p) {
  margin-bottom: 1rem;
}

.readme :deep(a) {
  color: var(--fg);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-color: var(--fg-subtle);
  transition: text-decoration-color 0.2s ease;
}

.readme a:hover {
  text-decoration-color: var(--accent);
}

.readme :deep(code) {
  @apply font-mono;
  font-size: 0.875em;
  background: var(--bg-muted);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  border: 1px solid var(--border);
}

/* Code blocks - including Shiki output */
.readme :deep(pre),
.readme :deep(.shiki) {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
  margin: 1.5rem 0;
  /* Fix horizontal overflow */
  max-width: 100%;
  box-sizing: border-box;
}

.readme :deep(.readme-code-block) {
  display: block;
  width: 100%;
  position: relative;
}

.readme :deep(.readme-copy-button) {
  position: absolute;
  top: 0.4rem;
  inset-inline-end: 0.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-subtle) 80%, transparent);
  border: 1px solid var(--border);
  color: var(--fg-subtle);
  opacity: 0;
  transition:
    opacity 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.readme :deep(.readme-code-block:hover .readme-copy-button),
.readme :deep(.readme-copy-button:focus-visible) {
  opacity: 1;
}

.readme :deep(.readme-copy-button:hover) {
  color: var(--fg);
  border-color: var(--border-hover);
}

.readme :deep(.readme-copy-button > span) {
  width: 1rem;
  height: 1rem;
  display: inline-block;
  pointer-events: none;
}

.readme :deep(.readme-code-block) {
  display: block;
  width: 100%;
  position: relative;
}

.readme :deep(.readme-copy-button) {
  position: absolute;
  top: 0.4rem;
  inset-inline-end: 0.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-subtle) 80%, transparent);
  border: 1px solid var(--border);
  color: var(--fg-subtle);
  opacity: 0;
  transition:
    opacity 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.readme :deep(.readme-code-block:hover .readme-copy-button),
.readme :deep(.readme-copy-button:focus-visible) {
  opacity: 1;
}

.readme :deep(.readme-copy-button:hover) {
  color: var(--fg);
  border-color: var(--border-hover);
}

.readme :deep(.readme-copy-button > span) {
  width: 1.05rem;
  height: 1.05rem;
  display: inline-block;
  pointer-events: none;
}

.readme :deep(pre code),
.readme :deep(.shiki code) {
  background: transparent !important;
  border: none;
  padding: 0;
  @apply font-mono;
  font-size: 0.875rem;
  color: var(--fg);
  /* Prevent code from forcing width */
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
  /* Makes unicode and ascii art work properly */
  line-height: 1.25;
  display: inline-block;
}

.readme :deep(ul),
.readme :deep(ol) {
  margin: 1rem 0;
  padding-inline-start: 1.5rem;
}

.readme :deep(ul) {
  list-style-type: disc;
}

.readme :deep(ol) {
  list-style-type: decimal;
}

.readme :deep(li) {
  margin-bottom: 0.5rem;
  display: list-item;
}

.readme :deep(li::marker) {
  color: var(--border-hover);
}

.readme :deep(blockquote) {
  border-inline-start: 2px solid var(--border);
  padding-inline-start: 1rem;
  margin: 1.5rem 0;
  color: var(--fg-subtle);
  font-style: italic;
}

/* GitHub-style callouts/alerts */
.readme :deep(blockquote[data-callout]) {
  border-inline-start-width: 3px;
  padding: 1rem;
  padding-inline-start: 1.25rem;
  background: var(--bg-subtle);
  font-style: normal;
  color: var(--fg-subtle);
  position: relative;
}

.readme :deep(blockquote[data-callout]::before) {
  display: block;
  @apply font-mono;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
  padding-inline-start: 1.5rem;
}

.readme :deep(blockquote[data-callout]::after) {
  content: '';
  width: 1.25rem;
  height: 1.25rem;
  position: absolute;
  top: 1rem;
}

.readme :deep(blockquote[data-callout] > p:first-child) {
  margin-top: 0;
}

.readme :deep(blockquote[data-callout] > p:last-child) {
  margin-bottom: 0;
}

/* Note - blue */
.readme :deep(blockquote[data-callout='note']) {
  border-inline-start-color: var(--syntax-str);
  background: rgba(59, 130, 246, 0.05);
}
.readme :deep(blockquote[data-callout='note']::before) {
  content: 'Note';
  color: #3b82f6;
}
.readme :deep(blockquote[data-callout='note']::after) {
  background-color: #3b82f6;
  -webkit-mask: icon('i-lucide-info') no-repeat;
  mask: icon('i-lucide-info') no-repeat;
}

/* Tip - green */
.readme :deep(blockquote[data-callout='tip']) {
  border-inline-start-color: #22c55e;
  background: rgba(34, 197, 94, 0.05);
}
.readme :deep(blockquote[data-callout='tip']::before) {
  content: 'Tip';
  color: #22c55e;
}
.readme :deep(blockquote[data-callout='tip']::after) {
  background-color: #22c55e;
  -webkit-mask: icon('i-lucide-lightbulb') no-repeat;
  mask: icon('i-lucide-lightbulb') no-repeat;
}

/* Important - purple */
.readme :deep(blockquote[data-callout='important']) {
  border-inline-start-color: var(--syntax-fn);
  background: rgba(168, 85, 247, 0.05);
}
.readme :deep(blockquote[data-callout='important']::before) {
  content: 'Important';
  color: var(--syntax-fn);
}
.readme :deep(blockquote[data-callout='important']::after) {
  background-color: var(--syntax-fn);
  -webkit-mask: icon('i-lucide-pin') no-repeat;
  mask: icon('i-lucide-pin') no-repeat;
}

/* Warning - yellow/orange */
.readme :deep(blockquote[data-callout='warning']) {
  border-inline-start-color: #eab308;
  background: rgba(234, 179, 8, 0.05);
}
.readme :deep(blockquote[data-callout='warning']::before) {
  content: 'Warning';
  color: #eab308;
}
.readme :deep(blockquote[data-callout='warning']::after) {
  background-color: #eab308;
  -webkit-mask: icon('i-lucide-triangle-alert') no-repeat;
  mask: icon('i-lucide-triangle-alert') no-repeat;
}

/* Caution - red */
.readme :deep(blockquote[data-callout='caution']) {
  border-inline-start-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}
.readme :deep(blockquote[data-callout='caution']::before) {
  content: 'Caution';
  color: #ef4444;
}
.readme :deep(blockquote[data-callout='caution']::after) {
  background-color: #ef4444;
  -webkit-mask: icon('i-lucide-circle-alert') no-repeat;
  mask: icon('i-lucide-circle-alert') no-repeat;
}

/* Table wrapper for horizontal scroll on mobile */
.readme :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 1.5rem 0;
  font-size: 0.875rem;
  word-break: keep-all;
}

.readme :deep(th),
.readme :deep(td) {
  border: 1px solid var(--border);
  padding: 0.75rem 1rem;
  text-align: start;
}

.readme :deep(th) {
  background: var(--bg-subtle);
  color: var(--fg);
  font-weight: 500;
}

.readme :deep(tr:hover) {
  background: var(--bg-subtle);
}

.readme :deep(img) {
  max-width: 100%;
  height: revert-layer;
  display: revert-layer;
  border-radius: 8px;
  margin: 1rem 0;
}

.readme :deep(video) {
  height: revert-layer;
  display: revert-layer;
}

.readme :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2rem 0;
}

/* Badge images inline */
.readme :deep(p > a > img),
.readme :deep(p > img) {
  display: inline-block;
  margin: 0 0.25rem 0.25rem 0;
  border-radius: 4px;
}

/* Screen reader only text */
.readme :deep(.sr-only) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
