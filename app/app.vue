<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

const route = useRoute()
const router = useRouter()

const isHomepage = computed(() => route.path === '/')

useHead({
  titleTemplate: titleChunk => {
    return titleChunk ? titleChunk : 'npmx - Better npm Package Browser'
  },
})

// Global keyboard shortcut: "/" focuses search or navigates to search page
function handleGlobalKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement

  const isEditableTarget =
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

  if (isEditableTarget) {
    return
  }

  if (e.key === '/') {
    e.preventDefault()

    // Try to find and focus search input on current page
    const searchInput = document.querySelector<HTMLInputElement>(
      'input[type="search"], input[name="q"]',
    )

    if (searchInput) {
      searchInput.focus()
      return
    }

    router.push('/search')
  }
}

if (import.meta.client) {
  useEventListener(document, 'keydown', handleGlobalKeydown)
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-bg text-fg">
    <a href="#main-content" class="skip-link font-mono">Skip to main content</a>

    <AppHeader :show-logo="!isHomepage" />

    <div id="main-content" class="flex-1 flex flex-col">
      <NuxtPage />
    </div>

    <AppFooter />

    <ScrollToTop />
  </div>
</template>

<style lang="postcss">
/* Base reset and defaults */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/*
 * Enable CSS scroll-state container queries for the document
 * This allows the footer to query the scroll state using pure CSS
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@container#scroll-state_container_descriptors
 */
@supports (container-type: scroll-state) {
  html {
    container-type: scroll-state;
  }
}

body {
  margin: 0;
  background-color: #0a0a0a;
  color: #fafafa;
  line-height: 1.6;
  padding-bottom: var(--footer-height, 0);
}

/* Default link styling for accessibility on dark background */
a {
  color: #fafafa;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: #404040;
  transition:
    color 0.2s ease,
    text-decoration-color 0.2s ease;
}

a:hover {
  color: #ffffff;
  text-decoration-color: #a1a1a1;
}

a:focus-visible {
  outline: 2px solid rgba(250, 250, 250, 0.2);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Reset dd margin (browser default is margin-left: 40px) */
dd {
  margin: 0;
}

/* Reset button styles */
button {
  background: transparent;
  border: none;
  cursor: pointer;
  font: inherit;
  padding: 0;
}

/* Selection */
::selection {
  background-color: rgba(255, 255, 255, 0.15);
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #0a0a0a;
}

::-webkit-scrollbar-thumb {
  background: #262626;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #404040;
}

/* Skip link */
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  padding: 0.5rem 1rem;
  background: #fafafa;
  color: #0a0a0a;
  font-size: 0.875rem;
  z-index: 100;
  transition: top 0.2s ease;
}

.skip-link:focus {
  top: 0;
}

/* README prose styling */
.readme-content {
  color: #a1a1a1;
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
.readme-content h3,
.readme-content h4,
.readme-content h5,
.readme-content h6 {
  color: #fafafa;
  @apply font-mono;
  font-weight: 500;
  margin-top: 2rem;
  margin-bottom: 1rem;
  line-height: 1.3;

  a {
    text-decoration: none;
  }
}

/* Visual styling based on original README heading level */
.readme-content [data-level='1'] {
  font-size: 1.5rem;
}
.readme-content [data-level='2'] {
  font-size: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #262626;
}
.readme-content [data-level='3'] {
  font-size: 1.125rem;
}
.readme-content [data-level='4'] {
  font-size: 1rem;
}
.readme-content [data-level='5'] {
  font-size: 0.925rem;
}
.readme-content [data-level='6'] {
  font-size: 0.875rem;
}

.readme-content p {
  margin-bottom: 1rem;
}

.readme-content a {
  color: #fafafa;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-color: #404040;
  transition: text-decoration-color 0.2s ease;
}

.readme-content a:hover {
  text-decoration-color: #fafafa;
}

.readme-content code {
  @apply font-mono;
  font-size: 0.875em;
  background: #1a1a1a;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  border: 1px solid #262626;
}

/* Code blocks - including Shiki output */
.readme-content pre,
.readme-content .shiki {
  background: #111111 !important;
  border: 1px solid #262626;
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
  margin: 1.5rem 0;
  /* Fix horizontal overflow */
  max-width: 100%;
  box-sizing: border-box;
}

.readme-content pre code,
.readme-content .shiki code {
  background: transparent !important;
  border: none;
  padding: 0;
  @apply font-mono;
  font-size: 0.875rem;
  color: #fafafa;
  /* Prevent code from forcing width */
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
}

.readme-content ul,
.readme-content ol {
  margin: 1rem 0;
  padding-left: 1.5rem;
}

.readme-content ul {
  list-style-type: disc;
}

.readme-content ol {
  list-style-type: decimal;
}

.readme-content li {
  margin-bottom: 0.5rem;
  display: list-item;
}

.readme-content li::marker {
  color: #404040;
}

.readme-content blockquote {
  border-left: 2px solid #262626;
  padding-left: 1rem;
  margin: 1.5rem 0;
  color: #8a8a8a;
  font-style: italic;
}

/* GitHub-style callouts/alerts */
.readme-content blockquote[data-callout] {
  border-left-width: 3px;
  border-radius: 6px;
  padding: 1rem 1rem 1rem 1.25rem;
  background: #111111;
  font-style: normal;
  color: #a1a1a1;
}

.readme-content blockquote[data-callout]::before {
  display: block;
  @apply font-mono;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.readme-content blockquote[data-callout] > p:first-child {
  margin-top: 0;
}

.readme-content blockquote[data-callout] > p:last-child {
  margin-bottom: 0;
}

/* Note - blue */
.readme-content blockquote[data-callout='note'] {
  border-left-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}
.readme-content blockquote[data-callout='note']::before {
  content: 'Note';
  color: #3b82f6;
}

/* Tip - green */
.readme-content blockquote[data-callout='tip'] {
  border-left-color: #22c55e;
  background: rgba(34, 197, 94, 0.05);
}
.readme-content blockquote[data-callout='tip']::before {
  content: 'Tip';
  color: #22c55e;
}

/* Important - purple */
.readme-content blockquote[data-callout='important'] {
  border-left-color: #a855f7;
  background: rgba(168, 85, 247, 0.05);
}
.readme-content blockquote[data-callout='important']::before {
  content: 'Important';
  color: #a855f7;
}

/* Warning - yellow/orange */
.readme-content blockquote[data-callout='warning'] {
  border-left-color: #eab308;
  background: rgba(234, 179, 8, 0.05);
}
.readme-content blockquote[data-callout='warning']::before {
  content: 'Warning';
  color: #eab308;
}

/* Caution - red */
.readme-content blockquote[data-callout='caution'] {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}
.readme-content blockquote[data-callout='caution']::before {
  content: 'Caution';
  color: #ef4444;
}

/* Table wrapper for horizontal scroll on mobile */
.readme-content table {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 1.5rem 0;
  font-size: 0.875rem;
}

.readme-content th,
.readme-content td {
  border: 1px solid #262626;
  padding: 0.75rem 1rem;
  text-align: left;
}

.readme-content th {
  background: #111111;
  color: #fafafa;
  font-weight: 500;
}

.readme-content tr:hover {
  background: #111111;
}

.readme-content img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1rem 0;
}

.readme-content hr {
  border: none;
  border-top: 1px solid #262626;
  margin: 2rem 0;
}

/* Badge images inline */
.readme-content p > a > img,
.readme-content p > img {
  display: inline-block;
  margin: 0 0.25rem 0.25rem 0;
  border-radius: 4px;
}

/* Inline code in package descriptions */
p > span > code,
.line-clamp-2 code {
  @apply font-mono;
  font-size: 0.85em;
  background: #1a1a1a;
  padding: 0.1em 0.3em;
  border-radius: 3px;
  border: 1px solid #262626;
}

/* View transition for search box (includes / and input) */
.search-box {
  view-transition-name: search-box;
}

/* Safari search input fixes */
input[type='search'] {
  -webkit-appearance: none;
  appearance: none;
}

input[type='search']::-webkit-search-decoration,
input[type='search']::-webkit-search-cancel-button,
input[type='search']::-webkit-search-results-button,
input[type='search']::-webkit-search-results-decoration {
  -webkit-appearance: none;
  appearance: none;
}

/* View transition for logo (hero -> header) */
.hero-logo,
.header-logo {
  view-transition-name: site-logo;
}

/* Disable the default fade transition on page navigation */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
}

/* Customize the view transition animations for specific elements */
::view-transition-old(search-box),
::view-transition-new(search-box),
::view-transition-old(site-logo),
::view-transition-new(site-logo) {
  animation-duration: 0.3s;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
</style>
