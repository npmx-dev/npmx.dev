<script setup lang="ts">
import type { PackageJsonDependency } from '~/utils/parse-package-json-deps'
import { parsePackageJsonText } from '~/utils/parse-package-json-deps'
import { useRouteQuery } from '@vueuse/router'

definePageMeta({
  name: 'tools-deps-stats',
})

const { t } = useI18n()

const fileName = shallowRef<string | null>(null)
const parseError = shallowRef<string | null>(null)
const dependencies = shallowRef<PackageJsonDependency[]>([])

const selectedName = useRouteQuery<string>('pkg', '', { mode: 'replace' })

const selectedDependency = computed(
  () => dependencies.value.find(dep => dep.name === selectedName.value) ?? null,
)

function handleParsed(file: File, text: string) {
  try {
    const parsed = parsePackageJsonText(text)
    fileName.value = file.name
    parseError.value = null
    dependencies.value = parsed.dependencies

    const stillSelected = parsed.dependencies.some(dep => dep.name === selectedName.value)
    if (!stillSelected) {
      const firstRegistry = parsed.dependencies.find(dep => !dep.nonRegistry)
      selectedName.value = (firstRegistry ?? parsed.dependencies[0])?.name ?? ''
    }
  } catch (error) {
    handleClear()
    fileName.value = file.name
    parseError.value =
      error instanceof Error ? error.message : t('deps_stats.upload.invalid_package_json')
  }
}

function handleClear() {
  fileName.value = null
  dependencies.value = []
  parseError.value = null
  selectedName.value = ''
}

function selectDependency(dep: PackageJsonDependency) {
  selectedName.value = dep.name
}

const hasParsedFile = computed(() => fileName.value !== null && !parseError.value)

useSeoMeta({
  title: () => t('deps_stats.meta_title'),
  ogTitle: () => t('deps_stats.meta_title'),
  twitterTitle: () => t('deps_stats.meta_title'),
  description: () => t('deps_stats.meta_description'),
  ogDescription: () => t('deps_stats.meta_description'),
  twitterDescription: () => t('deps_stats.meta_description'),
})

defineOgImage(
  'Page.takumi',
  {
    title: () => t('deps_stats.title'),
    description: () => t('deps_stats.meta_description'),
  },
  { alt: () => t('deps_stats.title') },
)
</script>

<template>
  <main class="container w-full pt-6">
    <div class="flex items-center gap-2 min-w-0">
      <NuxtLink
        :to="{ name: 'tools' }"
        class="text-lg font-medium hover:text-fg-muted transition-colors shrink-0"
      >
        {{ $t('tools.title') }}
      </NuxtLink>
      <span class="text-fg-subtle shrink-0">/</span>
      <h1 class="text-sm text-fg-muted shrink-0">{{ $t('deps_stats.title') }}</h1>
    </div>

    <section class="mt-4" aria-labelledby="upload-heading">
      <h2 id="upload-heading" class="text-xs text-fg-subtle uppercase tracking-wider mb-3 sr-only">
        {{ $t('deps_stats.upload.section') }}
      </h2>
      <DepsStatsPackageJsonUpload
        :file-name="fileName"
        :error="parseError"
        @parsed="handleParsed"
        @clear="handleClear"
      />
    </section>

    <section v-if="hasParsedFile" class="flex-1 min-h-0 flex flex-col mt-4">
      <div
        class="flex-1 min-h-[28rem] lg:min-h-[36rem] grid grid-cols-1 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] gap-4"
      >
        <DepsStatsDependencyList
          class="max-lg:max-h-80 lg:h-[calc(100vh-15rem)]"
          :dependencies="dependencies"
          :selected-name="selectedName"
          @select="selectDependency"
        />
        <DepsStatsDependencyStats
          :dependency="selectedDependency"
          class="lg:h-[calc(100vh-15rem)]"
        />
      </div>
    </section>
  </main>
</template>
