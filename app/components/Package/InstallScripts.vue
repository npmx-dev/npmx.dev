<script setup lang="ts">
import { getOutdatedTooltip, getVersionClass } from '~/utils/npm/outdated-dependencies'

const props = defineProps<{
  packageName: string
  installScripts: {
    scripts: ('preinstall' | 'install' | 'postinstall')[]
    content?: Record<string, string>
    npxDependencies: Record<string, string>
  }
}>()

const outdatedNpxDeps = useOutdatedDependencies(() => props.installScripts.npxDependencies)
const hasNpxDeps = computed(() => Object.keys(props.installScripts.npxDependencies).length > 0)
const sortedNpxDeps = computed(() => {
  return Object.entries(props.installScripts.npxDependencies).sort(([a], [b]) => a.localeCompare(b))
})

const isExpanded = shallowRef(false)
</script>

<template>
  <CollapsibleSection
    :title="$t('package.install_scripts.title')"
    id="installScripts"
    icon="i-carbon:warning-alt w-3 h-3 text-yellow-500"
  >
    <!-- Script list: name as label, content below -->
    <dl class="space-y-2 m-0">
      <div v-for="scriptName in installScripts.scripts" :key="scriptName">
        <dt class="font-mono text-xs text-fg-muted">{{ scriptName }}</dt>
        <dd
          tabindex="0"
          class="font-mono text-sm text-fg-subtle m-0 truncate focus:whitespace-normal focus:overflow-visible cursor-help rounded focus-visible:(outline-2 outline-accent outline-offset-2)"
          :title="installScripts.content?.[scriptName]"
        >
          {{ installScripts.content?.[scriptName] || $t('package.install_scripts.script_label') }}
        </dd>
      </div>
    </dl>

    <!-- npx packages (expandable) -->
    <div v-if="hasNpxDeps" class="mt-3">
      <button
        type="button"
        class="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors duration-200 focus-visible:outline-accent/70 rounded"
        :aria-expanded="isExpanded"
        aria-controls="npx-packages-details"
        @click="isExpanded = !isExpanded"
      >
        <span
          class="i-carbon:chevron-right rtl-flip w-3 h-3 transition-transform duration-200"
          :class="{ 'rotate-90': isExpanded }"
          aria-hidden="true"
        />
        {{
          $t(
            'package.install_scripts.npx_packages',
            { count: sortedNpxDeps.length },
            sortedNpxDeps.length,
          )
        }}
      </button>

      <ul
        v-show="isExpanded"
        id="npx-packages-details"
        class="mt-2 space-y-1 list-none m-0 p-0 ps-4"
      >
        <li
          v-for="[dep, version] in sortedNpxDeps"
          :key="dep"
          class="flex items-center justify-between py-0.5 text-sm gap-2"
        >
          <NuxtLink
            :to="{ name: 'package', params: { package: dep.split('/') } }"
            class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate min-w-0"
          >
            {{ dep }}
          </NuxtLink>
          <span class="flex items-center gap-1">
            <span
              v-if="
                outdatedNpxDeps[dep] &&
                outdatedNpxDeps[dep].resolved !== outdatedNpxDeps[dep].latest
              "
              class="shrink-0"
              :class="getVersionClass(outdatedNpxDeps[dep])"
              :title="getOutdatedTooltip(outdatedNpxDeps[dep], $t)"
              aria-hidden="true"
            >
              <span class="i-carbon:warning-alt w-3 h-3" />
            </span>
            <span
              class="font-mono text-xs text-end truncate"
              :class="getVersionClass(outdatedNpxDeps[dep])"
              :title="
                outdatedNpxDeps[dep]
                  ? outdatedNpxDeps[dep].resolved === outdatedNpxDeps[dep].latest
                    ? $t('package.install_scripts.currently', {
                        version: outdatedNpxDeps[dep].latest,
                      })
                    : getOutdatedTooltip(outdatedNpxDeps[dep], $t)
                  : version
              "
            >
              {{ version }}
            </span>
          </span>
        </li>
      </ul>
    </div>
  </CollapsibleSection>
</template>
