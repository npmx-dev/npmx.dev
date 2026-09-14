<script setup lang="ts">
definePageMeta({
  name: 'tools',
})

const { t } = useI18n()

const tools = computed(() => [
  {
    id: 'deps-stats',
    name: t('tools.deps_stats.name'),
    description: t('tools.deps_stats.description'),
    to: { name: 'tools-deps-stats' } as const,
  },
])

useSeoMeta({
  title: () => t('tools.meta_title'),
  ogTitle: () => t('tools.meta_title'),
  twitterTitle: () => t('tools.meta_title'),
  description: () => t('tools.meta_description'),
  ogDescription: () => t('tools.meta_description'),
  twitterDescription: () => t('tools.meta_description'),
})

defineOgImage(
  'Page.takumi',
  {
    title: () => t('tools.title'),
    description: () => t('tools.tagline'),
  },
  { alt: () => t('tools.title') },
)
</script>

<template>
  <main class="container flex-1 py-8 sm:py-12 w-full">
    <header class="mb-8 sm:mb-10">
      <div class="flex items-baseline justify-between gap-4 mb-3">
        <h1 class="font-mono text-3xl sm:text-4xl font-medium">
          {{ $t('tools.title') }}
        </h1>
        <BackButton />
      </div>
      <p class="text-fg-muted text-lg max-w-2xl">
        {{ $t('tools.tagline') }}
      </p>
    </header>

    <ul class="list-none m-0 p-0 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
      <li v-for="tool in tools" :key="tool.id">
        <NuxtLink
          :to="tool.to"
          class="block p-4 rounded-lg border border-border hover:border-border-hover hover:bg-bg-subtle transition-colors duration-200 h-full"
        >
          <span class="block font-mono text-lg text-fg">{{ tool.name }}</span>
          <span class="block text-sm text-fg-muted leading-relaxed mt-2">{{
            tool.description
          }}</span>
        </NuxtLink>
      </li>
    </ul>
  </main>
</template>
