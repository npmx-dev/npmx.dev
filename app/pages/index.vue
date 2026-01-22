<script setup lang="ts">
const router = useRouter()
const searchQuery = ref('')

function handleSearch() {
  if (searchQuery.value.trim()) {
    router.push({ path: '/search', query: { q: searchQuery.value.trim() } })
  }
}

useSeoMeta({
  title: 'npmx - Better npm Package Browser',
  description: 'A fast, accessible npm package browser for power users. Search, browse, and manage npm packages with a modern interface.',
})
</script>

<template>
  <main>
    <header>
      <h1>npmx</h1>
      <p>A better npm package browser</p>
    </header>

    <search>
      <form
        role="search"
        @submit.prevent="handleSearch"
      >
        <label for="home-search">Search npm packages</label>
        <input
          id="home-search"
          v-model="searchQuery"
          type="search"
          name="q"
          placeholder="Search packages..."
          autocomplete="off"
          autofocus
        >
        <button type="submit">
          Search
        </button>
      </form>
    </search>

    <nav aria-label="Quick links">
      <ul>
        <li>
          <NuxtLink to="/search">
            Browse all packages
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </main>
</template>
