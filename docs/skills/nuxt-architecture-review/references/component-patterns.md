# Component Patterns Reference

## Table of Contents

- [Server/Client Component Split](#serverclient-component-split)
- [defineModel Patterns](#definemodel-patterns)
- [Route Aliases](#route-aliases)
- [Canonical Redirects Middleware](#canonical-redirects-middleware)
- [XSS-Safe Markdown Rendering](#xss-safe-markdown-rendering)

---

## Server/Client Component Split

### When to split

| Scenario                                            | Approach                             |
| --------------------------------------------------- | ------------------------------------ |
| Component needs browser APIs (localStorage, window) | `.client.vue`                        |
| Component is purely presentational, no JS needed    | `.server.vue`                        |
| Component has different SSR vs client behavior      | Both `.server.vue` and `.client.vue` |
| Component needs interactivity + SSR                 | Single `.vue` (default)              |

### Example: auth-aware menu

```vue
<!-- app/components/Header/AccountMenu.server.vue -->
<template>
  <!-- SSR placeholder: simple login link, no JS -->
  <a href="/login" class="text-sm text-fg-muted">Sign in</a>
</template>
```

```vue
<!-- app/components/Header/AccountMenu.client.vue -->
<script setup lang="ts">
const { user, logout } = useAuth()
</script>
<template>
  <div v-if="user">
    <img :src="user.avatar" :alt="user.name" />
    <button @click="logout">Sign out</button>
  </div>
  <a v-else href="/login">Sign in</a>
</template>
```

### How it works

1. During SSR, Nuxt renders `AccountMenu.server.vue` (no JS shipped)
2. After hydration, Nuxt replaces it with `AccountMenu.client.vue`
3. The client version has full interactivity and browser API access

---

## defineModel Patterns

### Basic v-model

```vue
<!-- Child: ToggleSwitch.vue -->
<script setup lang="ts">
const modelValue = defineModel<boolean>({ required: true })
</script>
<template>
  <button @click="modelValue = !modelValue">
    {{ modelValue ? 'On' : 'Off' }}
  </button>
</template>

<!-- Parent -->
<ToggleSwitch v-model="isDarkMode" />
```

### Named v-model (multiple models)

```vue
<!-- Child: DataTable.vue -->
<script setup lang="ts">
const sortOption = defineModel<string>('sortOption', { required: true })
const pageSize = defineModel<number>('pageSize', { default: 25 })
const currentPage = defineModel<number>('page', { default: 1 })
</script>

<!-- Parent -->
<DataTable v-model:sort-option="currentSort" v-model:page-size="rowsPerPage" v-model:page="page" />
```

### Replacing the old pattern

Before (Vue 3.3 and earlier):

```ts
const props = defineProps<{ sortOption: string }>()
const emit = defineEmits<{ 'update:sortOption': [value: string] }>()
const localSort = computed({
  get: () => props.sortOption,
  set: v => emit('update:sortOption', v),
})
```

After (Vue 3.4+):

```ts
const sortOption = defineModel<string>('sortOption', { required: true })
```

---

## Route Aliases

### Pattern: multiple URL shapes for one page

```ts
// app/pages/package-code/[...path].vue
definePageMeta({
  name: 'code',
  path: '/package-code/:path+',
  alias: [
    '/package/code/:path+', // Legacy URL pattern
    '/code/:path+', // Shorthand
  ],
})
```

All three URLs render the same page component:

- `/package-code/vue/v/3.5.0/src/index.ts`
- `/package/code/vue/v/3.5.0/src/index.ts`
- `/code/vue/v/3.5.0/src/index.ts`

### When to use aliases vs redirects

| Scenario                                     | Use                          |
| -------------------------------------------- | ---------------------------- |
| Both URLs are valid and should be accessible | Alias                        |
| One URL is canonical, others should redirect | Redirect (middleware)        |
| Backwards compatibility with old URL scheme  | Alias (or redirect with 301) |

---

## Canonical Redirects Middleware

### Full implementation

```ts
// server/middleware/canonical-redirects.global.ts

// Pages that should NOT be redirected (they have their own routes)
const reservedPaths = ['/about', '/search', '/settings', '/api', '/package']

const cacheControl = 's-maxage=3600, stale-while-revalidate=36000'

export default defineEventHandler(async event => {
  const [path = '/', query] = event.path.split('?')

  // Skip internal paths
  if (path.startsWith('/~') || path.startsWith('/_')) return

  // Skip known page routes
  if (reservedPaths.some(p => path === p || path.startsWith(p + '/'))) return

  // /vue -> /package/vue (shorthand package URL)
  const pkgMatch = path.match(/^\/(?:(?<org>@[^/]+)\/)?(?<name>[^/@]+)$/)
  if (pkgMatch?.groups) {
    const parts = [pkgMatch.groups.org, pkgMatch.groups.name].filter(Boolean).join('/')
    setHeader(event, 'cache-control', cacheControl)
    return sendRedirect(event, `/package/${parts}${query ? '?' + query : ''}`, 301)
  }

  // /vue@3.5.0 -> /package/vue/v/3.5.0
  const versionMatch = path.match(/^\/(?:(?<org>@[^/]+)\/)?(?<name>[^/@]+)@(?<version>[^/]+)$/)
  if (versionMatch?.groups) {
    const parts = [versionMatch.groups.org, versionMatch.groups.name].filter(Boolean).join('/')
    setHeader(event, 'cache-control', cacheControl)
    return sendRedirect(
      event,
      `/package/${parts}/v/${versionMatch.groups.version}${query ? '?' + query : ''}`,
      301,
    )
  }
})
```

### Key design decisions

1. **Early returns** -- Skip known paths first to avoid regex evaluation
2. **Cache-Control on redirects** -- CDN caches the redirect itself, avoiding a server roundtrip
3. **301 Permanent** -- Tells search engines to index only the canonical URL
4. **Query preservation** -- Redirects preserve query parameters

---

## XSS-Safe Markdown Rendering

### Complete inline markdown parser

```ts
// app/composables/useMarkdown.ts

function stripAndEscapeHtml(text: string): string {
  // Decode HTML entities first
  let stripped = decodeHtmlEntities(text)

  // Strip markdown image badges (bounded quantifiers for ReDoS safety)
  stripped = stripped.replace(/\[!\[[^\]]{0,500}\]\([^)]{0,2000}\)\]\([^)]{0,2000}\)?/g, '')
  stripped = stripped.replace(/!\[[^\]]{0,500}\]\([^)]{0,2000}\)/g, '')

  // Strip HTML tags (keep text content)
  stripped = stripped.replace(/<\/?[a-z][^>]*>/gi, '')

  // Escape remaining HTML entities
  return stripped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function parseMarkdown(text: string): string {
  if (!text) return ''

  let html = stripAndEscapeHtml(text)

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Links with protocol validation
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    try {
      const { protocol, href } = new URL(url)
      if (['https:', 'mailto:'].includes(protocol)) {
        const safeUrl = href.replace(/"/g, '&quot;')
        return `<a href="${safeUrl}" rel="nofollow noreferrer noopener" target="_blank">${text}</a>`
      }
    } catch {}
    return `${text} (${url})`
  })

  return html
}
```

### Security checklist for v-html

1. **Escape HTML entities** before any markdown processing
2. **Validate URL protocols** -- only allow `https:` and `mailto:`
3. **Add `rel="nofollow noreferrer noopener"`** to all external links
4. **Use bounded quantifiers** in regex (e.g., `{0,500}` instead of `*`)
5. **Strip image badges** that could contain tracking pixels
6. **Never render raw user input** without sanitization
