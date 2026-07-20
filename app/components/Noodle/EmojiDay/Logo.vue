<script setup lang="ts">
const letters = ['0']
</script>

<template>
  <div>
    <span class="text-[18rem] font-extrabold font-sans" v-for="letter in letters" :key="letter">
      {{ letter }}
    </span>
  </div>
  <div>
    <img
      src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnkzb3h3enVjZnV5bGt2bWdvcXdneTUxdGN2ZmN1OW83dGJhaWxuMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/1FMaabePDEfgk/giphy.gif"
      alt=""
    />
  </div>
</template>
