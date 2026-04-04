<template>
  <div class="flex min-h-full" role="status" aria-busy="true" :aria-label="$t('common.loading')">
    <!-- Fake line numbers column -->
    <div class="shrink-0 bg-bg-subtle border-ie border-border w-14 py-0">
      <div v-for="n in 20" :key="n" class="px-3 h-6 flex items-center justify-end">
        <SkeletonInline class="w-4 h-3 rounded-sm" />
      </div>
    </div>
    <!-- Fake code content -->
    <div class="flex-1 p-4 space-y-1.5">
      <SkeletonBlock class="h-4 w-32 rounded-sm" />
      <SkeletonBlock class="h-4 w-48 rounded-sm" />
      <SkeletonBlock class="h-4 w-24 rounded-sm" />
      <div class="h-4" />
      <SkeletonBlock class="h-4 w-64 rounded-sm" />
      <SkeletonBlock class="h-4 w-56 rounded-sm" />
      <SkeletonBlock class="h-4 w-40 rounded-sm" />
      <SkeletonBlock class="h-4 w-72 rounded-sm" />
      <div class="h-4" />
      <SkeletonBlock class="h-4 w-36 rounded-sm" />
      <SkeletonBlock class="h-4 w-52 rounded-sm" />
      <SkeletonBlock class="h-4 w-44 rounded-sm" />
      <SkeletonBlock class="h-4 w-28 rounded-sm" />
      <div class="h-4" />
      <SkeletonBlock class="h-4 w-60 rounded-sm" />
      <SkeletonBlock class="h-4 w-48 rounded-sm" />
      <SkeletonBlock class="h-4 w-32 rounded-sm" />
      <SkeletonBlock class="h-4 w-56 rounded-sm" />
      <SkeletonBlock class="h-4 w-40 rounded-sm" />
      <SkeletonBlock class="h-4 w-24 rounded-sm" />
    </div>
  </div>
</template>
