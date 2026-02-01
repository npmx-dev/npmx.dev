<script setup lang="ts">
import type { SkillListItem } from '#shared/types'

const props = defineProps<{
  skills: SkillListItem[]
  packageName: string
  version?: string
}>()

function getSkillSourceUrl(skill: SkillListItem): string {
  const base = `/code/${props.packageName}`
  const versionPath = props.version ? `/v/${props.version}` : ''
  return `${base}${versionPath}/skills/${skill.dirName}/SKILL.md`
}

const expandedSkills = ref<Set<string>>(new Set())

function toggleSkill(dirName: string) {
  if (expandedSkills.value.has(dirName)) {
    expandedSkills.value.delete(dirName)
  } else {
    expandedSkills.value.add(dirName)
  }
  expandedSkills.value = new Set(expandedSkills.value)
}

type InstallMethod = 'skills-npm' | 'skills-cli'
const selectedMethod = ref<InstallMethod>('skills-npm')

const baseUrl = computed(() =>
  typeof window !== 'undefined' ? window.location.origin : 'https://npmx.dev',
)

const installCommand = computed(() => {
  if (!props.skills.length) return null
  return `npx skills add ${baseUrl.value}/${props.packageName}`
})

const { copied, copy } = useClipboard({ copiedDuring: 2000 })
const copyCommand = () => installCommand.value && copy(installCommand.value)

function getWarningTooltip(skill: SkillListItem): string | undefined {
  if (!skill.warnings?.length) return undefined
  return skill.warnings.map(w => w.message).join(', ')
}
</script>

<template>
  <Modal :modal-title="$t('package.skills.title')" id="skills-modal" class="sm:max-w-2xl">
    <!-- Install header with tabs -->
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h3 class="text-xs text-fg-subtle uppercase tracking-wider">
        {{ $t('package.skills.install') }}
      </h3>
      <div
        class="flex items-center gap-1 p-0.5 bg-bg-subtle border border-border-subtle rounded-md"
        role="tablist"
        :aria-label="$t('package.skills.installation_method')"
      >
        <button
          role="tab"
          :aria-selected="selectedMethod === 'skills-npm'"
          :tabindex="selectedMethod === 'skills-npm' ? 0 : -1"
          type="button"
          class="px-2 py-1 font-mono text-xs rounded transition-colors duration-150 border border-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          :class="
            selectedMethod === 'skills-npm'
              ? 'bg-bg border-border shadow-sm text-fg'
              : 'border-transparent text-fg-subtle hover:text-fg'
          "
          @click="selectedMethod = 'skills-npm'"
        >
          skills-npm
        </button>
        <button
          role="tab"
          :aria-selected="selectedMethod === 'skills-cli'"
          :tabindex="selectedMethod === 'skills-cli' ? 0 : -1"
          type="button"
          class="px-2 py-1 font-mono text-xs rounded transition-colors duration-150 border border-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          :class="
            selectedMethod === 'skills-cli'
              ? 'bg-bg border-border shadow-sm text-fg'
              : 'border-transparent text-fg-subtle hover:text-fg'
          "
          @click="selectedMethod = 'skills-cli'"
        >
          skills CLI
        </button>
      </div>
    </div>

    <!-- skills-npm: compatible -->
    <div
      v-if="selectedMethod === 'skills-npm'"
      class="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 bg-bg-subtle border border-border rounded-lg mb-5"
    >
      <i18n-t keypath="package.skills.compatible_with" tag="span" class="text-sm text-fg-muted">
        <template #tool>
          <code class="font-mono text-fg">skills-npm</code>
        </template>
      </i18n-t>
      <a
        href="/skills-npm"
        class="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg transition-colors shrink-0"
      >
        {{ $t('package.skills.learn_more') }}
        <span class="i-carbon:arrow-right w-3 h-3" />
      </a>
    </div>

    <!-- skills CLI: terminal command -->
    <div
      v-else-if="installCommand"
      class="bg-bg-subtle border border-border rounded-lg overflow-hidden mb-5"
    >
      <div class="flex gap-1.5 px-3 pt-2 sm:px-4 sm:pt-3">
        <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
        <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
        <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
      </div>
      <div class="px-3 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4 overflow-x-auto">
        <div class="relative group/cmd">
          <code class="font-mono text-sm whitespace-nowrap">
            <span class="text-fg-subtle select-none">$ </span>
            <span class="text-fg">npx </span>
            <span class="text-fg-muted">skills add {{ baseUrl }}/{{ packageName }}</span>
          </code>
          <button
            type="button"
            class="absolute top-0 inset-ie-0 px-2 py-0.5 font-mono text-xs text-fg-muted bg-bg-subtle/80 border border-border rounded transition-colors duration-200 opacity-0 group-hover/cmd:opacity-100 hover:(text-fg border-border-hover) active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            :aria-label="$t('package.get_started.copy_command')"
            @click.stop="copyCommand"
          >
            <span aria-live="polite">{{ copied ? $t('common.copied') : $t('common.copy') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Skills list -->
    <div class="flex items-baseline justify-between gap-2 mb-2">
      <h3 class="text-xs text-fg-subtle uppercase tracking-wider">
        {{ $t('package.skills.available_skills') }}
      </h3>
      <span class="text-xs text-fg-subtle/60">{{ $t('package.skills.click_to_expand') }}</span>
    </div>
    <ul class="space-y-0.5 list-none m-0 p-0">
      <li v-for="skill in skills" :key="skill.dirName">
        <button
          type="button"
          class="w-full flex items-center gap-2 py-1.5 text-start rounded transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          :aria-expanded="expandedSkills.has(skill.dirName)"
          @click="toggleSkill(skill.dirName)"
        >
          <span
            class="i-carbon:chevron-right w-3 h-3 text-fg-subtle shrink-0 transition-transform duration-200"
            :class="{ 'rotate-90': expandedSkills.has(skill.dirName) }"
            aria-hidden="true"
          />
          <span class="font-mono text-sm text-fg-muted">{{ skill.name }}</span>
          <span
            v-if="skill.warnings?.length"
            class="i-carbon:warning w-3.5 h-3.5 text-amber-500 shrink-0"
            :title="getWarningTooltip(skill)"
          />
        </button>

        <!-- Expandable details -->
        <div
          class="grid transition-[grid-template-rows] duration-200 ease-out"
          :class="expandedSkills.has(skill.dirName) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        >
          <div class="overflow-hidden">
            <div class="ps-5.5 pe-2 pb-2 pt-1 space-y-1.5">
              <!-- Description -->
              <p v-if="skill.description" class="text-sm text-fg-subtle">
                {{ skill.description }}
              </p>
              <p v-else class="text-sm text-fg-subtle/50 italic">
                {{ $t('package.skills.no_description') }}
              </p>

              <!-- File counts & warnings -->
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span v-if="skill.fileCounts?.scripts" class="text-fg-subtle">
                  <span class="i-carbon:script size-3 inline-block align-[-2px] me-0.5" />{{
                    $t(
                      'package.skills.file_counts.scripts',
                      { count: skill.fileCounts.scripts },
                      skill.fileCounts.scripts,
                    )
                  }}
                </span>
                <span v-if="skill.fileCounts?.references" class="text-fg-subtle">
                  <span class="i-carbon:document size-3 inline-block align-[-2px] me-0.5" />{{
                    $t(
                      'package.skills.file_counts.refs',
                      { count: skill.fileCounts.references },
                      skill.fileCounts.references,
                    )
                  }}
                </span>
                <span v-if="skill.fileCounts?.assets" class="text-fg-subtle">
                  <span class="i-carbon:image size-3 inline-block align-[-2px] me-0.5" />{{
                    $t(
                      'package.skills.file_counts.assets',
                      { count: skill.fileCounts.assets },
                      skill.fileCounts.assets,
                    )
                  }}
                </span>
                <template v-for="warning in skill.warnings" :key="warning.message">
                  <span class="text-amber-500">
                    <span class="i-carbon:warning size-3 inline-block align-[-2px] me-0.5" />{{
                      warning.message
                    }}
                  </span>
                </template>
              </div>

              <!-- Source link -->
              <NuxtLink
                :to="getSkillSourceUrl(skill)"
                class="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg transition-colors"
                @click.stop
              >
                <span class="i-carbon:code size-3" />{{ $t('package.skills.view_source') }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </Modal>
</template>
