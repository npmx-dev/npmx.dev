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

const open = defineModel<boolean>('open', { default: false })

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

function close() {
  open.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
        @keydown="handleKeydown"
      >
        <!-- Backdrop -->
        <button
          type="button"
          class="absolute inset-0 bg-black/60 cursor-default"
          :aria-label="$t('common.close_modal')"
          @click="close"
        />

        <div
          class="relative w-full h-full sm:h-auto bg-bg sm:border sm:border-border sm:rounded-lg shadow-xl sm:max-h-[90vh] overflow-y-auto overscroll-contain sm:max-w-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skills-modal-title"
        >
          <div class="p-4 sm:p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 id="skills-modal-title" class="font-mono text-lg font-medium">
                {{ $t('package.skills.title', 'Agent Skills') }}
              </h2>
              <button
                type="button"
                class="text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
                :aria-label="$t('common.close')"
                @click="close"
              >
                <span class="i-carbon-close block w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <!-- Install header with tabs -->
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 class="text-xs text-fg-subtle uppercase tracking-wider">Install</h3>
              <div
                class="flex items-center gap-1 p-0.5 bg-bg-subtle border border-border-subtle rounded-md"
                role="tablist"
                aria-label="Installation method"
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

            <!-- skills-npm: requires setup -->
            <div
              v-if="selectedMethod === 'skills-npm'"
              class="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 bg-bg-subtle border border-border rounded-lg mb-5"
            >
              <span class="text-sm text-fg-muted"
                >Requires <code class="font-mono text-fg">skills-npm</code> setup</span
              >
              <a
                href="/skills-npm"
                class="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg transition-colors shrink-0"
              >
                Learn more
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
                <div class="flex items-center gap-2 group/cmd">
                  <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
                  <code class="font-mono text-sm"
                    ><span class="text-fg">npx </span
                    ><span class="text-fg-muted"
                      >skills add {{ baseUrl }}/{{ packageName }}</span
                    ></code
                  >
                  <button
                    type="button"
                    class="px-2 py-0.5 font-mono text-xs text-fg-muted bg-bg-subtle/80 border border-border rounded transition-colors duration-200 opacity-0 group-hover/cmd:opacity-100 hover:(text-fg border-border-hover) active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
                    :aria-label="$t('package.get_started.copy_command')"
                    @click.stop="copyCommand"
                  >
                    <span aria-live="polite">{{
                      copied ? $t('common.copied') : $t('common.copy')
                    }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Skills list -->
            <h3 class="text-xs text-fg-subtle uppercase tracking-wider mb-2">Available Skills</h3>
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
                      <p v-else class="text-sm text-fg-subtle/50 italic">No description</p>

                      <!-- File counts & warnings -->
                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span v-if="skill.fileCounts?.scripts" class="text-fg-subtle">
                          <span class="i-carbon:script size-3 inline-block align-[-2px] me-0.5" />{{
                            skill.fileCounts.scripts
                          }}
                          scripts
                        </span>
                        <span v-if="skill.fileCounts?.references" class="text-fg-subtle">
                          <span
                            class="i-carbon:document size-3 inline-block align-[-2px] me-0.5"
                          />{{ skill.fileCounts.references }} refs
                        </span>
                        <span v-if="skill.fileCounts?.assets" class="text-fg-subtle">
                          <span class="i-carbon:image size-3 inline-block align-[-2px] me-0.5" />{{
                            skill.fileCounts.assets
                          }}
                          assets
                        </span>
                        <template v-for="warning in skill.warnings" :key="warning.message">
                          <span class="text-amber-500">
                            <span
                              class="i-carbon:warning size-3 inline-block align-[-2px] me-0.5"
                            />{{ warning.message }}
                          </span>
                        </template>
                      </div>

                      <!-- Source link -->
                      <NuxtLink
                        :to="getSkillSourceUrl(skill)"
                        class="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg transition-colors"
                        @click.stop
                      >
                        <span class="i-carbon:code size-3" />View source
                      </NuxtLink>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
