<script setup lang="ts">
import type { EventDetail } from '~/types/events'
import { formatEventDateRange, isPastEvent } from '~/utils/events/format'

const route = useRoute()
const { locale } = useI18n()
const slug = computed(() => String(route.params.slug))

const { data: events } = await useFetch<EventDetail[]>('/api/events', {
  key: 'events',
  default: () => [],
})

const event = computed(() => events.value.find(e => e.slug === slug.value))
const isPast = computed(() => (event.value ? isPastEvent(event.value) : false))

const related = computed(() => {
  const current = event.value
  if (!current) return []
  return events.value.filter(e => e.slug !== current.slug && e.kind === current.kind).slice(0, 3)
})

function flag404() {
  const reqEvent = useRequestEvent()
  if (reqEvent) setResponseStatus(reqEvent, 404)
}
if (import.meta.server && !event.value) flag404()
onMounted(() => {
  if (!event.value) flag404()
})
const dateLabel = computed(() =>
  event.value ? formatEventDateRange(event.value.startsAt, event.value.endsAt, locale.value) : '',
)
const modeLabel = computed(() => {
  if (event.value?.mode === 'virtual') return $t('events.mode.online')
  if (event.value?.mode === 'hybrid') return $t('events.mode.hybrid')
  return $t('events.mode.in_person')
})
const locationLabel = computed(() => event.value?.location?.name || event.value?.location?.locality)
const mapUrl = computed(() => {
  const loc = event.value?.location
  if (!loc) return undefined
  if (loc.lat && loc.lon)
    return `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lon}#map=13/${loc.lat}/${loc.lon}`
  const q = encodeURIComponent([loc.name, loc.locality, loc.country].filter(Boolean).join(', '))
  return `https://www.openstreetmap.org/search?query=${q}`
})

useSeoMeta({
  title: () => `${event.value?.name ?? $t('events.missing.title')} - npmx`,
  ogTitle: () => `${event.value?.name ?? $t('events.missing.title')} - npmx`,
  description: () => event.value?.description ?? $t('events.missing.body', { slug: slug.value }),
  ogDescription: () => event.value?.description,
})
</script>

<template>
  <main v-if="event" class="container flex-1 py-12 sm:py-16 w-full">
    <NuxtLink
      :to="{ name: 'events' }"
      class="inline-flex items-center gap-1 font-mono text-sm text-fg-muted hover:text-fg"
    >
      <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
      {{ $t('events.back') }}
    </NuxtLink>

    <div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div class="min-w-0">
        <h1 class="font-mono text-2xl text-fg">{{ event.name }}</h1>

        <div
          class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-sm text-fg-muted"
        >
          <span class="inline-flex items-center gap-1">
            <span class="i-lucide:calendar w-4 h-4" aria-hidden="true" />
            {{ dateLabel }}
          </span>
          <span v-if="locationLabel" class="inline-flex items-center gap-1">
            <span class="i-lucide:map-pin w-4 h-4" aria-hidden="true" />
            {{ locationLabel }}
          </span>
        </div>

        <div
          v-if="event.descriptionHtml"
          class="mt-4 prose dark:prose-invert max-w-none"
          v-html="event.descriptionHtml"
        />
        <p v-else-if="event.description" class="mt-4 text-fg-subtle leading-relaxed">
          {{ event.description }}
        </p>

        <section v-if="event.schedule?.length" class="mt-10">
          <h2 class="font-mono text-fg-muted uppercase text-sm mb-3">{{ $t('events.about') }}</h2>
          <ul class="flex flex-col gap-1 font-mono text-sm">
            <li v-for="item in event.schedule" :key="item.time" class="flex gap-3">
              <span class="text-fg-muted tabular-nums">{{ item.time }}</span>
              <span class="text-fg">{{ item.label }}</span>
            </li>
          </ul>
        </section>

        <section v-if="event.links.length" class="mt-6 flex flex-wrap gap-3">
          <LinkBase
            v-for="link in event.links"
            :key="link.uri"
            :to="link.uri"
            variant="link"
            class="font-mono text-sm text-accent"
          >
            {{ link.name || link.uri }}
          </LinkBase>
        </section>

        <section v-if="locationLabel" class="mt-10">
          <h2 class="font-mono text-fg-muted uppercase text-sm mb-3">
            {{ $t('events.location') }}
          </h2>
          <LinkBase
            :to="mapUrl"
            variant="link"
            class="inline-flex items-center gap-2 font-mono text-sm text-fg hover:text-accent"
          >
            <span class="i-lucide:map-pin w-4 h-4" aria-hidden="true" />
            {{ locationLabel }}
          </LinkBase>
        </section>

        <section v-if="event.talks.length" class="mt-10">
          <h2 class="font-mono text-fg-muted uppercase text-sm mb-2">{{ $t('events.talks') }}</h2>
          <div class="divide-y divide-border">
            <EventsTalkRow v-for="talk in event.talks" :key="talk.id" :talk="talk" />
          </div>
        </section>

        <section v-if="event.gallery?.length" class="mt-10">
          <h2 class="font-mono text-fg-muted uppercase text-sm mb-3">{{ $t('events.gallery') }}</h2>
          <EventsGallery :images="event.gallery" />
        </section>

        <section v-if="event.bskyPostUrl" class="mt-10">
          <h2 class="font-mono text-fg-muted uppercase text-sm mb-3">{{ $t('events.social') }}</h2>
          <BlueskyPostEmbed :url="event.bskyPostUrl" />
        </section>

        <section v-if="related.length" class="mt-12">
          <h2 class="font-mono text-fg-muted uppercase text-sm mb-4">{{ $t('events.related') }}</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <EventsCard v-for="rel in related" :key="rel.slug" :event="rel" />
          </div>
        </section>
      </div>

      <aside class="flex flex-col gap-6">
        <div class="flex flex-wrap gap-2">
          <span class="font-mono text-xs px-2 py-1 rounded-md border border-border text-fg-muted">
            {{ modeLabel }}
          </span>
          <span class="font-mono text-xs px-2 py-1 rounded-md border border-border text-fg-muted">
            {{ $t(`events.kind.${event.kind}`) }}
          </span>
        </div>

        <div v-if="event.attendeeCount">
          <h2 class="font-mono text-fg-muted uppercase text-sm mb-3">
            {{ $t('events.attending') }}
          </h2>
          <div class="flex flex-wrap gap-1.5">
            <template v-for="a in event.attendees" :key="a.handle || a.name">
              <img
                v-if="a.avatar"
                :src="a.avatar"
                :alt="a.name"
                :title="a.name"
                loading="lazy"
                class="w-8 h-8 rounded-full border border-border object-cover bg-bg-elevated"
              />
              <span
                v-else
                class="inline-flex items-center justify-center w-8 h-8 rounded-full border border-border bg-bg-elevated text-xs font-mono text-fg-muted"
                :title="a.name"
              >
                {{ a.name.charAt(0) }}
              </span>
            </template>
            <span
              v-if="event.attendeeCount > event.attendees.length"
              class="inline-flex items-center justify-center w-8 h-8 rounded-full border border-border bg-bg-elevated text-xs font-mono text-fg-subtle"
            >
              +{{ event.attendeeCount - event.attendees.length }}
            </span>
          </div>
        </div>

        <div v-if="event.hosts.length">
          <h2 class="font-mono text-fg-muted uppercase text-sm mb-2">
            {{ $t('events.hosted_by') }}
          </h2>
          <ul class="flex flex-col gap-1 font-mono text-sm">
            <li v-for="host in event.hosts" :key="host.name">
              <LinkBase v-if="host.uri" :to="host.uri" variant="link" class="text-fg">
                {{ host.name }}
              </LinkBase>
              <span v-else class="text-fg">{{ host.name }}</span>
            </li>
          </ul>
        </div>

        <LinkBase
          v-if="event.registerUrl && !isPast"
          :to="event.registerUrl"
          variant="button-primary"
          class="justify-center"
        >
          {{ $t('events.register') }}
        </LinkBase>
      </aside>
    </div>
  </main>

  <main v-else class="container flex-1 py-12 sm:py-16 w-full">
    <div class="max-w-xl mx-auto text-center">
      <p class="font-mono text-xs tracking-widest uppercase text-fg-subtle mb-3">
        404 — {{ $t('events.missing.label') }}
      </p>
      <h1 class="font-mono text-3xl sm:text-4xl font-medium tracking-tight mb-4">
        {{ $t('events.missing.title') }}
      </h1>
      <p class="text-fg-muted text-base sm:text-lg leading-relaxed mb-8">
        {{ $t('events.missing.body', { slug }) }}
      </p>
      <LinkBase :to="{ name: 'events' }" variant="button-primary" class="justify-center">
        <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
        {{ $t('events.back') }}
      </LinkBase>
    </div>
  </main>
</template>

<style scoped>
:deep(.prose a) {
  @apply font-mono text-fg underline underline-offset-[0.2rem] decoration-1 decoration-fg/30 transition-colors duration-200;
}

:deep(.prose a:hover),
:deep(.prose a:focus-visible) {
  @apply text-accent decoration-accent;
}

:deep(.prose hr) {
  display: none;
}
</style>
