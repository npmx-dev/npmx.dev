import type { ProviderId } from '#imports'
import type { IconClass } from '~/types/icon'
import { computed, toValue } from 'vue'

const PROVIDER_ICONS: Record<ProviderId, IconClass> = {
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

export function useProviderIcon(provider: MaybeRefOrGetter<ProviderId | null | undefined>) {
  return computed((): IconClass => {
    const uProvider = toValue(provider)
    if (!uProvider) return 'i-simple-icons:github'
    return PROVIDER_ICONS[uProvider] ?? 'i-lucide:code'
  })
}
