<script setup lang="ts">
import type { ResolvedAuthor } from '#shared/schemas/blog'

const {
  title,
  authors = [],
  date = '',
} = defineProps<{
  title: string
  authors?: ResolvedAuthor[]
  date?: string
}>()

const formattedDate = computed(() => {
  if (!date) return ''
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
})

const MAX_VISIBLE_AUTHORS = 2

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map(part => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

const visibleAuthors = computed(() => {
  if (authors.length <= 3) return authors
  return authors.slice(0, MAX_VISIBLE_AUTHORS)
})

const extraCount = computed(() => {
  if (authors.length <= 3) return 0
  return authors.length - MAX_VISIBLE_AUTHORS
})

const formattedAuthorNames = computed(() => {
  const allNames = authors.map(a => a.name)
  if (allNames.length === 0) return ''
  if (allNames.length === 1) return allNames[0]
  if (allNames.length === 2) return `${allNames[0]} and ${allNames[1]}`
  if (allNames.length === 3) return `${allNames[0]}, ${allNames[1]}, and ${allNames[2]}`
  const shown = allNames.slice(0, MAX_VISIBLE_AUTHORS)
  const remaining = allNames.length - MAX_VISIBLE_AUTHORS
  return `${shown.join(', ')} and ${remaining} others`
})
</script>

<template>
  <OgLayout>
    <div class="px-15 py-12 flex flex-col justify-center gap-5 h-full">
      <OgBrand :height="48" />

      <!-- Date + Title -->
      <div class="flex flex-col gap-2">
        <span v-if="formattedDate" class="text-3xl text-fg-muted">
          {{ formattedDate }}
        </span>

        <div
          class="lg:text-6xl text-5xl tracking-tighter font-mono leading-tight"
          :style="{ lineClamp: 2, textOverflow: 'ellipsis' }"
        >
          {{ title }}
        </div>
      </div>

      <!-- Authors -->
      <div v-if="authors.length" class="flex items-center gap-4 flex-nowrap">
        <!-- Stacked avatars -->
        <span class="flex flex-row items-center">
          <span
            v-for="(author, index) in visibleAuthors"
            :key="author.name"
            class="flex items-center justify-center rounded-full border border-bg bg-bg-muted overflow-hidden w-12 h-12"
            :style="{ marginLeft: index > 0 ? '-20px' : '0' }"
          >
            <img
              v-if="author.avatar"
              :src="author.avatar"
              :alt="author.name"
              width="48"
              height="48"
              class="w-full h-full object-cover"
            />
            <span v-else class="text-5 text-fg-muted font-medium">
              {{ getInitials(author.name) }}
            </span>
          </span>
          <!-- +N badge -->
          <span
            v-if="extraCount > 0"
            class="flex items-center justify-center text-lg font-medium text-fg-muted rounded-full border border-bg bg-bg-muted overflow-hidden w-12 h-12"
            :style="{ marginLeft: '-20px' }"
          >
            +{{ extraCount }}
          </span>
        </span>
        <!-- Names -->
        <span class="text-6 text-fg-muted font-light">{{ formattedAuthorNames }}</span>
      </div>
    </div>
  </OgLayout>
</template>
