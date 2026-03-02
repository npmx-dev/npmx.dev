<script setup lang="ts">
import type { RecentItem } from '~/composables/useRecentlyViewed'
import type { RouteLocationRaw } from 'vue-router'

const { model: searchQuery, flushUpdateUrlQuery } = useGlobalSearch()
const isSearchFocused = shallowRef(false)

async function search() {
  flushUpdateUrlQuery()
}

const { env } = useAppConfig().buildInfo

useSeoMeta({
  title: () => $t('seo.home.title'),
  ogTitle: () => $t('seo.home.title'),
  twitterTitle: () => $t('seo.home.title'),
  description: () => $t('seo.home.description'),
  ogDescription: () => $t('seo.home.description'),
  twitterDescription: () => $t('seo.home.description'),
})

defineOgImageComponent('Default', {
  primaryColor: '#60a5fa',
  title: 'npmx',
  description: 'a fast, modern browser for the **npm registry**',
})

const { items: recentItems } = useRecentlyViewed()

function recentItemRoute(item: RecentItem): RouteLocationRaw {
  switch (item.type) {
    case 'package':
      return packageRoute(item.name)
    case 'org':
      return { name: 'org', params: { org: item.name } }
    case 'user':
      return { name: '~username', params: { username: item.name } }
  }
}
</script>

<template>
  <main>
    <section class="container min-h-screen flex flex-col">
      <header
        class="flex-1 flex flex-col items-center justify-center text-center pt-20 pb-4 md:pb-8 lg:pb-20"
      >
        <h1
          dir="ltr"
          class="relative flex items-center justify-center gap-2 header-logo font-mono text-5xl sm:text-7xl md:text-8xl font-medium tracking-tight mb-6 motion-safe:animate-fade-in motion-safe:animate-fill-both"
        >
          <AppLogo class="w-42 h-auto sm:w-58 md:w-70" />
          <span
            aria-hidden="true"
            class="text-sm sm:text-base md:text-lg transform-origin-br font-mono tracking-widest text-accent absolute -bottom-4 -inset-ie-1.5"
          >
            {{ env === 'release' ? 'alpha' : env }}
          </span>
        </h1>

        <p
          class="text-fg-muted text-lg sm:text-xl max-w-xl mb-12 lg:mb-14 motion-safe:animate-slide-up motion-safe:animate-fill-both"
          style="animation-delay: 0.1s"
        >
          {{ $t('tagline') }}
        </p>
        <search
          class="w-full max-w-xl motion-safe:animate-slide-up motion-safe:animate-fill-both"
          style="animation-delay: 0.2s"
        >
          <form method="GET" action="/search" class="relative" @submit.prevent.trim="search">
            <label for="home-search" class="sr-only">
              {{ $t('search.label') }}
            </label>

            <div class="relative group" :class="{ 'is-focused': isSearchFocused }">
              <div
                class="absolute z-1 -inset-px pointer-events-none rounded-lg bg-gradient-to-r from-fg/0 to-accent/5 opacity-0 transition-opacity duration-500 blur-sm group-[.is-focused]:opacity-100"
              />

              <div class="search-box relative flex items-center">
                <span
                  class="absolute inset-is-4 text-fg-subtle font-mono text-lg pointer-events-none transition-colors duration-200 motion-reduce:transition-none [.group:hover:not(:focus-within)_&]:text-fg/80 group-focus-within:text-accent z-1"
                >
                  /
                </span>

                <InputBase
                  id="home-search"
                  v-model="searchQuery"
                  type="search"
                  name="q"
                  autofocus
                  :placeholder="$t('search.placeholder')"
                  no-correct
                  size="large"
                  class="w-full ps-8 pe-24"
                  @focus="isSearchFocused = true"
                  @blur="isSearchFocused = false"
                />

                <ButtonBase
                  type="submit"
                  variant="primary"
                  class="absolute inset-ie-2 border-transparent"
                  classicon="i-lucide:search"
                >
                  <span class="sr-only sm:not-sr-only">
                    {{ $t('search.button') }}
                  </span>
                </ButtonBase>
              </div>
            </div>
          </form>
        </search>

        <BuildEnvironment class="mt-4" />
      </header>

      <div class="pt-4 pb-36 sm:pb-40 max-w-xl mx-auto">
        <ClientOnly>
          <nav
            v-if="recentItems.length > 0"
            aria-labelledby="recently-viewed-label"
            class="text-center motion-safe:animate-fade-in motion-safe:animate-fill-both"
            style="animation-delay: 0.3s"
          >
            <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
              <span id="recently-viewed-label" class="text-xs text-fg-subtle tracking-wider">
                {{ $t('nav.recently_viewed') }}:
              </span>
              <ul
                class="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 list-none m-0 p-0"
              >
                <li v-for="item in recentItems" :key="`${item.type}-${item.name}`">
                  <LinkBase :to="recentItemRoute(item)" class="text-sm">
                    {{ item.label }}
                  </LinkBase>
                </li>
              </ul>
            </div>
          </nav>
        </ClientOnly>
      </div>
    </section>

    <section class="border-t border-border py-24 bg-bg-subtle/10">
      <div class="container max-w-3xl mx-auto">
        <CallToAction />
      </div>
    </section>
  </main>
</template>
