<script setup lang="ts">
const socialLinks = computed(() => [
  {
    id: 'github',
    href: 'https://repo.npmx.dev',
    icon: 'i-simple-icons:github',
    titleKey: $t('about.get_involved.contribute.title'),
    descriptionKey: $t('about.get_involved.contribute.description'),
    ctaKey: $t('about.get_involved.contribute.cta'),
  },
  {
    id: 'discord',
    href: 'https://chat.npmx.dev',
    icon: 'i-lucide:message-circle',
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

function handleCardClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest(':any-link')) return
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return

  const selection = window.getSelection()
  if (selection && selection.type === 'Range') return

  const card = event.currentTarget as HTMLElement
  const link = card.querySelector('a')
  link?.click()
}
</script>

<template>
  <div>
    <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-6">
      {{ $t('about.get_involved.title') }}
    </h2>

    <div class="grid gap-4 sm:grid-cols-3 sm:items-stretch sm:grid-rows-[auto,1fr,auto]">
      <div
        v-for="link in socialLinks"
        :key="link.id"
        @click="handleCardClick"
        class="cursor-pointer group relative grid gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200 sm:grid-rows-subgrid sm:row-span-3 focus-within:ring-2 focus-within:ring-accent/50"
      >
        <h3 class="flex gap-2">
          <span :class="link.icon" class="shrink-0 mt-1 w-5 h-5 text-fg" aria-hidden="true" />
          <span class="font-medium text-fg">
            {{ link.titleKey }}
          </span>
        </h3>
        <p class="text-sm text-fg-muted leading-relaxed">
          {{ link.descriptionKey }}
        </p>
        <a
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-fg-muted group-hover:text-fg inline-flex items-center gap-1 mt-auto focus-visible:outline-none"
        >
          {{ link.ctaKey }}
          <span class="i-lucide:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  </div>
</template>
