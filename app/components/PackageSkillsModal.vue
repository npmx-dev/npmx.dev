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

// Track expanded skills
const expandedSkills = ref<Set<string>>(new Set())

function toggleSkill(dirName: string) {
  if (expandedSkills.value.has(dirName)) {
    expandedSkills.value.delete(dirName)
  } else {
    expandedSkills.value.add(dirName)
  }
  expandedSkills.value = new Set(expandedSkills.value)
}

const requestUrl = useRequestURL()
const baseUrl = computed(() => `${requestUrl.protocol}//${requestUrl.host}`)

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

            <!-- Terminal-style install command -->
            <div
              v-if="installCommand"
              class="bg-bg-subtle border border-border rounded-lg overflow-hidden mb-5"
            >
              <div class="flex gap-1.5 px-3 pt-2 sm:px-4 sm:pt-3">
                <span class="size-2.5 rounded-full bg-fg-subtle/50" />
                <span class="size-2.5 rounded-full bg-fg-subtle/50" />
                <span class="size-2.5 rounded-full bg-fg-subtle/50" />
              </div>
              <div class="px-3 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4 overflow-x-auto">
                <div class="flex items-center gap-2">
                  <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
                  <code class="font-mono text-sm text-fg-muted whitespace-nowrap">
                    npx skills add {{ baseUrl }}/{{ packageName }}
                  </code>
                  <button
                    type="button"
                    class="p-1.5 text-fg-muted rounded transition-colors duration-200 hover:text-fg hover:bg-bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 shrink-0"
                    :aria-label="$t('package.get_started.copy_command')"
                    @click.stop="copyCommand"
                  >
                    <span
                      v-if="copied"
                      class="i-carbon:checkmark size-4 block"
                      aria-hidden="true"
                    />
                    <span v-else class="i-carbon:copy size-4 block" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Skills list with expandable descriptions -->
            <ul class="space-y-0.5 list-none m-0 p-0">
              <li v-for="skill in skills" :key="skill.dirName">
                <button
                  type="button"
                  class="w-full flex items-center gap-2 py-1.5 text-start rounded transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
                  :aria-expanded="expandedSkills.has(skill.dirName)"
                  @click="toggleSkill(skill.dirName)"
                >
                  <span
                    class="i-carbon:chevron-right w-3.5 h-3.5 text-fg-subtle shrink-0 transition-transform duration-200"
                    :class="{ 'rotate-90': expandedSkills.has(skill.dirName) }"
                    aria-hidden="true"
                  />
                  <span class="font-mono text-sm text-fg-muted">{{ skill.name }}</span>
                  <span
                    v-if="skill.warnings?.length"
                    class="i-carbon:warning size-3.5 text-amber-500 shrink-0"
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
