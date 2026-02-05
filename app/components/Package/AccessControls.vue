<script setup lang="ts">
import type { NewOperation } from '~/composables/useConnector'
import { buildScopeTeam } from '~/utils/npm/common'

const props = defineProps<{
  packageName: string
}>()

const {
  isConnected,
  lastExecutionTime,
  listOrgTeams,
  listPackageCollaborators,
  addOperation,
  error: connectorError,
} = useConnector()

// Extract org name from scoped package (e.g., "@nuxt/kit" -> "nuxt")
const orgName = computed(() => {
  if (!props.packageName.startsWith('@')) return null
  const match = props.packageName.match(/^@([^/]+)\//)
  return match ? match[1] : null
})

// Data
const collaborators = shallowRef<Record<string, 'read-only' | 'read-write'>>({})
const teams = shallowRef<string[]>([])
const isLoadingCollaborators = shallowRef(false)
const isLoadingTeams = shallowRef(false)
const error = shallowRef<string | null>(null)

// Grant access form
const showGrantAccess = shallowRef(false)
const selectedTeam = shallowRef('')
const permission = shallowRef<'read-only' | 'read-write'>('read-only')
const isGranting = shallowRef(false)

// Computed collaborator list with type detection
const collaboratorList = computed(() => {
  return Object.entries(collaborators.value)
    .map(([name, perm]) => {
      // Check if this looks like a team (org:team format) or user
      const isTeam = name.includes(':')
      return {
        name,
        permission: perm,
        isTeam,
        displayName: isTeam ? name.split(':')[1] : name,
      }
    })
    .sort((a, b) => {
      // Teams first, then users
      if (a.isTeam !== b.isTeam) return a.isTeam ? -1 : 1
      return a.name.localeCompare(b.name)
    })
})

// Load collaborators
async function loadCollaborators() {
  if (!isConnected.value) return

  isLoadingCollaborators.value = true
  error.value = null

  try {
    const result = await listPackageCollaborators(props.packageName)
    if (result) {
      collaborators.value = result
    } else {
      error.value = connectorError.value || 'Failed to load collaborators'
    }
  } finally {
    isLoadingCollaborators.value = false
  }
}

// Load teams for dropdown
async function loadTeams() {
  if (!isConnected.value || !orgName.value) return

  isLoadingTeams.value = true

  try {
    const result = await listOrgTeams(orgName.value)
    if (result) {
      // Teams come as "org:team" format, extract just the team name
      teams.value = result.map((t: string) => t.replace(`${orgName.value}:`, ''))
    }
  } finally {
    isLoadingTeams.value = false
  }
}

// Grant access
async function handleGrantAccess() {
  if (!selectedTeam.value || !orgName.value) return

  isGranting.value = true
  try {
    const scopeTeam = buildScopeTeam(orgName.value, selectedTeam.value)
    const operation: NewOperation = {
      type: 'access:grant',
      params: {
        permission: permission.value,
        scopeTeam,
        pkg: props.packageName,
      },
      description: `Grant ${permission.value} access to ${scopeTeam} for ${props.packageName}`,
      command: `npm access grant ${permission.value} ${scopeTeam} ${props.packageName}`,
    }

    await addOperation(operation)
    selectedTeam.value = ''
    showGrantAccess.value = false
  } finally {
    isGranting.value = false
  }
}

// Revoke access
async function handleRevokeAccess(collaboratorName: string) {
  // For teams, we use the full org:team format
  // For users... actually npm access revoke only works for teams
  // Users get access via maintainers/owners which is managed separately

  const operation: NewOperation = {
    type: 'access:revoke',
    params: {
      scopeTeam: collaboratorName,
      pkg: props.packageName,
    },
    description: `Revoke ${collaboratorName} access to ${props.packageName}`,
    command: `npm access revoke ${collaboratorName} ${props.packageName}`,
  }

  await addOperation(operation)
}

// Reload when package changes
watch(
  () => [isConnected.value, props.packageName, lastExecutionTime.value],
  ([connected]) => {
    if (connected && orgName.value) {
      loadCollaborators()
      loadTeams()
    }
  },
  { immediate: true },
)
</script>

<template>
  <section v-if="isConnected && orgName">
    <div class="flex items-center justify-between mb-3">
      <h2 id="access-heading" class="text-xs text-fg-subtle uppercase tracking-wider">
        {{ $t('package.access.title') }}
      </h2>
      <button
        type="button"
        class="p-1 text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70"
        :aria-label="$t('package.access.refresh')"
        :disabled="isLoadingCollaborators"
        @click="loadCollaborators"
      >
        <span
          class="i-carbon-renew w-3.5 h-3.5"
          :class="{ 'motion-safe:animate-spin': isLoadingCollaborators }"
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="isLoadingCollaborators && collaboratorList.length === 0" class="py-4 text-center">
      <span
        class="i-carbon-rotate-180 w-4 h-4 text-fg-muted animate-spin mx-auto"
        aria-hidden="true"
      />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-xs text-red-400 mb-2" role="alert">
      {{ error }}
    </div>

    <!-- Collaborators list -->
    <ul
      v-if="collaboratorList.length > 0"
      class="space-y-1 mb-3"
      :aria-label="$t('package.access.list_label')"
    >
      <li
        v-for="collab in collaboratorList"
        :key="collab.name"
        class="flex items-center justify-between py-1"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span
            v-if="collab.isTeam"
            class="i-carbon-group w-3.5 h-3.5 text-fg-subtle shrink-0"
            aria-hidden="true"
          />
          <span
            v-else
            class="i-carbon-user w-3.5 h-3.5 text-fg-subtle shrink-0"
            aria-hidden="true"
          />
          <span class="font-mono text-sm text-fg-muted truncate">
            {{ collab.isTeam ? collab.displayName : `@${collab.name}` }}
          </span>
          <span
            class="px-1 py-0.5 font-mono text-xs rounded shrink-0"
            :class="
              collab.permission === 'read-write'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-fg-subtle/20 text-fg-muted'
            "
          >
            {{
              collab.permission === 'read-write' ? $t('package.access.rw') : $t('package.access.ro')
            }}
          </span>
        </div>
        <!-- Only show revoke for teams (users are managed via owners) -->
        <button
          v-if="collab.isTeam"
          type="button"
          class="p-1 text-fg-subtle hover:text-red-400 transition-colors duration-200 shrink-0 rounded focus-visible:outline-accent/70"
          :aria-label="$t('package.access.revoke_access', { name: collab.displayName })"
          @click="handleRevokeAccess(collab.name)"
        >
          <span class="i-carbon-close w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <span v-else class="text-xs text-fg-subtle"> {{ $t('package.access.owner') }} </span>
      </li>
    </ul>

    <p v-else-if="!isLoadingCollaborators && !error" class="text-xs text-fg-subtle mb-3">
      {{ $t('package.access.no_access') }}
    </p>

    <!-- Grant access form -->
    <div v-if="showGrantAccess">
      <form class="space-y-2" @submit.prevent="handleGrantAccess">
        <div class="flex items-center gap-2">
          <label for="grant-team-select" class="sr-only">{{
            $t('package.access.select_team_label')
          }}</label>
          <select
            id="grant-team-select"
            v-model="selectedTeam"
            name="grant-team"
            class="flex-1 px-2 py-1.5 font-mono text-sm bg-bg-subtle border border-border rounded text-fg transition-colors duration-200 focus:border-border-hover"
            :disabled="isLoadingTeams"
          >
            <option value="" disabled>
              {{
                isLoadingTeams
                  ? $t('package.access.loading_teams')
                  : $t('package.access.select_team')
              }}
            </option>
            <option v-for="team in teams" :key="team" :value="team">
              {{ orgName }}:{{ team }}
            </option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label for="grant-permission-select" class="sr-only">{{
            $t('package.access.permission_label')
          }}</label>
          <select
            id="grant-permission-select"
            v-model="permission"
            name="grant-permission"
            class="flex-1 px-2 py-1.5 font-mono text-sm bg-bg-subtle border border-border rounded text-fg transition-colors duration-200 focus:border-border-hover"
          >
            <option value="read-only">{{ $t('package.access.permission.read_only') }}</option>
            <option value="read-write">{{ $t('package.access.permission.read_write') }}</option>
          </select>
          <button
            type="submit"
            :disabled="!selectedTeam || isGranting"
            class="px-3 py-1.5 font-mono text-xs text-bg bg-fg rounded transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-accent/70"
          >
            {{ isGranting ? '…' : $t('package.access.grant_button') }}
          </button>
          <button
            type="button"
            class="p-1.5 text-fg-subtle hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70"
            :aria-label="$t('package.access.cancel_grant')"
            @click="showGrantAccess = false"
          >
            <span class="i-carbon-close w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
    <button
      v-else
      type="button"
      class="w-full px-3 py-1.5 font-mono text-xs text-fg-muted bg-bg-subtle border border-border rounded transition-colors duration-200 hover:text-fg hover:border-border-hover focus-visible:outline-accent/70"
      @click="showGrantAccess = true"
    >
      {{ $t('package.access.grant_access') }}
    </button>
  </section>
</template>
