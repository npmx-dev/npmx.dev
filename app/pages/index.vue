<script setup lang="ts">
import { debounce } from 'perfect-debounce'

const socialLinks = {
  github: 'https://repo.npmx.dev',
  discord: 'https://chat.npmx.dev',
  bluesky: 'https://social.npmx.dev',
}

const searchQuery = shallowRef('')
const searchInputRef = useTemplateRef('searchInputRef')
const { focused: isSearchFocused } = useFocus(searchInputRef)

async function search() {
  const query = searchQuery.value.trim()
  await navigateTo({
    path: '/search',
    query: query ? { q: query } : undefined,
  })
  const newQuery = searchQuery.value.trim()
  if (newQuery !== query) {
    await search()
  }
}

const handleInput = isTouchDevice()
  ? search
  : debounce(search, 250, { leading: true, trailing: true })

useSeoMeta({
  title: () => $t('seo.home.title'),
  description: () => $t('seo.home.description'),
})

defineOgImageComponent('Default', {
  primaryColor: '#60a5fa',
  title: 'npmx',
  description: 'A better browser for the **npm registry**',
})
</script>

<template>
  <main class="container min-h-screen flex flex-col">
    <!-- Hero section with vertical centering -->
    <header class="flex-1 flex flex-col items-center justify-center text-center py-20">
      <!-- Animated title -->
      <h1
        dir="ltr"
        class="flex items-center justify-center gap-2 header-logo font-mono text-5xl sm:text-7xl md:text-8xl font-medium tracking-tight mb-4 motion-safe:animate-fade-in motion-safe:animate-fill-both"
      >
        <img
          aria-hidden="true"
          :alt="$t('alt_logo')"
          src="/logo.svg"
          width="48"
          height="48"
          class="w-12 h-12 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl sm:rounded-3xl"
        />
        <span class="pb-4">npmx</span>
      </h1>

      <p
        class="text-fg-muted text-lg sm:text-xl max-w-md mb-12 motion-safe:animate-slide-up motion-safe:animate-fill-both"
        style="animation-delay: 0.1s"
      >
        {{ $t('tagline') }}
      </p>

      <!-- Search form with micro-interactions -->
      <search
        class="w-full max-w-xl motion-safe:animate-slide-up motion-safe:animate-fill-both"
        style="animation-delay: 0.2s"
      >
        <form method="GET" action="/search" class="relative" @submit.prevent.trim="search">
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
                class="absolute inset-is-4 text-fg-subtle font-mono text-sm pointer-events-none transition-colors duration-200 group-focus-within:text-accent z-1"
              >
                /
              </span>

              <input
                id="home-search"
                ref="searchInputRef"
                v-model="searchQuery"
                type="search"
                name="q"
                autofocus
                :placeholder="$t('search.placeholder')"
                v-bind="noCorrect"
                class="w-full bg-bg-subtle border border-border rounded-lg ps-8 pe-24 py-4 font-mono text-base text-fg placeholder:text-fg-subtle transition-border-color duration-300 focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                @input="handleInput"
              />

              <button
                type="submit"
                class="absolute inset-ie-2 px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-[background-color,transform] duration-200 hover:bg-fg/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
              >
                {{ $t('search.button') }}
              </button>
            </div>
          </div>
        </form>
      </search>

      <!-- Build info badge -->
      <BuildEnvironment class="mt-4" />
    </header>

    <!-- Popular packages -->
    <nav
      :aria-label="$t('nav.popular_packages')"
      class="pt-4 pb-12 text-center motion-safe:animate-fade-in motion-safe:animate-fill-both"
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
              class="w-1 h-1 rounded-full bg-accent group-hover:bg-fg transition-colors duration-200"
            />
            {{ pkg }}
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <!-- Get Involved CTAs -->
    <section
      class="pb-24 sm:pb-32 motion-safe:animate-fade-in motion-safe:animate-fill-both"
      style="animation-delay: 0.4s"
    >
      <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-6 text-center">
        {{ $t('about.get_involved.title') }}
      </h2>

      <div class="grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto">
        <!-- Contribute CTA -->
        <a
          :href="socialLinks.github"
          target="_blank"
          rel="noopener noreferrer"
          class="group flex flex-col gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200"
        >
          <div class="flex gap-2">
            <span
              class="i-carbon:logo-github shrink-0 mt-1 w-5 h-5 text-fg"
              aria-hidden="true"
            />
            <span class="font-medium text-fg">{{
              $t('about.get_involved.contribute.title')
            }}</span>
          </div>
          <p class="text-sm text-fg-muted leading-relaxed">
            {{ $t('about.get_involved.contribute.description') }}
          </p>
          <span
            class="text-sm text-fg-muted group-hover:text-fg inline-flex items-center gap-1 mt-auto"
          >
            {{ $t('about.get_involved.contribute.cta') }}
            <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
          </span>
        </a>

        <!-- Community CTA -->
        <a
          :href="socialLinks.discord"
          target="_blank"
          rel="noopener noreferrer"
          class="group flex flex-col gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200"
        >
          <div class="flex gap-2">
            <span class="i-carbon:chat shrink-0 mt-1 w-5 h-5 text-fg" aria-hidden="true" />
            <span class="font-medium text-fg">{{
              $t('about.get_involved.community.title')
            }}</span>
          </div>
          <p class="text-sm text-fg-muted leading-relaxed">
            {{ $t('about.get_involved.community.description') }}
          </p>
          <span
            class="text-sm text-fg-muted group-hover:text-fg inline-flex items-center gap-1 mt-auto"
          >
            {{ $t('about.get_involved.community.cta') }}
            <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
          </span>
        </a>

        <!-- Follow CTA -->
        <a
          :href="socialLinks.bluesky"
          target="_blank"
          rel="noopener noreferrer"
          class="group flex flex-col gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200"
        >
          <div class="flex gap-2">
            <span
              class="i-simple-icons:bluesky shrink-0 mt-1 w-5 h-5 text-fg"
              aria-hidden="true"
            />
            <span class="font-medium text-fg">{{ $t('about.get_involved.follow.title') }}</span>
          </div>
          <p class="text-sm text-fg-muted leading-relaxed">
            {{ $t('about.get_involved.follow.description') }}
          </p>
          <span
            class="text-sm text-fg-muted group-hover:text-fg inline-flex items-center gap-1 mt-auto"
          >
            {{ $t('about.get_involved.follow.cta') }}
            <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
          </span>
        </a>
      </div>
    </section>
  </main>
</template>
