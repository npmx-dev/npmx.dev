<script setup lang="ts">
import { formatNumber } from '#imports'

const route = useRoute('org-name')

const orgName = computed(() => route.params.name)

// Search for packages in this org's scope (@orgname/*)
const searchQuery = computed(() => `@${orgName.value}`)

const { data: results, status, error } = useNpmSearch(searchQuery, { size: 250 })

// Filter to only include packages that are actually in this scope
// (search may return packages that just mention the org name)
const scopedPackages = computed(() => {
  if (!results.value?.objects) return []
  const scopePrefix = `@${orgName.value}/`
  return results.value.objects
    .filter(obj => obj.package.name.startsWith(scopePrefix))
    .sort((a, b) => b.searchScore - a.searchScore)
})

const packageCount = computed(() => scopedPackages.value.length)

useSeoMeta({
  title: () => `@${orgName.value} - npmx`,
  description: () => `npm packages published by the ${orgName.value} organization`,
})

defineOgImageComponent('Default', {
  title: () => `@${orgName.value}`,
  description: () => scopedPackages.value.length ? `${scopedPackages.value.length} packages` : 'npm organization',
})
</script>

<template>
  <main class="container py-8 sm:py-12">
    <!-- Header -->
    <header class="mb-8 pb-8 border-b border-border">
      <div class="flex items-center gap-4 mb-4">
        <!-- Org avatar placeholder -->
        <div
          class="w-16 h-16 rounded-lg bg-bg-muted border border-border flex items-center justify-center"
          aria-hidden="true"
        >
          <span class="text-2xl text-fg-subtle font-mono">{{ orgName.charAt(0).toUpperCase() }}</span>
        </div>
        <div>
          <h1 class="font-mono text-2xl sm:text-3xl font-medium">
            @{{ orgName }}
          </h1>
          <p
            v-if="status === 'success'"
            class="text-fg-muted text-sm mt-1"
          >
            {{ formatNumber(packageCount) }} public package{{ packageCount === 1 ? '' : 's' }}
          </p>
        </div>
      </div>

      <!-- Link to npmjs.com org page -->
      <nav aria-label="External links">
        <a
          :href="`https://www.npmjs.com/org/${orgName}`"
          target="_blank"
          rel="noopener noreferrer"
          class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
        >
          <span class="i-carbon-cube w-4 h-4" />
          view on npm
        </a>
      </nav>
    </header>

    <!-- Loading state -->
    <LoadingSpinner
      v-if="status === 'pending'"
      text="Loading packages..."
    />

    <!-- Error state -->
    <div
      v-else-if="status === 'error'"
      role="alert"
      class="py-12 text-center"
    >
      <p class="text-fg-muted mb-4">
        {{ error?.message ?? 'Failed to load organization packages' }}
      </p>
      <NuxtLink
        to="/"
        class="btn"
      >
        Go back home
      </NuxtLink>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="packageCount === 0"
      class="py-12 text-center"
    >
      <p class="text-fg-muted font-mono">
        No public packages found for <span class="text-fg">@{{ orgName }}</span>
      </p>
      <p class="text-fg-subtle text-sm mt-2">
        This organization may not exist or has no public packages.
      </p>
    </div>

    <!-- Package list -->
    <section
      v-else-if="scopedPackages.length > 0"
      aria-label="Organization packages"
    >
      <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
        Packages
      </h2>

      <PackageList :results="scopedPackages" />
    </section>
  </main>
</template>
