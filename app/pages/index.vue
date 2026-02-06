<script setup lang="ts">
import { SHOWCASED_FRAMEWORKS } from '~/utils/frameworks'

const searchQuery = shallowRef('')
async function handleSearchSubmit() {
  if (!searchQuery.value) {
    return
  }

  await navigateTo({
    name: 'search',
    query: { q: searchQuery.value },
  })
}

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
          class="text-fg-muted text-lg sm:text-xl max-w-md mb-12 lg:mb-14 motion-safe:animate-slide-up motion-safe:animate-fill-both"
          style="animation-delay: 0.1s"
        >
          {{ $t('tagline') }}
        </p>

        <SearchBox
          class="max-w-xl motion-safe:animate-slide-up motion-safe:animate-fill-both"
          style="animation-delay: 0.2s"
          v-model:search-query="searchQuery"
          @submit="handleSearchSubmit"
        />

        <BuildEnvironment class="mt-4" />
      </header>

      <nav
        :aria-label="$t('nav.popular_packages')"
        class="pt-4 pb-36 sm:pb-40 text-center motion-safe:animate-fade-in motion-safe:animate-fill-both"
        style="animation-delay: 0.3s"
      >
        <ul class="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 list-none m-0 p-0">
          <li v-for="framework in SHOWCASED_FRAMEWORKS" :key="framework.name">
            <NuxtLink
              :to="packageRoute(framework.package)"
              class="link-subtle font-mono text-sm inline-flex items-center gap-2 group"
            >
              <span
                class="w-1 h-1 rounded-full bg-accent group-hover:bg-fg transition-colors duration-200"
              />
              {{ framework.name }}
            </NuxtLink>
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
