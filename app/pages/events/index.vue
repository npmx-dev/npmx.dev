<script setup lang="ts">
import type { EventKind } from '~/types/events'

const { upcoming, past, kinds } = useEvents()

const activeKind = ref<EventKind | null>(null)

function toggleKind(kind: EventKind) {
  activeKind.value = activeKind.value === kind ? null : kind
}

const filteredUpcoming = computed(() =>
  activeKind.value ? upcoming.value.filter(e => e.kind === activeKind.value) : upcoming.value,
)
const filteredPast = computed(() =>
  activeKind.value ? past.value.filter(e => e.kind === activeKind.value) : past.value,
)

useSeoMeta({
  title: () => `${$t('events.title')} - npmx`,
  ogTitle: () => `${$t('events.title')} - npmx`,
  description: () => $t('events.meta_description'),
  ogDescription: () => $t('events.meta_description'),
})

defineOgImage(
  'Page.takumi',
  { title: 'events', description: 'npmx community events, meetups and talks.' },
  { alt: 'npmx events' },
)
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16">
    <header class="mb-12">
      <div class="flex items-baseline justify-between gap-4 mb-4">
        <h1 class="font-mono text-3xl sm:text-4xl font-medium">{{ $t('events.title') }}</h1>
        <BackButton />
      </div>
      <p class="text-fg-muted text-lg leading-relaxed max-w-2xl">{{ $t('events.intro') }}</p>
    </header>

    <div v-if="kinds.length > 1" class="mt-8 flex flex-wrap gap-2">
      <button
        type="button"
        class="font-mono text-sm px-3 py-1 rounded-md border transition-colors duration-200"
        :class="
          activeKind === null
            ? 'border-accent text-accent'
            : 'border-border text-fg-muted hover:text-fg'
        "
        @click="activeKind = null"
      >
        {{ $t('events.filter_all') }}
      </button>
      <button
        v-for="kind in kinds"
        :key="kind"
        type="button"
        class="font-mono text-sm px-3 py-1 rounded-md border transition-colors duration-200"
        :class="
          activeKind === kind
            ? 'border-accent text-accent'
            : 'border-border text-fg-muted hover:text-fg'
        "
        :aria-pressed="activeKind === kind"
        @click="toggleKind(kind)"
      >
        {{ $t(`events.kind.${kind}`) }}
      </button>
    </div>

    <section v-if="filteredUpcoming.length" class="mt-10">
      <h2 class="font-mono text-fg-muted uppercase text-sm mb-4">{{ $t('events.upcoming') }}</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <EventsCard v-for="event in filteredUpcoming" :key="event.slug" :event="event" />
      </div>
    </section>

    <section v-if="filteredPast.length" class="mt-10">
      <h2 class="font-mono text-fg-muted uppercase text-sm mb-4">{{ $t('events.past') }}</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <EventsCard v-for="event in filteredPast" :key="event.slug" :event="event" />
      </div>
    </section>

    <p
      v-if="!filteredUpcoming.length && !filteredPast.length"
      class="mt-10 font-mono text-fg-subtle"
    >
      {{ $t('events.empty') }}
    </p>
  </main>
</template>
