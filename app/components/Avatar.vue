<script setup lang="ts">
const props = defineProps<{
  /** Username or organization name */
  name: string
  /** Type determines shape: user = circle, org = rounded square */
  type?: 'user' | 'org'
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}>()

const sizeClasses = {
  sm: 'size-8 text-sm',
  md: 'size-16 text-2xl',
  lg: 'size-24 text-4xl',
}

const avatarUrl = shallowRef<string | null>(null)
const isLoading = shallowRef(true)

// Fetch avatar URL based on type
// For users: use GitHub users API (returns 404 for orgs)
// For orgs: use GitHub orgs API (returns 404 for users)
async function fetchAvatarUrl(name: string, type: 'user' | 'org') {
  if (!import.meta.client) return null

  try {
    const endpoint =
      type === 'org'
        ? `https://api.github.com/orgs/${encodeURIComponent(name)}`
        : `https://api.github.com/users/${encodeURIComponent(name)}`

    const response = await fetch(endpoint)
    if (!response.ok) return null

    const data = await response.json()
    // For users endpoint, verify it's actually a User not an Organization
    if (type === 'user' && data.type !== 'User') return null
    // For orgs endpoint, verify it's actually an Organization
    if (type === 'org' && data.type !== 'Organization') return null

    return data.avatar_url ? `${data.avatar_url}&s=128` : null
  } catch {
    return null
  }
}

// Fetch avatar on mount and when props change
watch(
  [() => props.name, () => props.type],
  async ([name, type]) => {
    isLoading.value = true
    avatarUrl.value = await fetchAvatarUrl(name, type ?? 'user')
    isLoading.value = false
  },
  { immediate: true },
)

const sizeClass = computed(() => sizeClasses[props.size ?? 'md'])
const roundedClass = computed(() => (props.type === 'org' ? 'rounded-lg' : 'rounded-full'))
</script>

<template>
  <div
    :class="[
      sizeClass,
      roundedClass,
      'shrink-0 bg-bg-muted border border-border flex items-center justify-center overflow-hidden',
    ]"
    aria-hidden="true"
  >
    <img
      v-if="avatarUrl"
      :src="avatarUrl"
      :alt="name"
      class="w-full h-full object-cover"
      loading="lazy"
    />
    <span v-else class="text-fg-subtle font-mono">
      {{ name.charAt(0).toUpperCase() }}
    </span>
  </div>
</template>
