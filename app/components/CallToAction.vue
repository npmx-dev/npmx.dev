<script setup lang="ts">
const socialLinks = computed(() => [
  {
    id: 'github',
    href: 'https://repo.npmx.dev',
    icon: 'i-carbon:logo-github',
    titleKey: $t('about.get_involved.contribute.title'),
    descriptionKey: $t('about.get_involved.contribute.description'),
    ctaKey: $t('about.get_involved.contribute.cta'),
  },
  {
    id: 'discord',
    href: 'https://chat.npmx.dev',
    icon: 'i-carbon:chat',
    titleKey: $t('about.get_involved.community.title'),
    descriptionKey: $t('about.get_involved.community.description'),
    ctaKey: $t('about.get_involved.community.cta'),
  },
  {
    id: 'bluesky',
    href: 'https://social.npmx.dev',
    icon: 'i-simple-icons:bluesky',
    titleKey: $t('about.get_involved.follow.title'),
    descriptionKey: $t('about.get_involved.follow.description'),
    ctaKey: $t('about.get_involved.follow.cta'),
  },
])
</script>

<template>
  <div>
    <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-6">
      {{ $t('about.get_involved.title') }}
    </h2>

    <div class="grid gap-4 sm:grid-cols-3 sm:items-stretch sm:grid-rows-[auto,1fr,auto]">
      <a
        v-for="link in socialLinks"
        :key="link.id"
        :href="link.href"
        target="_blank"
        rel="noopener noreferrer"
        class="group grid gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200 sm:grid-rows-subgrid sm:row-span-3"
      >
        <div class="flex gap-2">
          <span :class="link.icon" class="shrink-0 mt-1 w-5 h-5 text-fg" aria-hidden="true" />
          <span class="font-medium text-fg">
            {{ link.titleKey }}
          </span>
        </div>
        <p class="text-sm text-fg-muted leading-relaxed">
          {{ link.descriptionKey }}
        </p>
        <span
          class="text-sm text-fg-muted group-hover:text-fg inline-flex items-center gap-1 mt-auto"
        >
          {{ link.ctaKey }}
          <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
        </span>
      </a>
    </div>
  </div>
</template>
