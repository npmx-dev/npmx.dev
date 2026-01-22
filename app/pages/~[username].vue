<script setup lang="ts">
const route = useRoute('~username')

const username = computed(() => route.params.username)

// Search for packages by this maintainer
const searchQuery = computed(() => `maintainer:${username.value}`)
const searchOptions = computed(() => ({ size: 250 }))

const { data: results, status, error } = useNpmSearch(searchQuery, searchOptions)

// Sort packages by downloads/popularity (searchScore is a good proxy)
const sortedPackages = computed(() => {
  if (!results.value?.objects) return []
  return [...results.value.objects].sort((a, b) => b.searchScore - a.searchScore)
})

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

useSeoMeta({
  title: () => `@${username.value} - npmx`,
  description: () => `npm packages maintained by ${username.value}`,
})

defineOgImageComponent('Default', {
  title: () => `@${username.value}`,
  description: () => results.value ? `${results.value.total} packages` : 'npm user profile',
})
</script>

<template>
  <main class="container py-8 sm:py-12">
    <!-- Header -->
    <header class="mb-8 pb-8 border-b border-border">
      <div class="flex items-center gap-4 mb-4">
        <!-- Avatar placeholder -->
        <div
          class="w-16 h-16 rounded-full bg-bg-muted border border-border flex items-center justify-center"
          aria-hidden="true"
        >
          <span class="text-2xl text-fg-subtle font-mono">{{ username.charAt(0).toUpperCase() }}</span>
        </div>
        <div>
          <h1 class="font-mono text-2xl sm:text-3xl font-medium">
            @{{ username }}
          </h1>
          <p
            v-if="results?.total"
            class="text-fg-muted text-sm mt-1"
          >
            {{ formatNumber(results.total) }} public package{{ results.total === 1 ? '' : 's' }}
          </p>
        </div>
      </div>

      <!-- Link to npmjs.com profile -->
      <nav aria-label="External links">
        <a
          :href="`https://www.npmjs.com/~${username}`"
          target="_blank"
          rel="noopener noreferrer"
          class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
        >
          <span class="i-carbon-cube w-4 h-4" />
          view on npm
        </a>
      </nav>
    </header>

    <!-- Loading state -->
    <div
      v-if="status === 'pending'"
      aria-busy="true"
      class="flex items-center gap-3 text-fg-muted font-mono text-sm py-8"
    >
      <span class="w-4 h-4 border-2 border-fg-subtle border-t-fg rounded-full animate-spin" />
      Loading packages...
    </div>

    <!-- Error state -->
    <div
      v-else-if="status === 'error'"
      role="alert"
      class="py-12 text-center"
    >
      <p class="text-fg-muted mb-4">
        {{ error?.message ?? 'Failed to load user packages' }}
      </p>
      <NuxtLink
        to="/"
        class="btn"
      >
        Go back home
      </NuxtLink>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="results && results.total === 0"
      class="py-12 text-center"
    >
      <p class="text-fg-muted font-mono">
        No public packages found for <span class="text-fg">@{{ username }}</span>
      </p>
      <p class="text-fg-subtle text-sm mt-2">
        This user may not exist or has no public packages.
      </p>
    </div>

    <!-- Package list -->
    <section
      v-else-if="results && sortedPackages.length > 0"
      aria-label="User packages"
    >
      <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
        Packages
      </h2>

      <ol class="space-y-3 list-none m-0 p-0">
        <li
          v-for="(result, index) in sortedPackages"
          :key="result.package.name"
          class="animate-fade-in animate-fill-both"
          :style="{ animationDelay: `${Math.min(index * 0.02, 0.3)}s` }"
        >
          <article class="group card-interactive">
            <NuxtLink
              :to="`/package/${result.package.name}`"
              class="block focus:outline-none decoration-none"
            >
              <header class="flex items-start justify-between gap-4 mb-2">
                <h3 class="font-mono text-base font-medium text-fg group-hover:text-fg transition-colors duration-200 min-w-0 break-all">
                  {{ result.package.name }}
                </h3>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span
                    v-if="result.package.version"
                    class="font-mono text-xs text-fg-subtle"
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
                class="text-fg-muted text-sm line-clamp-2 mb-3"
              >
                <MarkdownText :text="result.package.description" />
              </p>

              <footer class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-subtle">
                <time
                  v-if="result.package.date"
                  :datetime="result.package.date"
                >
                  {{ formatDate(result.package.date) }}
                </time>
              </footer>
            </NuxtLink>

            <ul
              v-if="result.package.keywords?.length"
              aria-label="Keywords"
              class="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border list-none m-0 p-0"
            >
              <li
                v-for="keyword in result.package.keywords.slice(0, 5)"
                :key="keyword"
              >
                <NuxtLink
                  :to="`/search?q=keywords:${encodeURIComponent(keyword)}`"
                  class="tag decoration-none"
                >
                  {{ keyword }}
                </NuxtLink>
              </li>
            </ul>
          </article>
        </li>
      </ol>
    </section>
  </main>
</template>
