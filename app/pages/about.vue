<script setup lang="ts">
import { SPONSORS } from '~/assets/logos/sponsors'
import { OSS_PARTNERS } from '~/assets/logos/oss-partners'

useSeoMeta({
  title: () => `${$t('about.title')} - npmx`,
  ogTitle: () => `${$t('about.title')} - npmx`,
  twitterTitle: () => `${$t('about.title')} - npmx`,
  description: () => $t('about.meta_description'),
  ogDescription: () => $t('about.meta_description'),
  twitterDescription: () => $t('about.meta_description'),
})

defineOgImage(
  'Page.takumi',
  {
    title: () => `${$t('about.title')}`,
    description: 'a fast, modern browser for the npm registry',
  },
  { alt: () => `${$t('about.title')} — npmx` },
)

const pmLinks = {
  npm: 'https://www.npmjs.com/',
  pnpm: 'https://pnpm.io/',
  yarn: 'https://yarnpkg.com/',
  bun: 'https://bun.sh/',
  deno: 'https://deno.com/',
  vlt: 'https://www.vlt.sh/',
}

const { data: contributors, status: contributorsStatus } = useLazyFetch('/api/contributors')

const governanceMembers = computed(
  () => contributors.value?.filter(c => c.role === 'steward' || c.role === 'core') ?? [],
)

const maintainersMembers = computed(
  () => contributors.value?.filter(c => c.role === 'maintainer') ?? [],
)

const communityContributors = computed(
  () => contributors.value?.filter(c => c.role === 'contributor') ?? [],
)
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('about.heading') }}
          </h1>
          <BackButton />
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
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('about.sponsors.title') }}
          </h2>
          <AboutLogoList
            :list="SPONSORS"
            class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 grid-flow-row-dense"
          />
        </div>

        <!-- OSS partners -->
        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('about.oss_partners.title') }}
          </h2>
          <AboutLogoList
            :list="OSS_PARTNERS"
            class="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-4 grid-flow-row-dense"
          />
        </div>

        <div>
          <h2 class="text-lg uppercase tracking-wider mb-4">
            {{ $t('about.team.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-6">
            {{ $t('about.contributors.description') }}
          </p>

          <!-- Governance: stewards + core -->
          <section v-if="governanceMembers.length" class="mb-12" aria-labelledby="core-heading">
            <h3 id="core-heading" class="text-sm text-fg uppercase tracking-wider mb-4">
              {{ $t('about.team.core') }}
            </h3>

            <AboutGovernanceList :members="governanceMembers" />
          </section>

          <!-- maintainers -->
          <section
            v-if="maintainersMembers.length"
            class="mb-12"
            aria-labelledby="maintainers-heading"
          >
            <h3 id="maintainers-heading" class="text-sm text-fg uppercase tracking-wider mb-4">
              {{ $t('about.team.maintainers') }}
            </h3>

            <AboutGovernanceList :members="maintainersMembers" />
          </section>

          <!-- Contributors cloud -->
          <section aria-labelledby="contributors-heading">
            <h3 id="contributors-heading" class="text-sm uppercase tracking-wider mb-4">
              {{
                $t(
                  'about.contributors.title',
                  { count: $n(communityContributors.length) },
                  communityContributors.length,
                )
              }}
            </h3>

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
              v-else-if="communityContributors.length"
              class="grid grid-cols-[repeat(auto-fill,48px)] justify-center gap-1 list-none p-0"
            >
              <li
                v-for="contributor in communityContributors"
                :key="contributor.id"
                class="block group relative hover:z-1"
              >
                <TooltipApp :text="`@${contributor.login}`" class="block" position="top">
                  <a
                    :href="contributor.html_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    :aria-label="$t('about.contributors.view_profile', { name: contributor.login })"
                    class="block rounded-lg"
                  >
                    <img
                      :src="`${contributor.avatar_url}&s=64`"
                      :alt="`${contributor.login}'s avatar`"
                      width="48"
                      height="48"
                      class="w-12 h-12 rounded-md ring-1 ring-transparent group-hover:ring-accent transition-all duration-200 ease-out"
                      loading="lazy"
                    />
                  </a>
                </TooltipApp>
              </li>
            </ul>
          </section>
        </div>

        <CallToAction />
      </section>
    </article>
  </main>
</template>
