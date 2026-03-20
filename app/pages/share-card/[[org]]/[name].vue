<script setup lang="ts">
import { ACCENT_COLOR_IDS, type AccentColorId } from '#shared/utils/constants'

// This page exists only as a rendering target for nuxt-og-image.
// Visiting it directly redirects to the package page.

// Hex equivalents of ACCENT_COLORS for satori (which doesn't support oklch).
// These approximate the oklch values visually.
const ACCENT_HEX: Record<'light' | 'dark', Record<AccentColorId, string>> = {
  dark: {
    sky: '#5bc4e0',
    coral: '#f07858',
    amber: '#f0c040',
    emerald: '#40d088',
    violet: '#9880e8',
    magenta: '#d878c0',
    neutral: '#ffffff',
  },
  light: {
    sky: '#2870c0',
    coral: '#c04030',
    amber: '#b07020',
    emerald: '#208060',
    violet: '#7050b8',
    magenta: '#a040a0',
    neutral: '#1a1a1a',
  },
}

const route = useRoute()
const org = (route.params as any).org as string | undefined
const name = (route.params as any).name as string
const packageName = org ? `${org}/${name}` : name
const theme = route.query.theme === 'light' ? 'light' : 'dark'
const colorParam = route.query.color as string | undefined
const color: AccentColorId = ACCENT_COLOR_IDS.includes(colorParam as AccentColorId)
  ? (colorParam as AccentColorId)
  : 'sky'

const primaryColor = ACCENT_HEX[theme][color]

defineOgImageComponent(
  'ShareCard',
  { name: packageName, theme, primaryColor },
  { width: 1400, height: 480 },
)

onMounted(() => {
  navigateTo(`/package/${packageName}`, { replace: true })
})
</script>

<template>
  <div />
</template>
