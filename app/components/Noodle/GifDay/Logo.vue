<script setup lang="ts">
import { NoodleGifDayGifLetter } from '#components'

type GifLetter = {
  value: string
  url: string
}
const letters: GifLetter[] = [
  { value: 'n', url: 'https://c.tenor.com/VFDevE2qwdcAAAAC/tenor.gif' },
  { value: 'p', url: 'https://c.tenor.com/k4UX72S-xEwAAAAC/tenor.gif' },
  { value: 'm', url: 'https://c.tenor.com/aN_HGmP-ZgAAAAAC/tenor.gif' },
  { value: 'x', url: 'https://c.tenor.com/tslbzvMV878AAAAd/tenor.gif' },
]
</script>

<template>
  <div class="flex justify-center" aria-hidden="true">
    <NoodleGifDayGifLetter
      v-for="letter in letters"
      :key="letter.value"
      :letter="letter.value"
      :background-url="letter.url"
    />
  </div>
</template>
