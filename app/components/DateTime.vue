<script lang="ts">
const titleFormatters = new Map<string, Intl.DateTimeFormat>()

function getTitleFormatter(locale: string, timeZone?: 'UTC') {
  const key = `${locale}|${timeZone}`
  let formatter = titleFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone,
    })
    titleFormatters.set(key, formatter)
  }
  return formatter
}
</script>

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

const { locale } = useI18n()

const relativeDates = useRelativeDates()
const isMounted = useMounted()

// Compute the title - always show full date for accessibility
const titleValue = computed(() => {
  if (props.title) return props.title
  const date = typeof props.datetime === 'string' ? new Date(props.datetime) : props.datetime
  // Formatted in UTC until mounted so the hydrated title matches the server-rendered one
  return getTitleFormatter(locale.value, isMounted.value ? undefined : 'UTC').format(date)
})
</script>

<template>
  <span>
    <NuxtTime
      :datetime="datetime"
      :title="titleValue"
      :relative="relativeDates"
      :date-style="relativeDates ? undefined : dateStyle"
      :year="relativeDates ? undefined : year"
      :month="relativeDates ? undefined : month"
      :day="relativeDates ? undefined : day"
      :locale="locale"
      data-settings-time
    />
  </span>
</template>
