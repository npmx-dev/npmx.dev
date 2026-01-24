<script setup lang="ts">
import type { NpmSearchResult } from '#shared/types'

defineProps<{
  /** The search result object containing package data */
  result: NpmSearchResult
  /** Heading level for the package name (h2 for search, h3 for lists) */
  headingLevel?: 'h2' | 'h3'
  /** Whether to show the publisher username */
  showPublisher?: boolean
  prefetch?: boolean
}>()

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <article class="group card-interactive">
    <NuxtLink
      :to="{ name: 'package', params: { package: result.package.name.split('/') } }"
      :prefetch-on="prefetch ? 'visibility' : 'interaction'"
      class="block focus:outline-none decoration-none"
    >
      <header class="flex items-start justify-between gap-4 mb-2">
        <component
          :is="headingLevel ?? 'h3'"
          class="font-mono text-base font-medium text-fg group-hover:text-fg transition-colors duration-200 min-w-0 break-all"
        >
          {{ result.package.name }}
        </component>
        <div class="flex items-center gap-1.5 shrink-0">
          <span v-if="result.package.version" class="font-mono text-xs text-fg-subtle">
            v{{ result.package.version }}
          </span>
          <ProvenanceBadge
            v-if="result.package.publisher?.trustedPublisher"
            :provider="result.package.publisher.trustedPublisher.id"
            :package-name="result.package.name"
            :version="result.package.version"
            compact
          />
        </div>
      </header>

      <p v-if="result.package.description" class="text-fg-muted text-sm line-clamp-2 mb-3">
        <MarkdownText :text="result.package.description" />
      </p>

      <footer class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-subtle">
        <dl v-if="showPublisher || result.package.date" class="flex items-center gap-4 m-0">
          <div
            v-if="showPublisher && result.package.publisher?.username"
            class="flex items-center gap-1.5"
          >
            <dt class="sr-only">Publisher</dt>
            <dd class="font-mono">@{{ result.package.publisher.username }}</dd>
          </div>
          <div v-if="result.package.date" class="flex items-center gap-1.5">
            <dt class="sr-only">Updated</dt>
            <dd>
              <time :datetime="result.package.date">{{ formatDate(result.package.date) }}</time>
            </dd>
          </div>
        </dl>
      </footer>
    </NuxtLink>

    <ul
      v-if="result.package.keywords?.length"
      aria-label="Keywords"
      class="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border list-none m-0 p-0"
    >
      <li v-for="keyword in result.package.keywords.slice(0, 5)" :key="keyword">
        <NuxtLink
          :to="{ name: 'search', query: { q: `keywords:${keyword}` } }"
          class="tag decoration-none"
        >
          {{ keyword }}
        </NuxtLink>
      </li>
    </ul>
  </article>
</template>
