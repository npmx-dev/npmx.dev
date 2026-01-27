<script setup lang="ts">
const router = useRouter()
const searchQuery = ref('')
const isSearchFocused = ref(false)

function handleSearch() {
  router.push({
    path: '/search',
    query: searchQuery.value.trim() ? { q: searchQuery.value.trim() } : undefined,
  })
}

const { t } = useI18n()
useSeoMeta({
  title: t('seo.home.title'),
  description: t('seo.home.description'),
})

defineOgImageComponent('Default')
</script>

<template>
  <main class="container min-h-screen flex flex-col">
    <!-- Hero section with vertical centering -->
    <header class="flex-1 flex flex-col items-center justify-center text-center py-20">
      <!-- Animated title -->
      <h1
        class="font-mono text-5xl sm:text-7xl md:text-8xl font-medium tracking-tight mb-4 animate-fade-in animate-fill-both"
      >
        <span class="text-fg-subtle"><span style="letter-spacing: -0.2em">.</span>/</span>npmx
      </h1>

      <p
        class="text-fg-muted text-lg sm:text-xl max-w-md mb-12 animate-slide-up animate-fill-both"
        style="animation-delay: 0.1s"
      >
        {{ $t('tagline') }}
      </p>

      <!-- Search form with micro-interactions -->
      <search
        class="w-full max-w-xl animate-slide-up animate-fill-both"
        style="animation-delay: 0.2s"
      >
        <form role="search" class="relative" @submit.prevent="handleSearch">
          <label for="home-search" class="sr-only">
            {{ $t('search.label') }}
          </label>

          <!-- Search input with glow effect on focus -->
          <div class="relative group" :class="{ 'is-focused': isSearchFocused }">
            <!-- Subtle glow effect -->
            <div
              class="absolute -inset-px rounded-lg bg-gradient-to-r from-fg/0 via-fg/5 to-fg/0 opacity-0 transition-opacity duration-500 blur-sm group-[.is-focused]:opacity-100"
            />

            <div class="search-box relative flex items-center">
              <span
                class="absolute left-4 text-fg-subtle font-mono text-sm pointer-events-none transition-colors duration-200 group-focus-within:text-fg-muted z-1"
              >
                /
              </span>

              <input
                id="home-search"
                v-model="searchQuery"
                type="search"
                name="q"
                :placeholder="$t('search.placeholder')"
                autocomplete="off"
                class="w-full bg-bg-subtle border border-border rounded-lg pl-8 pr-24 py-4 font-mono text-base text-fg placeholder:text-fg-subtle transition-all duration-300 focus:(border-border-hover outline-none)"
                @input="handleSearch"
                @focus="isSearchFocused = true"
                @blur="isSearchFocused = false"
              />

              <button
                type="submit"
                class="absolute right-2 px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 active:scale-95"
              >
                {{ $t('search.button') }}
              </button>
            </div>
          </div>
        </form>
      </search>
    </header>

    <!-- Popular packages -->
    <nav
      :aria-label="$t('nav.popular_packages')"
      class="pb-20 text-center animate-fade-in animate-fill-both"
      style="animation-delay: 0.3s"
    >
      <ul class="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 list-none m-0 p-0">
        <li
          v-for="pkg in ['nuxt', 'vue', 'react', 'svelte', 'vite', 'next', 'astro', 'typescript']"
          :key="pkg"
        >
          <NuxtLink
            :to="{ name: 'package', params: { package: [pkg] } }"
            class="link-subtle font-mono text-sm inline-flex items-center gap-2 group"
          >
            <span
              class="w-1 h-1 rounded-full bg-fg-subtle group-hover:bg-fg transition-colors duration-200"
            />
            {{ pkg }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </main>
</template>
