<script setup lang="ts">
interface GitHubContributor {
  login: string
  id: number
  avatar_url: string
  html_url: string
  contributions: number
}

useSeoMeta({
  title: () => `${$t('about.title')} - npmx`,
  description: () => $t('about.meta_description'),
})

defineOgImageComponent('Default', {
  primaryColor: '#60a5fa',
  title: 'About npmx',
  description: 'A better browser for the **npm registry**',
})

const pmLinks = {
  npm: 'https://www.npmjs.com/',
  pnpm: 'https://pnpm.io/',
  yarn: 'https://yarnpkg.com/',
  bun: 'https://bun.sh/',
  deno: 'https://deno.com/',
  vlt: 'https://www.vlt.sh/',
}

const socialLinks = {
  github: 'https://repo.npmx.dev',
  discord: 'https://chat.npmx.dev',
  bluesky: 'https://social.npmx.dev',
}

const { data: contributors, status: contributorsStatus } = useFetch<GitHubContributor[]>(
  '/api/contributors',
  {
    lazy: true,
  },
)
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <h1 class="font-mono text-3xl sm:text-4xl font-medium mb-4">{{ $t('about.heading') }}</h1>
        <p class="text-fg-muted text-lg">
          {{ $t('tagline') }}
        </p>
      </header>

      <section class="prose prose-invert max-w-none space-y-8">
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('about.what_we_are.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="about.what_we_are.description" tag="span" scope="global">
              <template #betterUxDx>
                <strong class="text-fg">{{ $t('about.what_we_are.better_ux_dx') }}</strong>
              </template>
              <template #jsr>
                <a
                  href="https://jsr.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link text-fg"
                  >JSR</a
                >
              </template>
            </i18n-t>
          </p>
          <p class="text-fg-muted leading-relaxed">
            <i18n-t keypath="about.what_we_are.admin_description" tag="span" scope="global">
              <template #adminUi>
                <strong class="text-fg">{{ $t('about.what_we_are.admin_ui') }}</strong>
              </template>
            </i18n-t>
          </p>
        </div>

        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('about.what_we_are_not.title') }}
          </h2>
          <ul class="space-y-3 text-fg-muted list-none p-0">
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>
                <strong class="text-fg">{{
                  $t('about.what_we_are_not.not_package_manager')
                }}</strong>
                {{ ' ' }}
                <i18n-t
                  keypath="about.what_we_are_not.package_managers_exist"
                  tag="span"
                  scope="global"
                >
                  <template #already>{{ $t('about.what_we_are_not.words.already') }}</template>
                  <template #people>
                    <a
                      :href="pmLinks.npm"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.people') }}</a
                    >
                  </template>
                  <template #building>
                    <a
                      :href="pmLinks.pnpm"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.building') }}</a
                    >
                  </template>
                  <template #really>
                    <a
                      :href="pmLinks.yarn"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.really') }}</a
                    >
                  </template>
                  <template #cool>
                    <a
                      :href="pmLinks.bun"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.cool') }}</a
                    >
                  </template>
                  <template #package>
                    <a
                      :href="pmLinks.deno"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.package') }}</a
                    >
                  </template>
                  <template #managers>
                    <a
                      :href="pmLinks.vlt"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.managers') }}</a
                    >
                  </template>
                </i18n-t>
              </span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>
                <strong class="text-fg">{{ $t('about.what_we_are_not.not_registry') }}</strong>
                {{ $t('about.what_we_are_not.registry_description') }}
              </span>
            </li>
          </ul>
        </div>

        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ contributors?.length ?? 0 }} {{ $t('about.contributors.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-6">
            {{ $t('about.contributors.description') }}
          </p>

          <!-- Contributors cloud -->
          <div v-if="contributorsStatus === 'pending'" class="text-fg-subtle text-sm">
            {{ $t('about.contributors.loading') }}
          </div>
          <div v-else-if="contributorsStatus === 'error'" class="text-fg-subtle text-sm">
            {{ $t('about.contributors.error') }}
          </div>
          <div v-else-if="contributors?.length" class="flex flex-wrap gap-2">
            <a
              v-for="contributor in contributors"
              :key="contributor.id"
              :href="contributor.html_url"
              target="_blank"
              rel="noopener noreferrer"
              class="group relative"
              :title="$t('about.contributors.view_profile', { name: contributor.login })"
            >
              <img
                :src="`${contributor.avatar_url}&s=64`"
                :alt="contributor.login"
                width="32"
                height="32"
                class="w-8 h-8 rounded-full ring-2 ring-transparent group-hover:ring-accent transition-all duration-200"
                loading="lazy"
              />
            </a>
          </div>
        </div>

        <!-- Get Involved CTAs -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-6">
            {{ $t('about.get_involved.title') }}
          </h2>

          <div class="grid gap-4 sm:grid-cols-3">
            <!-- Contribute CTA -->
            <a
              :href="socialLinks.github"
              target="_blank"
              rel="noopener noreferrer"
              class="group flex flex-col gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200"
            >
              <div class="flex gap-2">
                <span
                  class="i-carbon:logo-github shrink-0 mt-1 w-5 h-5 text-fg"
                  aria-hidden="true"
                />
                <span class="font-medium text-fg">{{
                  $t('about.get_involved.contribute.title')
                }}</span>
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

            <!-- Community CTA -->
            <a
              :href="socialLinks.discord"
              target="_blank"
              rel="noopener noreferrer"
              class="group flex flex-col gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200"
            >
              <div class="flex gap-2">
                <span class="i-carbon:chat shrink-0 mt-1 w-5 h-5 text-fg" aria-hidden="true" />
                <span class="font-medium text-fg">{{
                  $t('about.get_involved.community.title')
                }}</span>
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

            <!-- Follow CTA -->
            <a
              :href="socialLinks.bluesky"
              target="_blank"
              rel="noopener noreferrer"
              class="group flex flex-col gap-3 p-4 rounded-lg bg-bg-subtle hover:bg-bg-elevated border border-border hover:border-border-hover transition-all duration-200"
            >
              <div class="flex gap-2">
                <span
                  class="i-simple-icons:bluesky shrink-0 mt-1 w-5 h-5 text-fg"
                  aria-hidden="true"
                />
                <span class="font-medium text-fg">{{ $t('about.get_involved.follow.title') }}</span>
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
      </section>

      <footer class="mt-16 pt-8 border-t border-border">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-[color] duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        >
          <span class="i-carbon:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
          {{ $t('about.back_home') }}
        </NuxtLink>
      </footer>
    </article>
  </main>
</template>
