<script setup lang="ts">
import type { EventSummary } from '~/types/events'
import { formatEventDateRange } from '~/utils/events/format'

const { event } = defineProps<{ event: EventSummary }>()

const { locale } = useI18n()
const dateLabel = computed(() => formatEventDateRange(event.startsAt, event.endsAt, locale.value))

const modeLabel = computed(() => {
  if (event.mode === 'virtual') return $t('events.mode.online')
  if (event.mode === 'hybrid') return $t('events.mode.hybrid')
  return $t('events.mode.in_person')
})

const locationLabel = computed(() => event.location?.name || event.location?.locality)
const shownAttendees = computed(() => event.attendees.slice(0, 5))
const overflow = computed(() => Math.max(0, event.attendeeCount - shownAttendees.value.length))
</script>

<template>
  <NuxtLink
    :to="{ name: 'events-slug', params: { slug: event.slug } }"
    class="group flex flex-col rounded-lg border border-border bg-bg-subtle overflow-hidden transition-colors duration-200 hover:border-fg-subtle"
  >
    <div class="relative aspect-[16/6] overflow-hidden bg-bg-elevated">
      <img
        v-if="event.cover"
        :src="event.cover"
        :alt="event.name"
        class="h-full w-full object-cover"
        loading="lazy"
      />
      <div
        v-else
        class="h-full w-full bg-gradient-to-br from-accent/25 via-bg-elevated to-bg-subtle"
        aria-hidden="true"
      />
      <span
        class="absolute inset-ie-3 inset-bs-3 font-mono text-xs px-2 py-1 rounded-md bg-bg/80 backdrop-blur text-fg-muted"
      >
        {{ modeLabel }}
      </span>
    </div>

    <div class="flex flex-col gap-3 p-4">
      <div class="flex items-start justify-between gap-3">
        <h3
          class="font-mono text-fg text-lg leading-tight group-hover:text-accent transition-colors"
        >
          {{ event.name }}
        </h3>
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-sm text-fg-muted">
        <span>{{ dateLabel }}</span>
        <span v-if="locationLabel" class="inline-flex items-center gap-1">
          <span class="i-lucide:map-pin w-3.5 h-3.5" aria-hidden="true" />
          {{ locationLabel }}
        </span>
      </div>

      <p v-if="event.description" class="text-sm text-fg-subtle line-clamp-2">
        {{ event.description }}
      </p>

      <div v-if="event.attendeeCount" class="flex items-center gap-2">
        <div class="flex -space-i-2">
          <template v-for="a in shownAttendees" :key="a.handle || a.name">
            <img
              v-if="a.avatar"
              :src="a.avatar"
              :alt="a.name"
              :title="a.name"
              loading="lazy"
              class="w-6 h-6 rounded-full border border-border object-cover bg-bg-elevated"
            />
            <span
              v-else
              class="inline-flex items-center justify-center w-6 h-6 rounded-full border border-border bg-bg-elevated text-[0.6rem] font-mono text-fg-muted"
              :title="a.name"
            >
              {{ a.name.charAt(0) }}
            </span>
          </template>
        </div>
        <span v-if="overflow" class="font-mono text-xs text-fg-subtle">+{{ overflow }}</span>
      </div>

      <div v-if="event.tags.length" class="flex flex-wrap gap-1.5">
        <span
          v-for="tag in event.tags"
          :key="tag"
          class="font-mono text-xs text-fg-subtle px-2 py-0.5 rounded bg-bg-elevated"
        >
          {{ tag }}
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
