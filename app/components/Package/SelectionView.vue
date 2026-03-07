<script setup lang="ts">
defineProps<{
  viewMode?: ViewMode
}>()

const { selectedPackages, clearSelectedPackages, selectedPackagesParam, closeSelectionView } =
  usePackageSelection()

const { data, pending } = useAsyncData(
  async () => {
    const results = await Promise.all(
      selectedPackages.value.map(name =>
        $fetch(`/api/registry/package-meta/${encodeURIComponent(name)}`)
          .then(response => ({ package: response }))
          .catch(() => []),
      ),
    )
    return results as NpmSearchResult[]
  },
  {
    default: () => [],
  },
)
</script>

<template>
  <section>
    <header class="mb-6 flex items-center justify-between">
      <button
        type="button"
        class="cursor-pointer inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70"
        @click="closeSelectionView"
        :aria-label="$t('nav.back')"
      >
        <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
        <span class="hidden sm:inline">{{ $t('nav.back') }}</span>
      </button>
      <div class="flex items-center gap-2">
        <ButtonBase variant="secondary" @click="clearSelectedPackages">
          {{ $t('filters.clear_all') }}
        </ButtonBase>
        <LinkBase
          :to="{ name: 'compare', query: { packages: selectedPackagesParam } }"
          variant="button-primary"
          classicon="i-lucide:git-compare"
        >
          {{ $t('package.links.compare') }}
        </LinkBase>
      </div>
    </header>

    <p class="text-fg-muted text-sm font-mono">
      {{ $t('action_bar.selection', selectedPackages.length) }}
    </p>

    <div class="mt-6">
      <div v-if="pending" class="flex items-center justify-center py-12">
        <LoadingSpinner :text="$t('common.loading')" />
      </div>
      <PackageList
        v-else-if="data?.length"
        :view-mode="viewMode"
        :results="data"
        heading-level="h2"
      />
      <p v-else class="text-fg-muted text-sm">
        {{ $t('filters.table.no_packages') }}
      </p>
    </div>
  </section>
</template>
