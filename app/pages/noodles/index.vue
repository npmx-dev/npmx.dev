<script setup lang="ts">
import { noodles } from '~/noodles'

definePageMeta({
  name: 'noodles',
})

useSeoMeta({
  title: () => `${$t('noodles.title')} - npmx`,
  ogTitle: () => `${$t('noodles.title')} - npmx`,
  twitterTitle: () => `${$t('noodles.title')} - npmx`,
  description: () => $t('noodles.meta_description'),
  ogDescription: () => $t('noodles.meta_description'),
  twitterDescription: () => $t('noodles.meta_description'),
})

defineOgImage(
  'Page.takumi',
  {
    title: () => $t('noodles.title'),
    description: () => $t('noodles.meta_description'),
  },
  { alt: () => `${$t('noodles.title')} — npmx` },
)

const PAGE_SIZE = 10
const visibleCount = shallowRef(PAGE_SIZE)
const visibleNoodles = computed(() => noodles.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < noodles.length)
const remaining = computed(() => noodles.length - visibleCount.value)

function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, noodles.length)
}
</script>

<template>
  <main class="w-full flex-1 overflow-x-hidden">
    <section
      class="relative overflow-hidden border-b border-border-subtle py-10 sm:py-20 px-4 sm:px-6 mb-10 sm:mb-16"
    >
      <div
        class="absolute inset-0 [background-image:repeating-linear-gradient(115deg,rgb(0_0_0/0.04)_0_22px,transparent_22px_80px)] dark:[background-image:repeating-linear-gradient(115deg,rgb(0_0_0/0.35)_0_22px,transparent_22px_80px)]"
        aria-hidden="true"
      />
      <div class="relative max-w-4xl mx-auto flex flex-col items-center text-center">
        <div
          class="relative aspect-square w-60 sm:w-96 max-w-full flex items-center justify-center"
        >
          <div
            class="absolute inset-0 rounded-full overflow-hidden bg-bg-subtle border-[10px] sm:border-[14px] border-border [box-shadow:inset_0_0_50px_rgb(0_0_0/0.28),inset_0_2px_2px_rgb(255_255_255/0.9),0_20px_50px_-12px_rgb(0_0_0/0.3)] dark:[box-shadow:inset_0_0_60px_rgb(0_0_0/0.6),0_20px_50px_-10px_rgb(0_0_0/0.5)]"
            aria-hidden="true"
          >
            <ColorSchemeImg
              width="314"
              height="100"
              class="absolute bottom-0 inset-is-1/2 -translate-x-1/2 w-[88%] pointer-events-none select-none mix-blend-darken dark:mix-blend-lighten"
              dark-src="/extra/moon-dark.png"
              light-src="/extra/moon-light.png"
              alt=""
            />
          </div>
          <h1 class="relative font-mono text-3xl sm:text-6xl font-medium z-10">
            {{ $t('noodles.title') }}
          </h1>
        </div>
      </div>
    </section>

    <article class="max-w-5xl mx-auto pb-16 sm:pb-24 px-4 sm:px-6">
      <header class="mb-6">
        <h2 class="font-mono text-lg sm:text-xl font-semibold uppercase text-fg leading-none">
          {{ $t('noodles.latest') }}
        </h2>
      </header>
      <ul
        v-if="noodles.length > 0"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0"
      >
        <li v-for="noodle in visibleNoodles" :key="noodle.key">
          <NoodleListCard :noodle="noodle" />
        </li>
      </ul>
      <p v-else class="text-fg-subtle text-center py-20">
        {{ $t('noodles.empty') }}
      </p>

      <div v-if="hasMore" class="mt-8 flex justify-center">
        <ButtonBase type="button" variant="secondary" @click="loadMore">
          {{ $t('noodles.load_more', { count: Math.min(PAGE_SIZE, remaining) }) }}
        </ButtonBase>
      </div>

      <section class="mt-12 sm:mt-20">
        <h2
          class="font-mono text-lg sm:text-xl font-semibold uppercase text-fg leading-none mb-3 sm:mb-4"
        >
          {{ $t('noodles.what_is') }}
        </h2>
        <p class="text-fg-muted text-base leading-relaxed">
          {{ $t('noodles.what_is_body') }}
        </p>
      </section>
    </article>
  </main>
</template>
