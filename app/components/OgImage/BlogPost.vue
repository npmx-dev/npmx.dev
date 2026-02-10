<script setup lang="ts">
import type { Author } from '#shared/schemas/blog'

const props = withDefaults(
  defineProps<{
    title: string
    authors?: Author[]
    date?: string
    primaryColor?: string
  }>(),
  {
    authors: () => [],
    date: '',
    primaryColor: '#60a5fa',
  },
)

const { resolvedAuthors } = useBlueskyAuthorProfiles(props.authors)

const formattedDate = computed(() => {
  if (!props.date) return ''
  try {
    return new Date(props.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return props.date
  }
})

const MAX_VISIBLE_AUTHORS = 2

const getInitials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

const visibleAuthors = computed(() => {
  if (resolvedAuthors.value.length <= 3) return resolvedAuthors.value
  return resolvedAuthors.value.slice(0, MAX_VISIBLE_AUTHORS)
})

const extraCount = computed(() => {
  if (resolvedAuthors.value.length <= 3) return 0
  return resolvedAuthors.value.length - MAX_VISIBLE_AUTHORS
})

const formattedAuthorNames = computed(() => {
  const allNames = resolvedAuthors.value.map(a => a.name)
  if (allNames.length === 0) return ''
  if (allNames.length === 1) return allNames[0]
  if (allNames.length === 2) return `${allNames[0]} and ${allNames[1]}`
  if (allNames.length === 3) return `${allNames[0]}, ${allNames[1]}, and ${allNames[2]}`
  // More than 3: show first 2 + others
  const shown = allNames.slice(0, MAX_VISIBLE_AUTHORS)
  const remaining = allNames.length - MAX_VISIBLE_AUTHORS
  return `${shown.join(', ')} and ${remaining} others`
})
</script>

<template>
  <div
    class="h-full w-full flex flex-col justify-center px-20 bg-[#050505] text-[#fafafa] relative overflow-hidden"
  >
    <!-- npmx logo - top right -->
    <div
      class="absolute top-12 z-10 flex items-center gap-1 text-5xl font-bold tracking-tight"
      style="font-family: 'Geist Sans', sans-serif; right: 4rem"
    >
      <span :style="{ color: primaryColor }" class="opacity-80">./</span>
      <span class="text-white">npmx</span>
    </div>

    <div class="relative z-10 flex flex-col gap-2">
      <!-- Date -->
      <span
        v-if="formattedDate"
        class="text-3xl text-[#a3a3a3] font-light"
        style="font-family: 'Geist Sans', sans-serif"
      >
        {{ formattedDate }}
      </span>

      <!-- Blog title -->
      <h1
        class="text-6xl font-semibold tracking-tight leading-snug w-9/10"
        style="font-family: 'Geist Sans', sans-serif; letter-spacing: -0.03em"
      >
        {{ title }}
      </h1>

      <!-- Authors -->
      <div
        v-if="resolvedAuthors.length"
        class="flex items-center gap-4 self-start justify-start flex-nowrap"
        style="font-family: 'Geist Sans', sans-serif"
      >
        <!-- Stacked avatars -->
        <span>
          <span
            v-for="(author, index) in visibleAuthors"
            :key="author.name"
            class="flex items-center justify-center rounded-full border border-[#050505] bg-[#1a1a1a] overflow-hidden w-12 h-12"
            :style="{ marginLeft: index > 0 ? '-20px' : '0' }"
          >
            <img
              v-if="author.avatar"
              :src="author.avatar"
              :alt="author.name"
              class="w-full h-full object-cover"
            />
            <span v-else style="font-size: 20px; color: #666; font-weight: 500">
              {{ getInitials(author.name) }}
            </span>
          </span>
          <!-- +N badge -->
          <span
            v-if="extraCount > 0"
            class="flex items-center justify-center text-lg font-medium text-[#a3a3a3] rounded-full border border-[#050505] bg-[#262626] overflow-hidden w-12 h-12"
            :style="{ marginLeft: '-20px' }"
          >
            +{{ extraCount }}
          </span>
        </span>
        <!-- Names -->
        <span style="font-size: 24px; color: #a3a3a3; font-weight: 300">{{
          formattedAuthorNames
        }}</span>
      </div>
    </div>

    <div
      class="absolute -top-32 -inset-ie-32 w-[550px] h-[550px] rounded-full blur-3xl"
      :style="{ backgroundColor: primaryColor + '10' }"
    />
  </div>
</template>
