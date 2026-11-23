<script setup lang="ts">
import type { NuxtError } from 'nuxt/app'

const { pkgName, changelogLink, viewOnGit, error } = defineProps<{
  pkgName?: string
  changelogLink: string
  viewOnGit: string
  error?: NuxtError
}>()
</script>

<template>
  <div class="w-full flex items-center flex-col gap-2 mt-4">
    <template v-if="isGithubRateLimitError(error)">
      <p>{{ $t('changelog.rate_limit') }}</p>
    </template>
    <template v-else>
      <p>{{ $t('changelog.error.p1', { package: pkgName }) }}</p>
      <i18n-t keypath="changelog.error.p2" tag="p" #viewon>
        <LinkBase :to="changelogLink" class="lowercase">{{ viewOnGit }}</LinkBase>
      </i18n-t>
    </template>
  </div>
</template>
