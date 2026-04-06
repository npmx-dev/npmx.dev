<script setup lang="ts">
import type { IconClass } from '~/types'
import type { CommandPaletteContextCommandInput } from '~/types/command-palette'

const props = defineProps<{
  pkg: SlimPackument
  jsrInfo?: JsrPackageInfo
}>()

const displayVersion = computed(() => props.pkg?.requestedVersion ?? null)
const { repositoryUrl } = useRepositoryUrl(displayVersion)
const { meta: repoMeta, repoRef, stars, starsLink, forks, forksLink } = useRepoMeta(repositoryUrl)
const compactNumberFormatter = useCompactNumberFormatter()

const homepageUrl = computed(() => {
  const homepage = displayVersion.value?.homepage
  if (!homepage) return null

  // Don't show homepage if it's the same as the repository URL
  if (repositoryUrl.value && areUrlsEquivalent(homepage, repositoryUrl.value)) {
    return null
  }

  return homepage
})

const PROVIDER_ICONS: Record<string, IconClass> = {
  github: 'i-simple-icons:github',
  gitlab: 'i-simple-icons:gitlab',
  bitbucket: 'i-simple-icons:bitbucket',
  codeberg: 'i-simple-icons:codeberg',
  gitea: 'i-simple-icons:gitea',
  forgejo: 'i-simple-icons:forgejo',
  gitee: 'i-simple-icons:gitee',
  sourcehut: 'i-simple-icons:sourcehut',
  tangled: 'i-custom:tangled',
  radicle: 'i-lucide:network', // Radicle is a P2P network, using network icon
}

const repoProviderIcon = computed((): IconClass => {
  const provider = repoRef.value?.provider
  if (!provider) return 'i-simple-icons:github'
  return PROVIDER_ICONS[provider] ?? 'i-lucide:code'
})

const repositoryCommandLabel = computed(() => {
  if (!repoRef.value) {
    return $t('package.links.repo')
  }

  const provider = repoRef.value.provider ? ` (${repoRef.value.provider})` : ''
  return `${$t('package.links.repo')}${provider}: ${repoRef.value.owner}/${repoRef.value.repo}`
})

useCommandPaletteContextCommands(
  computed(() => {
    const commands: CommandPaletteContextCommandInput[] = []
    const packageKeywords = [props.pkg.name]

    if (repositoryUrl.value) {
      commands.push({
        id: 'package-link-repo',
        group: 'links',
        label: repositoryCommandLabel.value,
        keywords: [
          ...packageKeywords,
          $t('package.links.repo'),
          repoRef.value?.provider ?? '',
          repoRef.value ? `${repoRef.value.owner}/${repoRef.value.repo}` : '',
        ],
        iconClass: repoProviderIcon.value,
        href: repositoryUrl.value,
      })
    }

    if (repositoryUrl.value && starsLink.value) {
      commands.push({
        id: 'package-link-stars',
        group: 'links',
        label: $t('command_palette.package_links.stars'),
        keywords: [...packageKeywords, $t('command_palette.package_links.stars')],
        iconClass: 'i-lucide:star',
        href: starsLink.value,
      })
    }

    if (forksLink.value) {
      commands.push({
        id: 'package-link-forks',
        group: 'links',
        label: $t('command_palette.package_links.forks'),
        keywords: [...packageKeywords, $t('command_palette.package_links.forks')],
        iconClass: 'i-lucide:git-fork',
        href: forksLink.value,
      })
    }

    if (homepageUrl.value) {
      commands.push({
        id: 'package-link-homepage',
        group: 'links',
        label: $t('package.links.homepage'),
        keywords: [...packageKeywords, $t('package.links.homepage')],
        iconClass: 'i-lucide:link',
        href: homepageUrl.value,
      })
    }

    if (displayVersion.value?.bugs?.url) {
      commands.push({
        id: 'package-link-issues',
        group: 'links',
        label: $t('package.links.issues'),
        keywords: [...packageKeywords, $t('package.links.issues')],
        iconClass: 'i-lucide:circle-alert',
        href: displayVersion.value!.bugs!.url!,
      })
    }

    commands.push({
      id: 'package-link-npm',
      group: 'links',
      label: 'npm',
      keywords: [...packageKeywords, $t('common.view_on.npm')],
      iconClass: 'i-simple-icons:npm',
      href: `https://www.npmjs.com/package/${props.pkg.name}`,
    })

    if (props.jsrInfo?.exists && props.jsrInfo.url) {
      commands.push({
        id: 'package-link-jsr',
        group: 'links',
        label: $t('package.links.jsr'),
        keywords: [...packageKeywords, $t('package.links.jsr')],
        iconClass: 'i-simple-icons:jsr',
        href: props.jsrInfo.url,
      })
    }

    return commands
  }),
)
</script>

<template>
  <ul class="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-4 list-none m-0 p-0 mt-3 text-sm">
    <li v-if="repositoryUrl">
      <LinkBase :to="repositoryUrl" :classicon="repoProviderIcon">
        <span v-if="repoRef">
          {{ repoRef.owner }}<span class="opacity-50">/</span>{{ repoRef.repo }}
        </span>
        <span v-else>{{ $t('package.links.repo') }}</span>
      </LinkBase>
    </li>
    <li v-if="repositoryUrl && repoMeta && starsLink">
      <LinkBase :to="starsLink" classicon="i-lucide:star">
        {{ compactNumberFormatter.format(stars) }}
      </LinkBase>
    </li>
    <li v-if="forks && forksLink">
      <LinkBase :to="forksLink" classicon="i-lucide:git-fork">
        {{ compactNumberFormatter.format(forks) }}
      </LinkBase>
    </li>
    <li class="basis-full sm:hidden" />
    <li v-if="homepageUrl">
      <LinkBase :to="homepageUrl" classicon="i-lucide:link">
        {{ $t('package.links.homepage') }}
      </LinkBase>
    </li>
    <li v-if="displayVersion?.bugs?.url">
      <LinkBase :to="displayVersion.bugs.url" classicon="i-lucide:circle-alert">
        {{ $t('package.links.issues') }}
      </LinkBase>
    </li>
    <li>
      <LinkBase
        :to="`https://www.npmjs.com/package/${pkg.name}`"
        :title="$t('common.view_on.npm')"
        classicon="i-simple-icons:npm"
      >
        npm
      </LinkBase>
    </li>
    <li v-if="jsrInfo?.exists && jsrInfo.url">
      <LinkBase :to="jsrInfo.url" :title="$t('badges.jsr.title')" classicon="i-simple-icons:jsr">
        {{ $t('package.links.jsr') }}
      </LinkBase>
    </li>
  </ul>
</template>
