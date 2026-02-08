<script setup lang="ts">
import { debounce } from 'perfect-debounce'
import { SHOWCASED_FRAMEWORKS } from '~/utils/frameworks'

const searchQuery = shallowRef('')
const searchInputRef = useTemplateRef('searchInputRef')
const { focused: isSearchFocused } = useFocus(searchInputRef)

async function search() {
  const query = searchQuery.value.trim()
  if (!query) return
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
</script>

<template>
  <main>
    <section class="container min-h-screen flex flex-col">
      <header
        class="flex-1 flex flex-col items-center justify-center text-center pt-20 pb-4 md:pb-8 lg:pb-20"
      >
        <h1
          dir="ltr"
          class="flex items-center justify-center gap-2 header-logo font-mono text-5xl sm:text-7xl md:text-8xl font-medium tracking-tight mb-2 motion-safe:animate-fade-in motion-safe:animate-fill-both"
        >
          <AppLogo
            class="w-12 h-12 -ms-3 sm:w-20 sm:h-20 sm:-ms-5 md:w-24 md:h-24 md:-ms-6 rounded-2xl sm:rounded-3xl"
          />
          <span class="pb-4">npmx</span>
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
                class="absolute -inset-px rounded-lg bg-gradient-to-r from-fg/0 via-fg/5 to-fg/0 opacity-0 transition-opacity duration-500 blur-sm group-[.is-focused]:opacity-100"
              />

              <div class="search-box relative flex items-center">
                <span
                  class="absolute inset-is-4 text-fg-subtle font-mono text-lg pointer-events-none transition-colors duration-200 motion-reduce:transition-none [.group:hover:not(:focus-within)_&]:text-fg/80 group-focus-within:text-accent z-1"
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
                  class="w-full bg-bg-subtle border border-border rounded-xl ps-8 pe-24 h-14 py-4 font-mono text-base text-fg placeholder:text-fg-subtle transition-[border-color,outline-color] duration-300 motion-reduce:transition-none hover:border-fg-subtle outline-2 outline-transparent focus:border-accent focus-visible:(outline-2 outline-accent/70)"
                  @input="handleInput"
                />

                <ButtonBase
                  type="submit"
                  variant="primary"
                  class="absolute inset-ie-2"
                  classicon="i-carbon:search"
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

      <nav
        :aria-label="$t('nav.popular_packages')"
        class="pt-4 pb-36 sm:pb-40 text-center motion-safe:animate-fade-in motion-safe:animate-fill-both"
        style="animation-delay: 0.3s"
      >
        <ul class="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 list-none m-0 p-0">
          <li v-for="framework in SHOWCASED_FRAMEWORKS" :key="framework.name">
            <LinkBase :to="packageRoute(framework.package)" class="gap-2 text-sm">
              <span
                class="w-1 h-1 rounded-full bg-accent group-hover:bg-fg transition-colors duration-200"
              />
              {{ framework.name }}
            </LinkBase>
          </li>
        </ul>
      </nav>
    </section>

    <section class="border-t border-border py-24 bg-bg-subtle/10">
      <div class="container max-w-3xl mx-auto">
        <CallToAction />
      </div>
    </section>
  </main>
</template>
