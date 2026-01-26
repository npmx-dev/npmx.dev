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
  selected?: boolean
  index?: number
}>()

const emit = defineEmits<{
  focus: [index: number]
}>()
</script>

<template>
  <article
    class="group card-interactive scroll-mt-48 scroll-mb-6"
    :class="{ 'bg-bg-muted border-border-hover': selected }"
  >
    <NuxtLink
      :to="{ name: 'package', params: { package: result.package.name.split('/') } }"
      :prefetch-on="prefetch ? 'visibility' : 'interaction'"
      class="block focus:outline-none decoration-none scroll-mt-48 scroll-mb-6"
      :data-result-index="index"
      @focus="index != null && emit('focus', index)"
      @mouseenter="index != null && emit('focus', index)"
    >
      <header class="flex items-start justify-between gap-2 sm:gap-4 mb-2">
        <component
          :is="headingLevel ?? 'h3'"
          class="font-mono text-sm sm:text-base font-medium text-fg group-hover:text-fg transition-colors duration-200 min-w-0 break-words"
        >
          {{ result.package.name }}
        </component>
        <div class="flex items-center gap-1.5 shrink-0">
          <span
            v-if="result.package.version"
            class="font-mono text-xs text-fg-subtle truncate max-w-20 sm:max-w-32"
            :title="result.package.version"
          >
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

      <p
        v-if="result.package.description"
        class="text-fg-muted text-xs sm:text-sm line-clamp-2 mb-2 sm:mb-3"
      >
        <MarkdownText :text="result.package.description" />
      </p>

      <footer class="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 text-xs text-fg-subtle">
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
              <NuxtTime
                :datetime="result.package.date"
                year="numeric"
                month="short"
                day="numeric"
              />
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
