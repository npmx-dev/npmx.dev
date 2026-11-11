<script setup lang="ts">
const packages = defineModel<string[]>({ required: true })

const props = defineProps<{
  /** Maximum number of packages allowed */
  max?: number
}>()

const maxPackages = computed(() => props.max ?? MAX_PACKAGE_SELECTION)

const inputValue = shallowRef('')

// Trigger strings for "What Would James Do?" typeahead Easter egg
// Intentionally not localized
const EASTER_EGG_TRIGGERS = new Set([
  'no dep',
  'none',
  'vanilla',
  'diy',
  'zero',
  'nothing',
  '0',
  "don't",
  'native',
  'use the platform',
])

// Check if "no dependency" option should show in typeahead
const showNoDependencyOption = computed(() => {
  if (packages.value.includes(NO_DEPENDENCY_ID)) return false
  const input = inputValue.value.toLowerCase().trim()
  if (!input) return false
  return EASTER_EGG_TRIGGERS.has(input)
})

const leadingOptions = computed(() =>
  showNoDependencyOption.value
    ? [{ value: NO_DEPENDENCY_ID, label: $t('compare.no_dependency.add_column') }]
    : [],
)

// Filter out already selected packages
const selectedBaseNames = computed(() => packages.value.map(p => parsePackageSpec(p).name))

const numberFormatter = useNumberFormatter()

function addPackage(spec: string) {
  if (packages.value.length >= maxPackages.value) return
  const trimmedSpec = spec.trim()
  if (!trimmedSpec) return
  if (packages.value.includes(trimmedSpec)) return

  // Keep NO_DEPENDENCY_ID always last
  if (trimmedSpec === NO_DEPENDENCY_ID) {
    packages.value = [...packages.value, trimmedSpec]
  } else if (packages.value.includes(NO_DEPENDENCY_ID)) {
    // Insert before the no-dep entry
    const withoutNoDep = packages.value.filter(p => p !== NO_DEPENDENCY_ID)
    packages.value = [...withoutNoDep, trimmedSpec, NO_DEPENDENCY_ID]
  } else {
    packages.value = [...packages.value, trimmedSpec]
  }
  inputValue.value = ''
}

function removePackage(name: string) {
  packages.value = packages.value.filter(p => p !== name)
}

// Fallback: easter egg, exact match, or manual version spec entry (e.g. lodash@3.10.1)
function handleSubmit(query: string, exactMatch: boolean) {
  if (showNoDependencyOption.value) {
    addPackage(NO_DEPENDENCY_ID)
    return
  }
  if (exactMatch || parsePackageSpec(query).version) addPackage(query)
}

const versionHintId = useId()
</script>

<template>
  <div class="space-y-3">
    <!-- Selected packages -->
    <div v-if="packages.length > 0" class="flex flex-wrap gap-2">
      <TagStatic v-for="pkg in packages" :key="pkg">
        <!-- No dependency display -->
        <template v-if="pkg === NO_DEPENDENCY_ID">
          <span class="text-sm text-accent italic flex items-center gap-1.5">
            <span class="i-lucide:leaf w-3.5 h-3.5" aria-hidden="true" />
            {{ $t('compare.no_dependency.label') }}
          </span>
        </template>
        <LinkBase
          v-else
          :to="packageRoute(parsePackageSpec(pkg).name, parsePackageSpec(pkg).version)"
          class="text-sm font-mono"
        >
          {{ pkg }}
        </LinkBase>
        <ButtonBase
          size="sm"
          :aria-label="
            $t('compare.selector.remove_package', {
              package: pkg === NO_DEPENDENCY_ID ? $t('compare.no_dependency.label') : pkg,
            })
          "
          @click="removePackage(pkg)"
          classicon="i-lucide:x"
        />
      </TagStatic>
    </div>

    <!-- Add package input -->
    <PackageTypeahead
      v-if="packages.length < maxPackages"
      v-model:query="inputValue"
      input-id="package-search"
      :label="$t('compare.selector.search_label')"
      :placeholder="
        packages.length === 0
          ? $t('compare.selector.search_first')
          : $t('compare.selector.search_add')
      "
      :describedby="versionHintId"
      :exclude="selectedBaseNames"
      :leading-options="leadingOptions"
      @select="addPackage"
      @submit="handleSubmit"
    >
      <!-- No dependency option (easter egg with James) -->
      <template #option>
        <span class="text-sm text-accent italic flex items-center gap-2">
          <span class="i-lucide:leaf w-4 h-4" aria-hidden="true" />
          {{ $t('compare.no_dependency.typeahead_title') }}
        </span>
        <span class="text-xs text-fg-muted truncate mt-0.5">
          {{ $t('compare.no_dependency.typeahead_description') }}
        </span>
      </template>
    </PackageTypeahead>

    <!-- Hint -->
    <i18n-t
      :id="versionHintId"
      keypath="compare.selector.version_hint"
      tag="p"
      class="text-xs text-fg-subtle"
    >
      <template #syntax>
        <code class="font-mono">package@version</code>
      </template>
      <template #first>
        <code class="font-mono">vue@3.0.0</code>
      </template>
      <template #second>
        <code class="font-mono">vue@3.5.44</code>
      </template>
    </i18n-t>

    <p class="text-xs text-fg-subtle">
      {{
        $t('compare.selector.packages_selected', {
          count: numberFormatter.format(packages.length),
          max: numberFormatter.format(maxPackages),
        })
      }}
      <span v-if="packages.length < 2">{{ $t('compare.selector.add_hint') }}</span>
    </p>
  </div>
</template>
