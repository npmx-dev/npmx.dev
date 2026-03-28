<script setup lang="ts">
const {
  handle,
  displayName = '',
  description = '',
  avatar = '',
  packageCount = 0,
  orgCount = 0,
} = defineProps<{
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  packageCount?: number
  orgCount?: number
}>()

const getInitials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

const stats = computed(() => {
  const items: string[] = []
  if (packageCount > 0) items.push(`${packageCount} package${packageCount !== 1 ? 's' : ''}`)
  if (orgCount > 0) items.push(`${orgCount} org${orgCount !== 1 ? 's' : ''}`)
  return items.join(' · ')
})
</script>

<template>
  <OgLayout>
    <div class="px-15 py-12 flex flex-col justify-center gap-8 h-full">
      <OgBrand :height="48" />

      <div class="flex items-center gap-6">
        <!-- Avatar -->
        <span
          class="flex items-center justify-center rounded-full bg-bg-muted overflow-hidden shrink-0"
          :style="{ width: '96px', height: '96px' }"
        >
          <img
            v-if="avatar"
            :src="avatar"
            :alt="handle"
            width="96"
            height="96"
            class="w-full h-full object-cover"
          />
          <span v-else class="text-8 text-fg-muted font-medium">
            {{ getInitials(displayName || handle) }}
          </span>
        </span>

        <div class="flex flex-col gap-1">
          <!-- Display name -->
          <div v-if="displayName" class="text-5xl font-mono tracking-tight leading-none">
            {{ displayName }}
          </div>
          <!-- Handle -->
          <div class="text-4xl text-fg-muted font-mono tracking-tight leading-none">
            ~{{ handle }}
          </div>
        </div>
      </div>

      <!-- Description -->
      <div
        v-if="description"
        class="text-3xl text-fg-muted opacity-70"
        :style="{ lineClamp: 2, textOverflow: 'ellipsis' }"
      >
        {{ description }}
      </div>

      <!-- Stats -->
      <div v-if="stats" class="text-3xl text-fg-muted">
        {{ stats }}
      </div>
    </div>
  </OgLayout>
</template>
