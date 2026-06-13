<script setup lang="ts">
import type { Role, GitHubContributor } from '~~/server/api/contributors.get'

const props = defineProps<{
  members: GitHubContributor[]
}>()

const roleLabels = computed(
  () =>
    ({
      steward: $t('about.team.role_steward'),
      core: $t('about.team.role_core'),
      maintainer: $t('about.team.role_maintainer'),
    }) as Partial<Record<Role, string>>,
)
</script>

<template>
  <ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 list-none p-0">
    <li
      v-for="person in props.members"
      :key="person.id"
      class="relative p-3 bg-bg-muted border border-border rounded-xl hover:border-border-hover hover:bg-bg-subtle transition-[border-color,background-color] duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-offset-bg focus-within:ring-offset-2 focus-within:ring-fg/50"
    >
      <div class="flex gap-3">
        <img
          :src="`${person.avatar_url}&s=80`"
          :alt="`${person.login}'s avatar`"
          class="block w-15 h-15 rounded-md ring-1 ring-bg shrink-0"
          loading="lazy"
        />
        <div class="min-w-0 flex-1">
          <div class="font-mono text-sm text-fg truncate">
            <NuxtLink
              :to="person.html_url"
              target="_blank"
              class="decoration-none after:content-[''] after:absolute after:inset-0"
              :aria-label="$t('about.contributors.view_profile', { name: person.login })"
            >
              @{{ person.login }}
            </NuxtLink>
          </div>
          <div class="text-sm text-fg-muted tracking-tight">
            {{ roleLabels[person.role] ?? person.role }}
          </div>
          <LinkBase
            v-if="person.sponsors_url"
            :to="person.sponsors_url"
            no-underline
            no-external-icon
            classicon="i-lucide:heart"
            class="flex! relative z-10 text-xs text-fg-muted hover:text-pink-400 mt-1"
            :aria-label="$t('about.team.sponsor_aria', { name: person.login })"
          >
            {{ $t('about.team.sponsor') }}
          </LinkBase>
        </div>
      </div>
    </li>
  </ul>
</template>
