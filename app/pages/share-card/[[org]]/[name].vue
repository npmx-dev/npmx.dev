<script setup lang="ts">
import { type AccentColorId, ACCENT_COLOR_TOKENS } from '#shared/utils/constants'

// This page exists only as a rendering target for nuxt-og-image.
// Visiting it directly redirects to the package page.

const route = useRoute('share-card-org-name')
const { org, name } = route.params
const packageName = org ? `${org}/${name}` : name
const theme = route.query.theme === 'light' ? 'light' : 'dark'
const colorParam = route.query.color
const color: AccentColorId =
  typeof colorParam === 'string' && colorParam in ACCENT_COLOR_TOKENS
    ? (colorParam as AccentColorId)
    : 'sky'

defineOgImageComponent(
  'ShareCard',
  { name: packageName, theme, color },
  { width: 1280, height: 520 },
)

onMounted(() => {
  navigateTo(`/package/${packageName}`, { replace: true })
})
</script>

<template>
  <div />
</template>
