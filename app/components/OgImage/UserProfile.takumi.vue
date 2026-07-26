<script setup lang="ts">
const { username } = defineProps<{
  username?: string
}>()

const total = shallowRef(0)

if (username && isValidNpmName(username)) {
  let algoliaTotal = 0
  try {
    const { search } = useAlgoliaSearch()
    const algolia = await search('', { filters: `owners.name:${username}`, size: 1 })
    algoliaTotal = algolia.total
  } catch {
    // Algolia unavailable — fall through to the npm-registry lookup below.
  }

  if (algoliaTotal > 0) {
    total.value = algoliaTotal
  } else {
    // Fall back to the npm registry's `maintainer:` search (matching the page's
    // provider order) when Algolia is empty or failed.
    const npm = await $fetch<{ total?: number }>('https://registry.npmjs.org/-/v1/search', {
      params: { text: `maintainer:${username}`, size: 1 },
      timeout: 2500,
    }).catch(() => null)
    total.value = npm?.total ?? 0
  }
}

const description = computed(() =>
  username ? `${total.value} package${total.value === 1 ? '' : 's'}` : 'npm user profile',
)
</script>

<template>
  <OgLayout>
    <div class="px-15 py-12 flex flex-col justify-center gap-12 h-full">
      <OgBrand :height="48" />

      <div v-if="username" class="flex flex-col max-w-full gap-3">
        <div
          class="lg:text-7xl text-5xl tracking-tighter font-mono leading-none"
          :style="{ lineClamp: 1, textOverflow: 'ellipsis' }"
        >
          {{ `~${username}` }}
        </div>
      </div>

      <div
        class="pt-3 lg:text-4xl text-3xl opacity-70"
        :style="{ lineClamp: 2, textOverflow: 'ellipsis' }"
      >
        {{ description }}
      </div>
    </div>
  </OgLayout>
</template>
