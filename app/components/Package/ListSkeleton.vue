<template>
  <ol class="list-none m-0 p-0" aria-busy="true" :aria-label="$t('common.loading_packages')">
    <li v-for="n in 5" :key="n" class="pb-4">
      <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6">
        <SkeletonBlock class="h-5 sm:h-6 w-40 mb-4 rounded" />
        <div class="mb-2 sm:mb-3 space-y-1">
          <SkeletonBlock class="h-3.5 sm:h-5 w-full sm:w-3/4 max-w-xl rounded" />
          <SkeletonBlock class="h-3.5 w-2/3 rounded sm:hidden" />
        </div>
        <div class="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2">
          <SkeletonBlock class="h-4 w-12 rounded" />
          <SkeletonBlock class="h-4 w-20 rounded" />
          <SkeletonBlock class="h-4 w-10 rounded" />
          <SkeletonBlock class="h-4 w-28 rounded sm:ms-auto" />
        </div>
      </div>
    </li>
  </ol>
</template>
