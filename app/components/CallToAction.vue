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

    <div class="grid gap-4 sm:grid-cols-3 sm:items-stretch sm:grid-rows-[auto,1fr,auto]">
      <div
        class="group relative grid gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200 sm:grid-rows-subgrid sm:row-span-3 focus-within:ring-2 focus-within:ring-accent/50"
      >
        <h3 class="z-1 flex gap-2">
          <span class="i-carbon:logo-github shrink-0 mt-1 w-5 h-5 text-fg" aria-hidden="true" />
          <span class="font-medium text-fg">
            {{ $t('about.get_involved.contribute.title') }}
          </span>
        </h3>
        <p class="z-1 inline text-sm text-fg-muted leading-relaxed">
          {{ $t('about.get_involved.contribute.description') }}
        </p>
        <a
          :href="socialLinks.github"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-fg-muted group-hover:text-fg inline-flex items-center gap-1 mt-auto focus-visible:outline-none"
        >
          {{ $t('about.get_involved.contribute.cta') }}
          <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
          <span class="absolute z-0 inset-0" aria-hidden="true" />
        </a>
      </div>

      <div
        class="group relative grid gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200 sm:grid-rows-subgrid sm:row-span-3 focus-within:ring-2 focus-within:ring-accent/50"
      >
        <h3 class="z-1 flex gap-2">
          <span class="i-carbon:chat shrink-0 mt-1 w-5 h-5 text-fg" aria-hidden="true" />
          <span class="font-medium text-fg">
            {{ $t('about.get_involved.community.title') }}
          </span>
        </h3>
        <p class="z-1 inline text-sm text-fg-muted leading-relaxed">
          {{ $t('about.get_involved.community.description') }}
        </p>
        <a
          :href="socialLinks.discord"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-fg-muted group-hover:text-fg inline-flex items-center gap-1 mt-auto focus-visible:outline-none"
        >
          {{ $t('about.get_involved.community.cta') }}
          <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
          <span class="absolute z-0 inset-0" aria-hidden="true" />
        </a>
      </div>

      <div
        class="group relative grid gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200 sm:grid-rows-subgrid sm:row-span-3 focus-within:ring-2 focus-within:ring-accent/50"
      >
        <h3 class="z-1 flex gap-2">
          <span class="i-simple-icons:bluesky shrink-0 mt-1 w-5 h-5 text-fg" aria-hidden="true" />
          <span class="font-medium text-fg">
            {{ $t('about.get_involved.follow.title') }}
          </span>
        </h3>
        <p class="z-1 inline text-sm text-fg-muted leading-relaxed">
          {{ $t('about.get_involved.follow.description') }}
        </p>
        <a
          :href="socialLinks.bluesky"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-fg-muted group-hover:text-fg inline-flex items-center gap-1 mt-auto focus-visible:outline-none"
        >
          {{ $t('about.get_involved.follow.cta') }}
          <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
          <span class="absolute z-0 inset-0" aria-hidden="true" />
        </a>
      </div>
    </div>
  </div>
</template>
