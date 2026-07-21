<script setup lang="ts">
type GifText = {
  text: string
  url: string
  backgroundPosition?: string
  backgroundSize?: string
}
const textArray: GifText[] = [
  {
    text: './',
    url: 'https://media1.tenor.com/m/_ETKRybU9WEAAAAd/orange-cat-stare.gif',
    backgroundSize: '130%',
    backgroundPosition: '50% 64%',
  },
  {
    text: 'n',
    url: 'https://media1.tenor.com/m/VFDevE2qwdcAAAAC/good-morning.gif',
    backgroundSize: '170%',
  },
  {
    text: 'p',
    url: 'https://media1.tenor.com/m/8QP4JDPp85UAAAAC/kido.gif',
    backgroundSize: '180%',
    backgroundPosition: '70% 60%',
  },
  {
    text: 'm',
    url: 'https://media1.tenor.com/m/aN_HGmP-ZgAAAAAC/m.gif',
    backgroundPosition: '39% 120%',
    backgroundSize: '180%',
  },
  {
    text: 'x',
    url: 'https://media1.tenor.com/m/tslbzvMV878AAAAC/xmen-97-cyclops.gif',
    backgroundSize: '180%',
  },
]
</script>

<template>
  <div class="flex justify-center" aria-hidden="true">
    <NoodleGifDayGifText
      v-for="item in textArray"
      :key="item.text"
      :text="item.text"
      :background-url="item.url"
      :background-position="item.backgroundPosition"
      :background-size="item.backgroundSize"
    />
  </div>
</template>
