<template>
  <div class="relative flex w-full">
    <ThemedLogo v-if="colorMode.value === 'dark'" :emojiSets="darkTheme" />
    <ThemedLogo v-else :emojiSets="lightTheme" />
  </div>
</template>

<script setup lang="ts">
import ThemedLogo from './ThemedLogo.vue'
import red from './emojisets/red.png'
import blue from './emojisets/blue.png'
import faces from './emojisets/faces.png'
import gold from './emojisets/gold.png'
import hearts from './emojisets/hearts.png'
import green from './emojisets/green.png'
import earth from './emojisets/earth.png'
import light from './emojisets/themed-light.png'
import dark from './emojisets/themed-dark.png'

const colorMode = useColorMode()

const lightTheme = {
  red,
  blue,
  hearts,
  gold,
  faces,
  green,
  earth,
  themed: light,
}

const darkTheme = {
  ...lightTheme,
  themed: dark,
}
</script>
