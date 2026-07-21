<script setup lang="ts">
import { NoodleGifDayGifLetter } from '#components'

type GifLetter = {
  value: string
  url: string
  backgroundPosition?: string
  backgroundSize?: string
}
const letters: GifLetter[] = [
  {
    value: './',
    url: 'https://media1.tenor.com/m/vOfmcVd-haMAAAAC/code-purpose-of-life.gif',
    backgroundSize: '170%',
  },
  {
    value: 'n',
    url: 'https://media1.tenor.com/m/VFDevE2qwdcAAAAC/good-morning.gif',
    backgroundSize: '170%',
  },
  {
    value: 'p',
    url: 'https://media1.tenor.com/m/8QP4JDPp85UAAAAC/kido.gif',
    backgroundSize: '180%',
    backgroundPosition: '70% 60%',
  },
  {
    value: 'm',
    url: 'https://media1.tenor.com/m/aN_HGmP-ZgAAAAAC/m.gif',
    backgroundPosition: '39% 120%',
    backgroundSize: '180%',
  },
  {
    value: 'x',
    url: 'https://media1.tenor.com/m/tslbzvMV878AAAAC/xmen-97-cyclops.gif',
    backgroundSize: '180%',
  },
]
</script>

<template>
  <div class="flex justify-center" aria-hidden="true">
    <NoodleGifDayGifLetter
      v-for="letter in letters"
      :key="letter.value"
      :letter="letter.value"
      :background-url="letter.url"
      :background-position="letter.backgroundPosition"
      :background-size="letter.backgroundSize"
    />
  </div>
</template>
