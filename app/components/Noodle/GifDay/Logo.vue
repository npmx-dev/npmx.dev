<script setup lang="ts">
import n from '~/assets/n.gif'
import p from '~/assets/p.gif'
import m from '~/assets/m.gif'
import x from '~/assets/x.gif'

const letters = ['n', 'p', 'm', 'x']
const nUrl = `url(${n})`
const pUrl = `url(${p})`
const mUrl = `url(${m})`
const xUrl = `url(${x})`
</script>

<template>
  <div class="flex justify-center" role="img" :aria-label="letters.join('')">
    <span
      v-for="letter in letters"
      :key="letter"
      :class="['gif-letter', 'font-noodle text-[14rem] font-extrabold', letter]"
      aria-hidden="true"
    >
      {{ letter }}
    </span>
  </div>
</template>

<style scoped>
.gif-letter {
  background-size: cover;
  background-position: center;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  line-height: 1;
}

.n {
  background-image: v-bind(nUrl);
}
.p {
  background-image: v-bind(pUrl);
}
.m {
  background-image: v-bind(mUrl);
}
.x {
  background-image: v-bind(xUrl);
}
</style>
