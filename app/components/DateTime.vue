<script setup lang="ts">
/**
 * DateTime component that wraps NuxtTime with settings-aware relative date support.
 * Uses the global settings to determine whether to show relative or absolute dates.
 *
 * Note: When relativeDates setting is enabled, the component switches between
 * relative and absolute display based on user preference. The title attribute
 * always shows the full date for accessibility.
 */
const props = withDefaults(
  defineProps<{
    /** The datetime value (ISO string or Date) */
    datetime: string | Date
    /** Override title (defaults to datetime) */
    title?: string
    /** Date style for absolute display */
    dateStyle?: 'full' | 'long' | 'medium' | 'short'
    /** Individual date parts for absolute display (alternative to dateStyle) */
    year?: 'numeric' | '2-digit'
    month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
    day?: 'numeric' | '2-digit'
  }>(),
  {
    title: undefined,
    dateStyle: undefined,
    year: undefined,
    month: undefined,
    day: undefined,
  },
)

const relativeDates = useRelativeDates()

// Compute the title - always show full date for accessibility
const titleValue = computed(() => {
  if (props.title) return props.title
  if (typeof props.datetime === 'string') return props.datetime
  return props.datetime.toISOString()
})
</script>

<template>
  <ClientOnly>
    <NuxtTime v-if="relativeDates" :datetime="datetime" :title="titleValue" relative />
    <NuxtTime
      v-else
      :datetime="datetime"
      :title="titleValue"
      :date-style="dateStyle"
      :year="year"
      :month="month"
      :day="day"
    />
    <template #fallback>
      <NuxtTime
        :datetime="datetime"
        :title="titleValue"
        :date-style="dateStyle"
        :year="year"
        :month="month"
        :day="day"
      />
    </template>
  </ClientOnly>
</template>
