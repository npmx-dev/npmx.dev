<script setup lang="ts">
const socialLinks = {
  github: 'https://repo.npmx.dev',
  discord: 'https://chat.npmx.dev',
  bluesky: 'https://social.npmx.dev',
}
</script>

<template>
  <div>
    <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-6">
      {{ $t('about.get_involved.title') }}
    </h2>

    <div class="grid gap-4 sm:grid-cols-3">
      <a
        :href="socialLinks.github"
        target="_blank"
        rel="noopener noreferrer"
        class="group flex flex-col gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200"
      >
        <div class="flex gap-2">
          <span class="i-carbon:logo-github shrink-0 mt-1 w-5 h-5 text-fg" aria-hidden="true" />
          <span class="font-medium text-fg">
            {{ $t('about.get_involved.contribute.title') }}
          </span>
        </div>
        <p class="text-sm text-fg-muted leading-relaxed">
          {{ $t('about.get_involved.contribute.description') }}
        </p>
        <span
          class="text-sm text-fg-muted group-hover:text-fg inline-flex items-center gap-1 mt-auto"
        >
          {{ $t('about.get_involved.contribute.cta') }}
          <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
        </span>
      </a>

      <a
        :href="socialLinks.discord"
        target="_blank"
        rel="noopener noreferrer"
        class="group flex flex-col gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200"
      >
        <div class="flex gap-2">
          <span class="i-carbon:chat shrink-0 mt-1 w-5 h-5 text-fg" aria-hidden="true" />
          <span class="font-medium text-fg">
            {{ $t('about.get_involved.community.title') }}
          </span>
        </div>
        <p class="text-sm text-fg-muted leading-relaxed">
          {{ $t('about.get_involved.community.description') }}
        </p>
        <span
          class="text-sm text-fg-muted group-hover:text-fg inline-flex items-center gap-1 mt-auto"
        >
          {{ $t('about.get_involved.community.cta') }}
          <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
        </span>
      </a>

      <a
        :href="socialLinks.bluesky"
        target="_blank"
        rel="noopener noreferrer"
        class="group flex flex-col gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200"
      >
        <div class="flex gap-2">
          <span class="i-simple-icons:bluesky shrink-0 mt-1 w-5 h-5 text-fg" aria-hidden="true" />
          <span class="font-medium text-fg">
            {{ $t('about.get_involved.follow.title') }}
          </span>
        </div>
        <p class="text-sm text-fg-muted leading-relaxed">
          {{ $t('about.get_involved.follow.description') }}
        </p>
        <span
          class="text-sm text-fg-muted group-hover:text-fg inline-flex items-center gap-1 mt-auto"
        >
          {{ $t('about.get_involved.follow.cta') }}
          <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
        </span>
      </a>
    </div>
  </div>
</template>
