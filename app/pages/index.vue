<script setup lang="ts">
const router = useRouter()
const searchQuery = ref('')
const inputRef = ref<HTMLInputElement>()
const isSearchFocused = ref(false)

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
  <main class="container">
    <!-- Hero section with dramatic vertical centering -->
    <header class="min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center text-center py-20">
      <!-- Animated title -->
      <h1 class="font-mono text-5xl sm:text-7xl md:text-8xl font-medium tracking-tight mb-4 animate-fade-in animate-fill-both">
        <span class="text-fg-subtle">./</span>npmx
      </h1>

      <p
        class="text-fg-muted text-lg sm:text-xl max-w-md mb-12 animate-slide-up animate-fill-both"
        style="animation-delay: 0.1s"
      >
        a better npm package browser
      </p>

      <!-- Search form with micro-interactions -->
      <search
        class="w-full max-w-xl animate-slide-up animate-fill-both"
        style="animation-delay: 0.2s"
      >
        <form
          role="search"
          class="relative"
          @submit.prevent="handleSearch"
        >
          <label
            for="home-search"
            class="sr-only"
          >Search npm packages</label>

          <!-- Search input with glow effect on focus -->
          <div
            class="relative group"
            :class="{ 'is-focused': isSearchFocused }"
          >
            <!-- Subtle glow effect -->
            <div
              class="absolute -inset-px rounded-lg bg-gradient-to-r from-fg/0 via-fg/5 to-fg/0 opacity-0 transition-opacity duration-500 blur-sm group-[.is-focused]:opacity-100"
            />

            <div class="relative flex items-center">
              <span class="absolute left-4 text-fg-subtle font-mono text-sm pointer-events-none transition-colors duration-200 group-focus-within:text-fg-muted">
                $
              </span>

              <input
                id="home-search"
                ref="inputRef"
                v-model="searchQuery"
                type="search"
                name="q"
                placeholder="search packages..."
                autocomplete="off"
                autofocus
                class="w-full bg-bg-subtle border border-border rounded-lg pl-9 pr-24 py-4 font-mono text-base text-fg placeholder:text-fg-subtle transition-all duration-300 focus:(border-border-hover outline-none)"
                @focus="isSearchFocused = true"
                @blur="isSearchFocused = false"
              >

              <button
                type="submit"
                class="absolute right-2 px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:(bg-fg/90) active:scale-95 disabled:(opacity-50 cursor-not-allowed)"
                :disabled="!searchQuery.trim()"
              >
                search
              </button>
            </div>
          </div>

          <!-- Keyboard hint -->
          <p class="mt-3 text-fg-subtle text-xs font-mono">
            <kbd class="px-1.5 py-0.5 bg-bg-muted border border-border rounded text-[10px]">Enter</kbd>
            to search
          </p>
        </form>
      </search>
    </header>

    <!-- Minimal quick links -->
    <nav
      aria-label="Quick links"
      class="pb-20 text-center animate-fade-in animate-fill-both"
      style="animation-delay: 0.3s"
    >
      <ul class="flex items-center justify-center gap-8 list-none m-0 p-0">
        <li class="list-none">
          <NuxtLink
            to="/search"
            class="link-subtle font-mono text-sm inline-flex items-center gap-2 group"
          >
            <span class="w-1 h-1 rounded-full bg-fg-subtle group-hover:bg-fg transition-colors duration-200" />
            browse all
          </NuxtLink>
        </li>
        <li>
          <NuxtLink
            to="/package/nuxt"
            class="link-subtle font-mono text-sm inline-flex items-center gap-2 group"
          >
            <span class="w-1 h-1 rounded-full bg-fg-subtle group-hover:bg-fg transition-colors duration-200" />
            example: nuxt
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </main>
</template>
