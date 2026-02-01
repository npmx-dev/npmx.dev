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
  <section v-if="skills.length" id="skills" class="scroll-mt-20">
    <h2 id="skills-heading" class="group text-xs text-fg-subtle uppercase tracking-wider mb-3">
      <a
        href="#skills"
        class="inline-flex items-center gap-1.5 text-fg-subtle hover:text-fg-muted transition-colors duration-200 no-underline"
      >
        {{ $t('package.skills.title') }}
        <span
          class="i-carbon:link w-3 h-3 block opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          aria-hidden="true"
        />
      </a>
    </h2>
    <button
      type="button"
      class="group/btn w-full flex items-center gap-2 px-3 py-2 bg-bg-subtle border border-border rounded-lg hover:border-border-hover hover:bg-bg-muted transition-colors"
      @click="skillsModal.open()"
    >
      <span class="i-custom:agent-skills size-4 text-fg-muted" aria-hidden="true" />
      <span class="text-sm text-fg">{{
        $t('package.skills.skills_available', { count: skills.length }, skills.length)
      }}</span>
      <span class="text-xs text-fg-subtle group-hover/btn:text-fg transition-colors ms-auto">{{
        $t('package.skills.view')
      }}</span>
    </button>
  </section>
</template>
