<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const query = computed({
  get: () => (route.query.q as string) ?? '',
  set: (value: string) => {
    router.push({ query: { ...route.query, q: value || undefined } })
  },
})

const page = computed(() => {
  const p = Number.parseInt(route.query.page as string, 10)
  return Number.isNaN(p) ? 1 : Math.max(1, p)
})

const pageSize = 20

const searchOptions = computed(() => ({
  size: pageSize,
  from: (page.value - 1) * pageSize,
}))

const { data: results, status } = useNpmSearch(query, searchOptions)

const totalPages = computed(() => {
  if (!results.value) return 0
  return Math.ceil(results.value.total / pageSize)
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

function goToPage(newPage: number) {
  router.push({ query: { ...route.query, page: newPage > 1 ? newPage : undefined } })
}

useSeoMeta({
  title: () => query.value ? `Search: ${query.value} - npmx` : 'Search Packages - npmx',
})
</script>

<template>
  <main class="container py-8 sm:py-12">
    <header class="mb-8">
      <h1 class="font-mono text-2xl sm:text-3xl font-medium mb-6">
        <span class="text-fg-subtle">$</span> search
      </h1>

      <search>
        <form
          role="search"
          class="relative"
          @submit.prevent
        >
          <label
            for="search-input"
            class="sr-only"
          >Search npm packages</label>

          <div class="relative flex items-center">
            <span class="absolute left-4 text-fg-subtle font-mono text-sm">npm search</span>
            <input
              id="search-input"
              v-model="query"
              type="search"
              name="q"
              placeholder="package name..."
              autocomplete="off"
              autofocus
              class="w-full bg-bg-subtle border border-border rounded-lg pl-28 pr-4 py-3 font-mono text-sm text-fg placeholder:text-fg-subtle transition-all duration-200 focus:(border-border-hover outline-none)"
            >
          </div>
        </form>
      </search>
    </header>

    <section
      v-if="query"
      aria-label="Search results"
    >
      <div
        v-if="status === 'pending'"
        aria-busy="true"
        class="flex items-center gap-3 text-fg-muted font-mono text-sm py-8"
      >
        <span class="w-4 h-4 border-2 border-fg-subtle border-t-fg rounded-full animate-spin" />
        Searching...
      </div>

      <div v-else-if="results">
        <p
          v-if="results.total > 0"
          role="status"
          class="text-fg-muted text-sm mb-6 font-mono"
        >
          Found <span class="text-fg">{{ formatNumber(results.total) }}</span> packages
        </p>

        <p
          v-else
          role="status"
          class="text-fg-muted py-12 text-center font-mono"
        >
          No packages found for "<span class="text-fg">{{ query }}</span>"
        </p>

        <ol
          v-if="results.objects.length > 0"
          class="space-y-3 list-none m-0 p-0"
        >
          <li
            v-for="(result, index) in results.objects"
            :key="result.package.name"
            class="animate-slide-up"
            :style="{ animationDelay: `${index * 0.03}s` }"
          >
            <article class="group card-interactive">
              <NuxtLink
                :to="`/package/${result.package.name}`"
                class="block focus:outline-none decoration-none"
              >
                <header class="flex items-start justify-between gap-4 mb-2">
                  <h2 class="font-mono text-base font-medium text-fg group-hover:text-fg transition-colors duration-200">
                    {{ result.package.name }}
                  </h2>
                  <span
                    v-if="result.package.version"
                    class="font-mono text-xs text-fg-subtle shrink-0"
                  >
                    v{{ result.package.version }}
                  </span>
                </header>

                <p
                  v-if="result.package.description"
                  class="text-fg-muted text-sm line-clamp-2 mb-3"
                >
                  {{ result.package.description }}
                </p>

                <footer class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-subtle">
                  <dl class="flex items-center gap-4 m-0">
                    <div
                      v-if="result.package.publisher?.username"
                      class="flex items-center gap-1.5"
                    >
                      <dt class="sr-only">
                        Publisher
                      </dt>
                      <dd class="font-mono">
                        @{{ result.package.publisher.username }}
                      </dd>
                    </div>
                    <div
                      v-if="result.package.date"
                      class="flex items-center gap-1.5"
                    >
                      <dt class="sr-only">
                        Updated
                      </dt>
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

        <nav
          v-if="totalPages > 1"
          aria-label="Pagination"
          class="mt-12 flex items-center justify-center"
        >
          <ul class="flex items-center gap-2 list-none m-0 p-0">
            <li>
              <button
                :disabled="page <= 1"
                :aria-disabled="page <= 1"
                class="btn-ghost"
                @click="goToPage(page - 1)"
              >
                <span class="mr-1">&larr;</span> prev
              </button>
            </li>
            <li
              aria-current="page"
              class="px-4 py-2 font-mono text-sm text-fg-muted"
            >
              <span class="text-fg">{{ page }}</span>
              <span class="mx-1">/</span>
              <span>{{ totalPages }}</span>
            </li>
            <li>
              <button
                :disabled="page >= totalPages"
                :aria-disabled="page >= totalPages"
                class="btn-ghost"
                @click="goToPage(page + 1)"
              >
                next <span class="ml-1">&rarr;</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </section>

    <section
      v-else
      class="py-20 text-center"
    >
      <p class="text-fg-subtle font-mono text-sm">
        Start typing to search packages
      </p>
    </section>
  </main>
</template>
