<script setup lang="ts">
/**
 * refer to DateTime
 */
defineProps<{
  datetime: string | Date | number
  title?: string
  dateStyle?: 'full' | 'long' | 'medium' | 'short'
  year?: 'numeric' | '2-digit'
  month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
  day?: 'numeric' | '2-digit'
}>()

const { relativeDates, toggleRelativeDates } = useRelativeDates()
</script>

<template>
  <button type="button" :aria-pressed="relativeDates" @click="toggleRelativeDates">
    <DateTime
      :datetime="datetime"
      :title="title"
      :date-style="dateStyle"
      :year="year"
      :month="month"
      :day="day"
    />
  </button>
</template>
