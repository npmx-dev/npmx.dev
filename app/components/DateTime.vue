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
    /** The datetime value (ISO string or Date or timestamp) */
    datetime: string | Date | number
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

const { locale } = useI18n()

const { relativeDates, toggleRelativeDates } = useRelativeDates()

const dateFormatter = new Intl.DateTimeFormat(locale.value, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

// Compute the title - always show full date for accessibility
const titleValue = computed(() => {
  if (props.title) return props.title
  const date = typeof props.datetime === 'string' ? new Date(props.datetime) : props.datetime
  return dateFormatter.format(date)
})
</script>

<template>
  <button type="button" @click="toggleRelativeDates">
    <ClientOnly>
      <NuxtTime
        v-if="relativeDates"
        :datetime="datetime"
        :title="titleValue"
        relative
        :locale="locale"
      />
      <NuxtTime
        v-else
        :datetime="datetime"
        :title="titleValue"
        :date-style="dateStyle"
        :year="year"
        :month="month"
        :day="day"
        :locale="locale"
      />
      <template #fallback>
        <NuxtTime
          :datetime="datetime"
          :title="titleValue"
          :date-style="dateStyle"
          :year="year"
          :month="month"
          :day="day"
          :locale="locale"
        />
      </template>
    </ClientOnly>
  </button>
</template>
