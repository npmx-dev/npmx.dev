<script setup lang="ts">
import { getOutdatedTooltip, getVersionClass } from '~/utils/npm/outdated-dependencies'
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{
  packageName: string
  version: string
  installScripts: {
    scripts: ('preinstall' | 'install' | 'postinstall')[]
    content?: Record<string, string>
    npxDependencies: Record<string, string>
  }
}>()

function getCodeLink(filePath: string): RouteLocationRaw {
  const split = props.packageName.split('/')

  return {
    name: 'code',
    params: {
      org: split.length === 2 ? split[0] : null,
      packageName: split.length === 2 ? split[1]! : split[0]!,
      version: props.version,
      filePath: filePath,
    },
  }
}

const scriptParts = computed(() => {
  const parts: Record<
    string,
    { prefix: string | null; filePath: string | null; link: RouteLocationRaw }
  > = {}
  for (const scriptName of props.installScripts.scripts) {
    const content = props.installScripts.content?.[scriptName]
    if (!content) continue
    const parsed = parseNodeScript(content)
    if (parsed) {
      parts[scriptName] = {
        prefix: parsed.prefix,
        filePath: parsed.filePath,
        link: getCodeLink(parsed.filePath),
      }
    } else {
      parts[scriptName] = { prefix: null, filePath: null, link: getCodeLink('package.json') }
    }
  }
  return parts
})

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
    icon="i-lucide:circle-alert w-3 h-3 text-yellow-500"
  >
    <!-- Script list: name as label, content below -->
    <dl class="space-y-2 m-0">
      <div v-for="scriptName in installScripts.scripts" :key="scriptName">
        <dt class="font-mono text-xs text-fg-muted">{{ scriptName }}</dt>
        <dd
          class="font-mono text-sm text-fg-subtle m-0 truncate"
          :title="installScripts.content?.[scriptName]"
        >
          <template v-if="installScripts.content?.[scriptName] && scriptParts[scriptName]">
            <template v-if="scriptParts[scriptName].prefix">
              {{ scriptParts[scriptName].prefix
              }}<LinkBase :to="scriptParts[scriptName].link">{{
                scriptParts[scriptName].filePath
              }}</LinkBase>
            </template>
            <LinkBase v-else :to="scriptParts[scriptName].link">
              {{ installScripts.content[scriptName] }}
            </LinkBase>
          </template>
          <span v-else tabindex="0" class="cursor-help">
            {{ $t('package.install_scripts.script_label') }}
          </span>
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
          class="i-lucide:chevron-right rtl-flip w-3 h-3 transition-transform duration-200"
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
          <LinkBase
            :to="packageRoute(dep)"
            class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate min-w-0"
          >
            {{ dep }}
          </LinkBase>
          <span class="flex items-center gap-1">
            <TooltipApp
              v-if="
                outdatedNpxDeps[dep] &&
                outdatedNpxDeps[dep].resolved !== outdatedNpxDeps[dep].latest
              "
              class="shrink-0 p-2 -m-2"
              :class="getVersionClass(outdatedNpxDeps[dep])"
              aria-hidden="true"
              :text="getOutdatedTooltip(outdatedNpxDeps[dep], $t)"
            >
              <span class="i-lucide:circle-alert w-3 h-3" />
            </TooltipApp>
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
