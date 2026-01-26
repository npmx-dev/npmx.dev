<script setup lang="ts">
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
    class="group card-interactive scroll-mt-48 scroll-mb-6 relative focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-bg focus-within:ring-offset-2 focus-within:ring-fg/50"
    :class="{ 'bg-bg-muted border-border-hover': selected }"
  >
    <div class="mb-2 flex items-baseline justify-between gap-2">
      <component
        :is="headingLevel ?? 'h3'"
        class="font-mono text-sm sm:text-base font-medium text-fg group-hover:text-fg transition-colors duration-200 min-w-0 break-all"
      >
        <NuxtLink
          :to="{ name: 'package', params: { package: result.package.name.split('/') } }"
          :prefetch-on="prefetch ? 'visibility' : 'interaction'"
          class="focus-visible:outline-none decoration-none scroll-mt-48 scroll-mb-6 after:content-[''] after:absolute after:inset-0"
          :data-result-index="index"
          @focus="index != null && emit('focus', index)"
          @mouseenter="index != null && emit('focus', index)"
        >
          {{ result.package.name }}
        </NuxtLink>
      </component>
      <!-- Mobile: version next to package name -->
      <div class="sm:hidden text-fg-subtle flex items-center gap-1.5 shrink-0">
        <span
          v-if="result.package.version"
          class="font-mono text-xs truncate max-w-20"
          :title="result.package.version"
        >
          v{{ result.package.version }}
        </span>
        <ProvenanceBadge
          v-if="result.package.publisher?.trustedPublisher"
          :provider="result.package.publisher.trustedPublisher.id"
          :package-name="result.package.name"
          :version="result.package.version"
          :linked="false"
          compact
        />
      </div>
    </div>
    <div class="flex justify-between items-start gap-4 sm:gap-8">
      <div class="min-w-0">
        <p
          v-if="result.package.description"
          class="text-fg-muted text-xs sm:text-sm line-clamp-2 mb-2 sm:mb-3"
        >
          <MarkdownText :text="result.package.description" />
        </p>
        <div class="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 text-xs text-fg-subtle">
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
        </div>
        <!-- Mobile: downloads on separate row -->
        <dl
          v-if="result.downloads?.weekly"
          class="sm:hidden flex items-center gap-4 mt-2 text-xs text-fg-subtle m-0"
        >
          <div class="flex items-center gap-1.5">
            <dt class="sr-only">Weekly downloads</dt>
            <dd class="flex items-center gap-1.5">
              <span class="i-carbon-chart-line w-3.5 h-3.5 inline-block" aria-hidden="true" />
              <span class="font-mono">{{ formatNumber(result.downloads.weekly) }}/w</span>
            </dd>
          </div>
        </dl>
      </div>
      <!-- Desktop: version and downloads on right side -->
      <div class="hidden sm:flex flex-col gap-2 shrink-0">
        <div class="text-fg-subtle flex items-start gap-2 justify-end">
          <span
            v-if="result.package.version"
            class="font-mono text-xs truncate max-w-32"
            :title="result.package.version"
          >
            v{{ result.package.version }}
          </span>
          <div
            v-if="result.package.publisher?.trustedPublisher"
            class="flex items-center gap-1.5 shrink-0 max-w-32"
          >
            <ProvenanceBadge
              :provider="result.package.publisher.trustedPublisher.id"
              :package-name="result.package.name"
              :version="result.package.version"
              :linked="false"
              compact
            />
          </div>
        </div>
        <div
          v-if="result.downloads?.weekly"
          class="text-fg-subtle gap-2 flex items-center justify-end"
        >
          <span class="i-carbon-chart-line w-3.5 h-3.5 inline-block" aria-hidden="true" />
          <span class="font-mono text-xs">
            {{ formatNumber(result.downloads.weekly) }} / week
          </span>
        </div>
      </div>
    </div>

    <ul
      v-if="result.package.keywords?.length"
      aria-label="Keywords"
      class="relative z-10 flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border list-none m-0 p-0"
    >
      <li v-for="keyword in result.package.keywords.slice(0, 5)" :key="keyword">
        <NuxtLink
          :to="{ name: 'search', query: { q: `keywords:${keyword}` } }"
          class="tag decoration-none focus-visible:ring-2 focus-visible:ring-fg/50 focus-visible:outline-none"
        >
          {{ keyword }}
        </NuxtLink>
      </li>
    </ul>
  </article>
</template>
