<script setup lang="ts">
defineProps<{
  /** Type of suggestion: 'user' or 'org' */
  type: 'user' | 'org'
  /** The name (username or org name) */
  name: string
  /** Whether this is an exact match for the query */
  isExactMatch?: boolean
  /** Index for keyboard navigation */
  index?: number
}>()
</script>

<template>
  <BaseCard :isExactMatch="isExactMatch">
    <NuxtLink
      :to="type === 'user' ? `/~${name}` : `/@${name}`"
      :data-suggestion-index="index"
      class="flex items-center gap-4 focus-visible:outline-none after:content-[''] after:absolute after:inset-0"
    >
      <!-- Avatar placeholder -->
      <div
        class="w-10 h-10 shrink-0 flex items-center justify-center border border-border"
        :class="type === 'org' ? 'rounded-lg bg-bg-muted' : 'rounded-full bg-bg-muted'"
        aria-hidden="true"
      >
        <span class="text-lg text-fg-subtle font-mono">{{ name.charAt(0).toUpperCase() }}</span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span
            class="font-mono text-sm sm:text-base font-medium text-fg group-hover:text-fg transition-colors"
            dir="ltr"
          >
            {{ type === 'user' ? '~' : '@' }}{{ name }}
          </span>
          <span
            class="text-xs px-1.5 py-0.5 rounded bg-bg-muted border border-border text-fg-muted font-mono"
          >
            {{ type === 'user' ? $t('search.suggestion.user') : $t('search.suggestion.org') }}
          </span>
          <!-- Exact match badge -->
          <span
            v-if="isExactMatch"
            class="text-xs px-1.5 py-0.5 rounded bg-accent/20 border border-accent/30 text-accent font-mono"
          >
            {{ $t('search.exact_match') }}
          </span>
        </div>
        <p class="text-xs sm:text-sm text-fg-muted mt-0.5">
          {{
            type === 'user'
              ? $t('search.suggestion.view_user_packages')
              : $t('search.suggestion.view_org_packages')
          }}
        </p>
      </div>

      <span
        class="i-carbon:arrow-right rtl-flip w-4 h-4 text-fg-subtle group-hover:text-fg transition-colors shrink-0"
        aria-hidden="true"
      />
    </NuxtLink>
  </BaseCard>
</template>
