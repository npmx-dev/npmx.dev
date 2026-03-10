<template>
  <section aria-labelledby="zero-direct-deps-heading" class="relative">
    <div
      class="border border-emerald-600/40 bg-emerald-500/10 rounded-lg px-3 py-2 text-base text-emerald-800 dark:text-emerald-400"
    >
      <h2 id="zero-direct-deps-heading" class="font-medium mb-1 flex items-center gap-2">
        <span class="i-lucide:circle-check-big w-4 h-4" aria-hidden="true" />
        {{ $t('package.dependencies.zero_dependencies.title') }}
      </h2>
      <p class="text-sm m-0 mt-1">
        {{ $t('package.dependencies.zero_dependencies.description') }}
      </p>
    </div>
  </section>
</template>
