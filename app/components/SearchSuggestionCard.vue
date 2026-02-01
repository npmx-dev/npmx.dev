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
  <article
    class="group card-interactive relative focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-bg focus-within:ring-offset-2 focus-within:ring-fg/50 focus-within:bg-bg-muted focus-within:border-border-hover"
    :class="{
      'border-accent/30 bg-accent/5': isExactMatch,
    }"
  >
    <!-- Glow effect for exact matches -->
    <div
      v-if="isExactMatch"
      class="absolute -inset-px rounded-lg bg-gradient-to-r from-accent/0 via-accent/20 to-accent/0 opacity-100 blur-sm -z-1 pointer-events-none motion-reduce:opacity-50"
      aria-hidden="true"
    />
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
  </article>
</template>
