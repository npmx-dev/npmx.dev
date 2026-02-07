<script setup lang="ts">
interface NuxtTimeProps {
  datetime: string | number | Date
  localeMatcher?: 'best fit' | 'lookup'
  weekday?: 'long' | 'short' | 'narrow'
  era?: 'long' | 'short' | 'narrow'
  year?: 'numeric' | '2-digit'
  month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
  day?: 'numeric' | '2-digit'
  hour?: 'numeric' | '2-digit'
  minute?: 'numeric' | '2-digit'
  second?: 'numeric' | '2-digit'
  timeZoneName?: 'short' | 'long' | 'shortOffset' | 'longOffset' | 'shortGeneric' | 'longGeneric'
  formatMatcher?: 'best fit' | 'basic'
  hour12?: boolean
  timeZone?: string

  calendar?: string
  dayPeriod?: 'narrow' | 'short' | 'long'
  numberingSystem?: string

  dateStyle?: 'full' | 'long' | 'medium' | 'short'
  timeStyle?: 'full' | 'long' | 'medium' | 'short'
  hourCycle?: 'h11' | 'h12' | 'h23' | 'h24'

  numeric?: 'always' | 'auto'
  relativeStyle?: 'long' | 'short' | 'narrow'
}

const props = withDefaults(defineProps<NuxtTimeProps>(), {
  hour12: undefined,
})

const el = getCurrentInstance()?.vnode.el
const renderedDate = el?.getAttribute('datetime')
const _locale = el?.getAttribute('data-locale')

const nuxtApp = useNuxtApp()

const date = computed(() => {
  const date = props.datetime
  if (renderedDate && nuxtApp.isHydrating) {
    return new Date(renderedDate)
  }
  if (!props.datetime) {
    return new Date()
  }
  return new Date(date)
})

const now = ref(
  import.meta.client && nuxtApp.isHydrating && window._nuxtTimeNow
    ? new Date(window._nuxtTimeNow)
    : new Date(),
)

const relativeDates = useRelativeDates()

if (import.meta.client && relativeDates.value) {
  const handler = () => {
    now.value = new Date()
  }
  const interval = setInterval(handler, 1000)
  onBeforeUnmount(() => clearInterval(interval))
}

const { locale } = useI18n()
const defaults = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
}

const formatter = computed(() => {
  const { relativeStyle, ...rest } = props
  if (relativeDates.value) {
    return new Intl.RelativeTimeFormat(_locale ?? locale.value, {
      ...defaults,
      ...rest,
      style: relativeStyle,
    })
  }
  return new Intl.DateTimeFormat(_locale ?? locale.value, { ...defaults, ...rest })
})

const formattedDate = computed(() => {
  if (!relativeDates.value) {
    return (formatter.value as Intl.DateTimeFormat).format(date.value)
  }

  const diffInSeconds = (date.value.getTime() - now.value.getTime()) / 1000

  const units: Array<{
    unit: Intl.RelativeTimeFormatUnit
    seconds: number
    threshold: number
  }> = [
    { unit: 'second', seconds: 1, threshold: 60 }, // 60 seconds → minute
    { unit: 'minute', seconds: 60, threshold: 60 }, // 60 minutes → hour
    { unit: 'hour', seconds: 3600, threshold: 24 }, // 24 hours → day
    { unit: 'day', seconds: 86400, threshold: 30 }, // ~30 days → month
    { unit: 'month', seconds: 2592000, threshold: 12 }, // 12 months → year
    { unit: 'year', seconds: 31536000, threshold: Infinity },
  ]

  const { unit, seconds } =
    units.find(({ seconds, threshold }) => Math.abs(diffInSeconds / seconds) < threshold) ||
    units[units.length - 1]!

  const value = diffInSeconds / seconds
  return (formatter.value as Intl.RelativeTimeFormat).format(Math.round(value), unit)
})

const isoDate = computed(() => date.value.toISOString())
const dataset: Record<string, string | number | boolean | Date | undefined> = {}

if (import.meta.server) {
  for (const prop in props) {
    if (prop !== 'datetime') {
      const value = props?.[prop as keyof typeof props]
      if (value) {
        const propInKebabCase = prop.split(/(?=[A-Z])/).join('-')
        dataset[`data-${propInKebabCase}`] = props?.[prop as keyof typeof props]
      }
    }
  }
  onPrehydrate(el => {
    const now = (window._nuxtTimeNow ||= Date.now())
    const toCamelCase = (name: string, index: number) => {
      if (index > 0) {
        return name[0]!.toUpperCase() + name.slice(1)
      }
      return name
    }

    const date = new Date(el.getAttribute('datetime')!)
    el.title = date.toISOString()

    const options: Intl.DateTimeFormatOptions &
      Intl.RelativeTimeFormatOptions & { locale?: Intl.LocalesArgument; relative?: boolean } = {}
    for (const name of el.getAttributeNames()) {
      if (name.startsWith('data-')) {
        let optionName = name
          .slice(5)
          .split('-')
          .map(toCamelCase)
          .join('') as keyof (Intl.DateTimeFormatOptions & Intl.RelativeTimeFormatOptions)

        if ((optionName as string) === 'relativeStyle') {
          optionName = 'style'
        }

        options[optionName] = el.getAttribute(name) as any
      }
    }

    const settings = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
    const relative = settings.relativeDates
    const locale = settings.selectedLocale

    if (relative) {
      const diffInSeconds = (date.getTime() - now) / 1000
      const units: Array<{
        unit: Intl.RelativeTimeFormatUnit
        seconds: number
        threshold: number
      }> = [
        { unit: 'second', seconds: 1, threshold: 60 }, // 60 seconds → minute
        { unit: 'minute', seconds: 60, threshold: 60 }, // 60 minutes → hour
        { unit: 'hour', seconds: 3600, threshold: 24 }, // 24 hours → day
        { unit: 'day', seconds: 86400, threshold: 30 }, // ~30 days → month
        { unit: 'month', seconds: 2592000, threshold: 12 }, // 12 months → year
        { unit: 'year', seconds: 31536000, threshold: Infinity },
      ]
      const { unit, seconds } =
        units.find(({ seconds, threshold }) => Math.abs(diffInSeconds / seconds) < threshold) ||
        units[units.length - 1]!
      const value = diffInSeconds / seconds
      const formatter = new Intl.RelativeTimeFormat(locale, options)
      el.textContent = formatter.format(Math.round(value), unit)
    } else {
      const formatter = new Intl.DateTimeFormat(locale, options)
      el.textContent = formatter.format(date)
    }
  })
}

declare global {
  interface Window {
    _nuxtTimeNow?: number
  }
}
</script>

<template>
  <time v-bind="dataset" :datetime="isoDate" :title="isoDate">{{ formattedDate }}</time>
</template>
