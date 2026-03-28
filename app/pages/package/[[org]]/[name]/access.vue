<script setup lang="ts">
definePageMeta({
  name: 'package-access',
  scrollMargin: 200,
})

const route = useRoute('package-access')

const packageName = computed(() => {
  const { org, name } = route.params
  return org ? `${org}/${name}` : name
})

const { data: pkg } = usePackage(packageName)

const resolvedVersion = computed(() => {
  const latest = pkg.value?.['dist-tags']?.latest
  if (!latest) return null
  return latest
})

const displayVersion = computed(() => pkg.value?.requestedVersion ?? null)

const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

const versionUrlPattern = computed(() => {
  const split = packageName.value.split('/')
  if (split.length === 2) {
    return `/package/${split[0]}/${split[1]}/v/{version}`
  }
  return `/package/${packageName.value}/v/{version}`
})

const { isConnected } = useConnector()
const connectorModal = import.meta.client ? useModal('connector-modal') : null

useSeoMeta({
  title: () => `Access - ${packageName.value} - npmx`,
  description: () => `Manage access and collaborators for ${packageName.value}`,
})
</script>

<template>
  <main class="flex-1 pb-8">
    <PackageHeader
      :pkg="pkg ?? null"
      :resolved-version="resolvedVersion"
      :display-version="displayVersion"
      :latest-version="latestVersion"
      :version-url-pattern="versionUrlPattern"
      page="access"
    />

    <div class="container py-6">
      <h1 class="font-mono text-xl font-semibold mb-1">
        {{ $t('package.access.page_title') }}
      </h1>
      <p class="text-sm text-fg-muted mb-6">
        {{ $t('package.access.page_subtitle', { name: packageName }) }}
      </p>

      <ClientOnly>
        <template v-if="isConnected">
          <PackageAccessControls :package-name="packageName" />
        </template>
        <template v-else>
          <div class="py-12 text-center">
            <span class="i-lucide:lock w-12 h-12 mx-auto mb-4 text-fg-subtle block" />
            <p class="text-fg-muted mb-2 font-medium">
              {{ $t('package.access.connect_required') }}
            </p>
            <p class="text-sm text-fg-subtle mb-6">
              {{ $t('package.access.connect_hint') }}
            </p>
            <ButtonBase variant="primary" @click="connectorModal?.open()">
              {{ $t('connector.modal.connect') }}
            </ButtonBase>
          </div>
        </template>
        <template #fallback>
          <div class="space-y-4">
            <SkeletonInline v-for="i in 4" :key="i" class="h-12 w-full rounded-md" />
          </div>
        </template>
      </ClientOnly>
    </div>
  </main>
</template>
