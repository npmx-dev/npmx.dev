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
  <main>
    <header>
      <h1>Search Packages</h1>
    </header>

    <search>
      <form
        role="search"
        @submit.prevent
      >
        <label for="search-input">Search npm packages</label>
        <input
          id="search-input"
          v-model="query"
          type="search"
          name="q"
          placeholder="Search packages..."
          autocomplete="off"
          autofocus
        >
      </form>
    </search>

    <section
      v-if="query"
      aria-label="Search results"
    >
      <div
        v-if="status === 'pending'"
        aria-busy="true"
      >
        <p>Searching...</p>
      </div>

      <div v-else-if="results">
        <p
          v-if="results.total > 0"
          role="status"
        >
          Found {{ formatNumber(results.total) }} packages
        </p>
        <p
          v-else
          role="status"
        >
          No packages found for "{{ query }}"
        </p>

        <ol v-if="results.objects.length > 0">
          <li
            v-for="result in results.objects"
            :key="result.package.name"
          >
            <article>
              <header>
                <h2>
                  <NuxtLink :to="`/package/${result.package.name}`">
                    {{ result.package.name }}
                  </NuxtLink>
                </h2>
                <span v-if="result.package.version">v{{ result.package.version }}</span>
              </header>

              <p v-if="result.package.description">
                {{ result.package.description }}
              </p>

              <footer>
                <dl>
                  <div v-if="result.package.publisher?.username">
                    <dt>Publisher</dt>
                    <dd>{{ result.package.publisher.username }}</dd>
                  </div>
                  <div v-if="result.package.date">
                    <dt>Updated</dt>
                    <dd>
                      <time :datetime="result.package.date">{{ formatDate(result.package.date) }}</time>
                    </dd>
                  </div>
                </dl>

                <ul
                  v-if="result.package.keywords?.length"
                  aria-label="Keywords"
                >
                  <li
                    v-for="keyword in result.package.keywords.slice(0, 5)"
                    :key="keyword"
                  >
                    <NuxtLink :to="`/search?q=keywords:${encodeURIComponent(keyword)}`">
                      {{ keyword }}
                    </NuxtLink>
                  </li>
                </ul>
              </footer>
            </article>
          </li>
        </ol>

        <nav
          v-if="totalPages > 1"
          aria-label="Pagination"
        >
          <ul>
            <li>
              <button
                :disabled="page <= 1"
                :aria-disabled="page <= 1"
                @click="goToPage(page - 1)"
              >
                Previous
              </button>
            </li>
            <li aria-current="page">
              Page {{ page }} of {{ totalPages }}
            </li>
            <li>
              <button
                :disabled="page >= totalPages"
                :aria-disabled="page >= totalPages"
                @click="goToPage(page + 1)"
              >
                Next
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </section>
  </main>
</template>
