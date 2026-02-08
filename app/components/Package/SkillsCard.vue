<script setup lang="ts">
import type { SkillListItem } from '#shared/types'

defineProps<{
  skills: SkillListItem[]
  packageName: string
  version?: string
}>()

const skillsModal = useModal('skills-modal')
</script>

<template>
  <CollapsibleSection v-if="skills.length" :title="$t('package.skills.title')" id="skills">
    <button
      type="button"
      class="w-full flex items-center gap-2 px-3 py-2 text-sm font-mono bg-bg-muted border border-border rounded-md hover:border-border-hover hover:bg-bg-elevated focus-visible:outline-accent/70 transition-colors duration-200"
      @click="skillsModal.open()"
    >
      <span class="i-custom:agent-skills w-4 h-4 shrink-0 text-fg-muted" aria-hidden="true" />
      <span class="text-fg-muted">{{
        $t('package.skills.skills_available', { count: skills.length }, skills.length)
      }}</span>
    </button>
  </CollapsibleSection>
</template>
