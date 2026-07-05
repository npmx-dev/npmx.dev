<template>
  <SkeletonBlock class="h-8 w-40 rounded" />
  <ul class="ms-3 list-disc my-4 ps-6 marker:color-[--border-hover]">
    <li class="mb-1" v-for="_n in 5">
      <SkeletonBlock class="h-7 w-full max-w-2xl rounded" />
    </li>
  </ul>

  <SkeletonBlock class="h-5 w-5/6 max-w-2xl rounded" />
  <SkeletonBlock class="h-5 w-3/4 max-w-2xl rounded" />
</template>
