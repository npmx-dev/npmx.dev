<script setup lang="ts">
import type { Role, GitHubContributor } from '#server/api/contributors.get'
import { SPONSORS } from '~/assets/logos/sponsors'
import { OSS_PARTNERS } from '~/assets/logos/oss-partners'

const router = useRouter()
const canGoBack = useCanGoBack()

useSeoMeta({
  title: () => `${$t('about.title')} - npmx`,
  ogTitle: () => `${$t('about.title')} - npmx`,
  twitterTitle: () => `${$t('about.title')} - npmx`,
  description: () => $t('about.meta_description'),
  ogDescription: () => $t('about.meta_description'),
  twitterDescription: () => $t('about.meta_description'),
})

defineOgImageComponent('Default', {
  primaryColor: '#60a5fa',
  title: 'about npmx',
  description: 'a fast, modern browser for the **npm registry**',
})

const isMounted = shallowRef(false)
onMounted(() => {
  isMounted.value = true
})

const pmLinks = {
  npm: 'https://www.npmjs.com/',
  pnpm: 'https://pnpm.io/',
  yarn: 'https://yarnpkg.com/',
  bun: 'https://bun.sh/',
  deno: 'https://deno.com/',
  vlt: 'https://www.vlt.sh/',
}

const { data, status: contributorsStatus } = useLazyFetch('/api/contributors')

function isExpandable(c: GitHubContributor) {
  const isGovernance = c.role === 'steward' || c.role === 'maintainer'
  return (
    isGovernance ||
    !!c.bio ||
    !!c.company ||
    !!c.name ||
    !!c.location ||
    !!c.twitterUsername ||
    !!c.websiteUrl ||
    !!c.blueskyHandle ||
    !!c.mastodonUrl
  )
}

function* mapContributors(
  c: GitHubContributor[],
): Generator<GitHubContributor & { expandable: boolean }> {
  for (const x of c) {
    yield {
      ...x,
      expandable: isExpandable(x),
    }
  }
}

const contributors = computed(() => [...mapContributors(data.value ?? [])])

const roleLabels = computed(
  () =>
    ({
      steward: $t('about.team.role_steward'),
      maintainer: $t('about.team.role_maintainer'),
    }) as Partial<Record<Role, string>>,
)

const activeContributor = shallowRef<GitHubContributor>()

function onBeforeToggleHoverCard(event: ToggleEvent & { source: HTMLElement }) {
  const { cid } = event.source.dataset
  const contributor = contributors.value.find(c => c.id === Number(cid))
  activeContributor.value = contributor
}
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('about.heading') }}
          </h1>
          <button
            v-if="canGoBack"
            type="button"
            class="cursor-pointer inline-flex items-center gap-2 p-1.5 -mx-1.5 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
            @click="router.back()"
          >
            <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="hidden sm:inline">{{ $t('nav.back') }}</span>
          </button>
        </div>
        <p class="text-fg-muted text-lg">
          {{ $t('tagline') }}
        </p>
      </header>

      <section class="max-w-none space-y-12">
        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('about.what_we_are.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="about.what_we_are.description" tag="span" scope="global">
              <template #betterUxDx>
                <strong class="text-fg">{{ $t('about.what_we_are.better_ux_dx') }}</strong>
              </template>
              <template #jsr>
                <LinkBase to="https://jsr.io/" no-new-tab-icon>JSR</LinkBase>
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
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
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
                    <LinkBase :to="pmLinks.npm" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.people')
                    }}</LinkBase>
                  </template>
                  <template #building>
                    <LinkBase :to="pmLinks.pnpm" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.building')
                    }}</LinkBase>
                  </template>
                  <template #really>
                    <LinkBase :to="pmLinks.yarn" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.really')
                    }}</LinkBase>
                  </template>
                  <template #cool>
                    <LinkBase :to="pmLinks.bun" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.cool')
                    }}</LinkBase>
                  </template>
                  <template #package>
                    <LinkBase :to="pmLinks.deno" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.package')
                    }}</LinkBase>
                  </template>
                  <template #managers>
                    <LinkBase :to="pmLinks.vlt" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.managers')
                    }}</LinkBase>
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

        <!-- Sponsors -->
        <div class="sponsors-logos">
          <h2 id="sponsors" class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('about.sponsors.title') }}
          </h2>
          <a
            href="#oss-partners"
            class="not-focus:sr-only absolute bg-bg-elevated rounded px-2 py-1 z-1"
            >{{ $t('about.skip_sponsors') }}</a
          >
          <AboutLogoList
            :list="SPONSORS"
            class="grid grid-cols-2 md:flex md:flex-row md:items-center"
          />
        </div>

        <!-- OSS partners -->
        <div>
          <h2 id="oss-partners" class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('about.oss_partners.title') }}
          </h2>
          <a href="#team" class="not-focus:sr-only absolute bg-bg-elevated rounded px-2 py-1 z-1">{{
            $t('about.skip_oss_partners')
          }}</a>
          <AboutLogoList :list="OSS_PARTNERS" class="items-center" />
        </div>

        <div>
          <h2 id="team" class="text-lg uppercase tracking-wider mb-4">
            {{ $t('about.team.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-6">
            {{ $t('about.contributors.description') }}
          </p>
          <section>
            <h3 id="contributors-heading" class="text-sm text-fg uppercase tracking-wider mb-4">
              {{
                $t(
                  'about.contributors.title',
                  { count: $n(contributors.length) },
                  contributors.length,
                )
              }}
            </h3>
            <a
              href="#get-involved"
              class="not-focus:sr-only absolute bg-bg-elevated rounded px-2 py-1 z-1"
              >{{ $t('about.skip_contributors') }}</a
            >

            <div
              v-if="contributorsStatus === 'pending'"
              class="text-fg-subtle text-sm"
              role="status"
            >
              {{ $t('about.contributors.loading') }}
            </div>
            <div
              v-else-if="contributorsStatus === 'error'"
              class="text-fg-subtle text-sm"
              role="alert"
            >
              {{ $t('about.contributors.error') }}
            </div>
            <ul
              v-else-if="contributors.length"
              class="flex flex-wrap justify-center gap-2 list-none p-0 overflow-visible"
            >
              <li
                v-for="contributor in contributors"
                :key="contributor.id"
                class="relative h-12 w-12 list-none group"
                style="contain: layout style"
              >
                <button
                  :data-cid="contributor.id"
                  class="group relative block h-12 w-12 rounded-lg transition-transform outline-none p-0 bg-transparent"
                  interestfor="contributor-hovercard"
                >
                  <img
                    :src="`${contributor.avatar_url}&s=64`"
                    :alt="contributor.login"
                    width="64"
                    height="64"
                    class="w-12 h-12 rounded-lg ring-2 ring-transparent transition-shadow duration-200 hover:ring-accent"
                  />
                </button>
              </li>
            </ul>
          </section>
        </div>
        <CallToAction />
      </section>
    </article>

    <article
      id="contributor-hovercard"
      popover="hint"
      aria-labelledby="contributor-hovercard-title"
      class="contributor-hovercard"
      @beforetoggle="onBeforeToggleHoverCard"
    >
      <div
        v-if="activeContributor"
        class="flex flex-col gap-y-3 w-64 rounded-xl border border-border-subtle bg-bg-elevated p-4 shadow-2xl text-start"
      >
        <div class="flex flex-col gap-2 min-w-0">
          <h4
            id="contributor-hovercard-title"
            class="w-full font-sans font-bold text-fg leading-tight truncate block"
          >
            {{ activeContributor.name || activeContributor.login }}
          </h4>
          <div
            v-if="roleLabels[activeContributor.role]"
            class="font-mono text-3xs uppercase tracking-wider text-accent font-bold"
          >
            {{ roleLabels[activeContributor.role] }}
          </div>
          <p
            v-if="activeContributor.bio"
            class="font-sans text-xs text-fg-subtle line-clamp-3 leading-relaxed"
          >
            "{{ activeContributor.bio }}"
          </p>
          <div
            v-if="activeContributor.companyHTML"
            class="flex items-center gap-1 font-sans text-2xs text-fg-muted min-w-0"
          >
            <div class="i-lucide:building-2 size-3 shrink-0 text-accent/80" aria-hidden="true" />
            <div
              class="leading-relaxed break-words min-w-0 [&_a]:(text-accent no-underline hover:underline)"
              v-html="activeContributor.companyHTML"
            />
          </div>
          <div
            v-else-if="activeContributor.company"
            class="flex items-center gap-1 font-sans text-2xs text-fg-muted min-w-0"
          >
            <div class="i-lucide:building-2 size-3 shrink-0 text-accent/80" aria-hidden="true" />
            <span>{{ activeContributor.company }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-2 text-3xs text-fg-subtle font-sans">
          <div v-if="activeContributor.location" class="flex items-center gap-1">
            <div class="i-lucide:map-pin size-3 shrink-0" aria-hidden="true" />
            <span class="truncate">{{ activeContributor.location }}</span>
          </div>
          <a
            v-if="activeContributor.websiteUrl"
            :href="activeContributor.websiteUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 hover:text-accent transition-colors"
          >
            <div class="i-lucide:link size-3 shrink-0" aria-hidden="true" />
            <span class="truncate">{{
              activeContributor.websiteUrl.replace(/^https?:\/\//, '')
            }}</span>
          </a>
          <a
            v-if="activeContributor.twitterUsername"
            :href="`https://x.com/${activeContributor.twitterUsername}`"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 hover:text-accent transition-colors"
          >
            <div class="i-simple-icons:x size-2.5 shrink-0" aria-hidden="true" />
            <span>@{{ activeContributor.twitterUsername }}</span>
          </a>
          <a
            v-if="activeContributor.blueskyHandle"
            :href="`https://bsky.app/profile/${activeContributor.blueskyHandle}`"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 hover:text-accent transition-colors"
          >
            <div class="i-simple-icons:bluesky size-2.5 shrink-0" aria-hidden="true" />
            <span>@{{ activeContributor.blueskyHandle }}</span>
          </a>
          <a
            v-if="activeContributor.mastodonUrl"
            :href="activeContributor.mastodonUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 hover:text-accent transition-colors"
          >
            <div class="i-simple-icons:mastodon size-2.5 shrink-0" aria-hidden="true" />
            <span class="truncate">{{
              activeContributor.mastodonUrl.replace(/^https?:\/\//, '').replace(/\/@?/, '@')
            }}</span>
          </a>
        </div>

        <div class="flex items-center justify-between border-t border-border-subtle pt-3">
          <a
            :href="activeContributor.html_url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-3xs text-fg-subtle font-mono hover:text-accent"
          >
            @{{ activeContributor.login }}
          </a>

          <a
            v-if="activeContributor.sponsors_url"
            :href="activeContributor.sponsors_url"
            :aria-label="$t('about.team.sponsor_aria', { name: activeContributor.login })"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 rounded border border-purple-700/30 bg-purple-700/5 text-purple-700 dark:border-purple-300/30 dark:bg-purple-300/5 dark:text-purple-300 px-2 py-0.5 text-4xs font-bold uppercase tracking-wider transition-colors hover:bg-purple-700/15 dark:hover:bg-purple-300/15"
          >
            <span class="i-lucide:heart size-3" aria-hidden="true" />
            <span>{{ $t('about.team.sponsor') }}</span>
          </a>
        </div>
      </div>
    </article>
  </main>
</template>

<style scoped>
[data-cid] {
  img {
    transition:
      box-shadow 100ms ease,
      transform 200ms ease;
  }

  &:interest-source {
    anchor-name: --contributor-link;
  }

  &:is(:hover, :interest-source) img {
    transform: scale(1.1);
    --un-ring-opacity: 1;
    --un-ring-color: color-mix(in srgb, var(--accent) var(--un-ring-opacity), transparent);
    box-shadow: 0 0 0 2px var(--un-ring-color);
  }

  &:focus-visible {
    outline: none;
    z-index: 20;

    img {
      transform: scale(1.1);
      --un-ring-opacity: 1;
      --un-ring-color: color-mix(in srgb, var(--accent) var(--un-ring-opacity), transparent);
      box-shadow: 0 0 0 2px var(--un-ring-color);
    }
  }
}

.contributor-hovercard:interest-target {
  inset: unset;
  margin: 8px;

  position: fixed;
  position-anchor: --contributor-link;
  position-area: block-end center;
  position-try-fallbacks: block-start;

  background-color: transparent;

  transition: opacity 100ms ease-out;

  @starting-style {
    opacity: 0;
  }
}
</style>
