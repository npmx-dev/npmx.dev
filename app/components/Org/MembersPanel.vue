<script setup lang="ts">
import type { NewOperation } from '~/composables/useConnector'
import { buildScopeTeam } from '~/utils/npm'

const props = defineProps<{
  orgName: string
}>()

const emit = defineEmits<{
  'select-team': [teamName: string]
}>()

const {
  isConnected,
  lastExecutionTime,
  listOrgUsers,
  listOrgTeams,
  listTeamUsers,
  addOperation,
  error: connectorError,
} = useConnector()

// Members data: { username: role }
const members = shallowRef<Record<string, 'developer' | 'admin' | 'owner'>>({})
const isLoading = shallowRef(false)
const error = shallowRef<string | null>(null)

// Team membership data: { teamName: [members] }
const teamMembers = ref<Record<string, string[]>>({})
const isLoadingTeams = shallowRef(false)

// Search/filter
const searchQuery = shallowRef('')
const filterRole = shallowRef<'all' | 'developer' | 'admin' | 'owner'>('all')
const filterTeam = shallowRef<string | null>(null)
const sortBy = shallowRef<'name' | 'role'>('name')
const sortOrder = shallowRef<'asc' | 'desc'>('asc')

// Add member form
const showAddMember = shallowRef(false)
const newUsername = shallowRef('')
const newRole = shallowRef<'developer' | 'admin' | 'owner'>('developer')
const newTeam = shallowRef<string>('') // Empty string means "developers" (default)
const isAddingMember = shallowRef(false)

// Role priority for sorting
const rolePriority = { owner: 0, admin: 1, developer: 2 }

// Get teams a member belongs to
function getMemberTeams(username: string): string[] {
  const teams: string[] = []
  for (const [team, membersList] of Object.entries(teamMembers.value)) {
    if (membersList.includes(username)) {
      teams.push(team)
    }
  }
  return teams.sort()
}

// All team names (for filter dropdown)
const teamNames = computed(() => Object.keys(teamMembers.value).sort())

// Computed member list with teams
const memberList = computed(() => {
  return Object.entries(members.value).map(([name, role]) => ({
    name,
    role,
    teams: getMemberTeams(name),
  }))
})

// Filtered and sorted members
const filteredMembers = computed(() => {
  let result = memberList.value

  // Filter by search
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(m => m.name.toLowerCase().includes(query))
  }

  // Filter by role
  if (filterRole.value !== 'all') {
    result = result.filter(m => m.role === filterRole.value)
  }

  // Filter by team
  if (filterTeam.value) {
    result = result.filter(m => m.teams.includes(filterTeam.value!))
  }

  // Sort
  result = [...result].sort((a, b) => {
    if (sortBy.value === 'name') {
      return sortOrder.value === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    } else {
      const diff = rolePriority[a.role] - rolePriority[b.role]
      return sortOrder.value === 'asc' ? diff : -diff
    }
  })

  return result
})

// Role counts
const roleCounts = computed(() => {
  const counts = { developer: 0, admin: 0, owner: 0 }
  for (const role of Object.values(members.value)) {
    counts[role]++
  }
  return counts
})

// Refresh all data
function refreshData() {
  loadMembers()
  loadTeamMemberships()
}

// Load members
async function loadMembers() {
  if (!isConnected.value) return

  isLoading.value = true
  error.value = null

  try {
    const result = await listOrgUsers(props.orgName)
    if (result) {
      members.value = result
    } else {
      error.value = connectorError.value || 'Failed to load members'
    }
  } finally {
    isLoading.value = false
  }
}

// Load all teams and their members
async function loadTeamMemberships() {
  if (!isConnected.value) return

  isLoadingTeams.value = true

  try {
    const teamsResult = await listOrgTeams(props.orgName)
    if (teamsResult) {
      // Teams come as "org:team" format from npm, need @scope:team for API calls
      const teamPromises = teamsResult.map(async (fullTeamName: string) => {
        const teamName = fullTeamName.replace(`${props.orgName}:`, '')
        const membersResult = await listTeamUsers(buildScopeTeam(props.orgName, teamName))
        if (membersResult) {
          teamMembers.value[teamName] = membersResult
        }
      })
      await Promise.all(teamPromises)
    }
  } finally {
    isLoadingTeams.value = false
  }
}

// Add member (with optional team assignment)
async function handleAddMember() {
  if (!newUsername.value.trim()) return

  isAddingMember.value = true
  try {
    const username = newUsername.value.trim().replace(/^@/, '')

    // First operation: add user to org
    const orgOperation: NewOperation = {
      type: 'org:add-user',
      params: {
        org: props.orgName,
        user: username,
        role: newRole.value,
      },
      description: `Add @${username} to @${props.orgName} as ${newRole.value}`,
      command: `npm org set ${props.orgName} ${username} ${newRole.value}`,
    }
    const addedOrgOp = await addOperation(orgOperation)

    // Second operation: add user to team (if a team is selected)
    // This depends on the org operation completing first
    if (newTeam.value && addedOrgOp) {
      const scopeTeam = buildScopeTeam(props.orgName, newTeam.value)
      const teamOperation: NewOperation = {
        type: 'team:add-user',
        params: {
          scopeTeam,
          user: username,
        },
        description: `Add @${username} to team ${newTeam.value}`,
        command: `npm team add ${scopeTeam} ${username}`,
        dependsOn: addedOrgOp.id,
      }
      await addOperation(teamOperation)
    }

    newUsername.value = ''
    newTeam.value = ''
    showAddMember.value = false
  } finally {
    isAddingMember.value = false
  }
}

// Remove member
async function handleRemoveMember(username: string) {
  const operation: NewOperation = {
    type: 'org:rm-user',
    params: {
      org: props.orgName,
      user: username,
    },
    description: `Remove @${username} from @${props.orgName}`,
    command: `npm org rm ${props.orgName} ${username}`,
  }

  await addOperation(operation)
}

// Change role
async function handleChangeRole(username: string, newRoleValue: 'developer' | 'admin' | 'owner') {
  const operation: NewOperation = {
    type: 'org:add-user',
    params: {
      org: props.orgName,
      user: username,
      role: newRoleValue,
    },
    description: `Change @${username} role to ${newRoleValue} in @${props.orgName}`,
    command: `npm org set ${props.orgName} ${username} ${newRoleValue}`,
  }

  await addOperation(operation)
}

// Toggle sort
function toggleSort(field: 'name' | 'role') {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
}

// Role badge color
function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'owner':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'admin':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    default:
      return 'bg-fg-subtle/20 text-fg-muted border-border'
  }
}

// Click on team badge to switch to teams tab and highlight
function handleTeamClick(teamName: string) {
  emit('select-team', teamName)
}

// Load on mount when connected
watch(
  isConnected,
  connected => {
    if (connected) {
      loadMembers()
      loadTeamMemberships()
    }
  },
  { immediate: true },
)

// Refresh data when operations complete
watch(lastExecutionTime, () => {
  if (isConnected.value) {
    loadMembers()
    loadTeamMemberships()
  }
})
</script>

<template>
  <section v-if="isConnected" class="bg-bg-subtle border border-border rounded-lg overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-border">
      <h2 id="members-heading" class="font-mono text-sm font-medium flex items-center gap-2">
        <span class="i-carbon:user-multiple w-4 h-4 text-fg-muted" aria-hidden="true" />
        {{ $t('org.members.title') }}
        <span v-if="memberList.length > 0" class="text-fg-muted">({{ memberList.length }})</span>
      </h2>
      <button
        type="button"
        class="p-1.5 text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        :aria-label="$t('org.members.refresh')"
        :disabled="isLoading"
        @click="refreshData"
      >
        <span
          class="i-carbon:renew block w-4 h-4"
          :class="{ 'motion-safe:animate-spin': isLoading || isLoadingTeams }"
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- Search, filter, sort -->
    <div class="flex flex-wrap items-center gap-2 p-3 border-b border-border bg-bg">
      <div class="flex-1 min-w-[150px] relative">
        <span
          class="absolute inset-is-2 top-1/2 -translate-y-1/2 i-carbon:search w-3.5 h-3.5 text-fg-subtle"
          aria-hidden="true"
        />
        <label for="members-search" class="sr-only">{{ $t('org.members.filter_label') }}</label>
        <input
          id="members-search"
          v-model="searchQuery"
          type="search"
          name="members-search"
          :placeholder="$t('org.members.filter_placeholder')"
          v-bind="noCorrect"
          class="w-full ps-7 pe-2 py-1.5 font-mono text-sm bg-bg-subtle border border-border rounded text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        />
      </div>
      <div
        class="flex items-center gap-1"
        role="group"
        :aria-label="$t('org.members.filter_by_role')"
      >
        <button
          v-for="role in ['all', 'owner', 'admin', 'developer'] as const"
          :key="role"
          type="button"
          class="px-2 py-1 font-mono text-xs rounded transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          :class="filterRole === role ? 'bg-bg-muted text-fg' : 'text-fg-muted hover:text-fg'"
          :aria-pressed="filterRole === role"
          @click="filterRole = role"
        >
          {{ $t(`org.members.role.${role}`) }}
          <span v-if="role !== 'all'" class="text-fg-subtle">({{ roleCounts[role] }})</span>
        </button>
      </div>
      <!-- Team filter -->
      <div v-if="teamNames.length > 0">
        <label for="team-filter" class="sr-only">{{ $t('org.members.filter_by_team') }}</label>
        <select
          id="team-filter"
          v-model="filterTeam"
          name="team-filter"
          class="px-2 py-1 font-mono text-xs bg-bg-subtle border border-border rounded text-fg transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        >
          <option :value="null">{{ $t('org.members.all_teams') }}</option>
          <option v-for="team in teamNames" :key="team" :value="team">
            {{ team }}
          </option>
        </select>
      </div>
      <div
        class="flex items-center gap-1 text-xs"
        role="group"
        :aria-label="$t('org.members.sort_by')"
      >
        <button
          type="button"
          class="px-2 py-1 font-mono rounded transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          :class="sortBy === 'name' ? 'bg-bg-muted text-fg' : 'text-fg-muted hover:text-fg'"
          :aria-pressed="sortBy === 'name'"
          @click="toggleSort('name')"
        >
          {{ $t('common.sort.name') }}
          <span v-if="sortBy === 'name'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
        </button>
        <button
          type="button"
          class="px-2 py-1 font-mono rounded transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          :class="sortBy === 'role' ? 'bg-bg-muted text-fg' : 'text-fg-muted hover:text-fg'"
          :aria-pressed="sortBy === 'role'"
          @click="toggleSort('role')"
        >
          {{ $t('common.sort.role') }}
          <span v-if="sortBy === 'role'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading && memberList.length === 0" class="p-8 text-center">
      <span
        class="i-carbon:rotate-180 block w-5 h-5 text-fg-muted animate-spin mx-auto"
        aria-hidden="true"
      />
      <p class="font-mono text-sm text-fg-muted mt-2">{{ $t('org.members.loading') }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="p-4 text-center" role="alert">
      <p class="font-mono text-sm text-red-400">
        {{ error }}
      </p>
      <button
        type="button"
        class="mt-2 font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        @click="loadMembers"
      >
        {{ $t('common.try_again') }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="memberList.length === 0" class="p-8 text-center">
      <p class="font-mono text-sm text-fg-muted">{{ $t('org.members.no_members') }}</p>
    </div>

    <!-- Members list -->
    <ul
      v-else
      class="divide-y divide-border max-h-[400px] overflow-y-auto"
      :aria-label="$t('org.members.list_label')"
    >
      <li
        v-for="member in filteredMembers"
        :key="member.name"
        class="flex flex-col gap-2 p-3 bg-bg hover:bg-bg-subtle transition-colors duration-200"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <NuxtLink
              :to="{ name: '~username', params: { username: member.name } }"
              class="font-mono text-sm text-fg hover:text-fg transition-colors duration-200"
            >
              ~{{ member.name }}
            </NuxtLink>
            <span
              class="px-1.5 py-0.5 font-mono text-xs border rounded"
              :class="getRoleBadgeClass(member.role)"
            >
              {{ member.role }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <!-- Role selector -->
            <label :for="`role-${member.name}`" class="sr-only">{{
              $t('org.members.change_role_for', { name: member.name })
            }}</label>
            <select
              :id="`role-${member.name}`"
              :value="member.role"
              :name="`role-${member.name}`"
              class="px-1.5 py-0.5 font-mono text-xs bg-bg-subtle border border-border rounded text-fg transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 cursor-pointer"
              @change="
                handleChangeRole(
                  member.name,
                  ($event.target as HTMLSelectElement).value as 'developer' | 'admin' | 'owner',
                )
              "
            >
              <option value="developer">{{ $t('org.members.role.developer') }}</option>
              <option value="admin">{{ $t('org.members.role.admin') }}</option>
              <option value="owner">{{ $t('org.members.role.owner') }}</option>
            </select>
            <!-- Remove button -->
            <button
              type="button"
              class="p-1 text-fg-subtle hover:text-red-400 transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
              :aria-label="$t('org.members.remove_from_org', { name: member.name })"
              @click="handleRemoveMember(member.name)"
            >
              <span class="i-carbon:close block w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <!-- Team badges -->
        <div v-if="member.teams.length > 0" class="flex flex-wrap gap-1 ps-0">
          <button
            v-for="team in member.teams"
            :key="team"
            type="button"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-xs text-fg-muted border border-border rounded hover:text-fg hover:border-border-hover transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            :aria-label="$t('org.members.view_team', { team })"
            @click="handleTeamClick(team)"
          >
            {{ team }}
          </button>
        </div>
      </li>
    </ul>

    <!-- No results -->
    <div v-if="memberList.length > 0 && filteredMembers.length === 0" class="p-4 text-center">
      <p class="font-mono text-sm text-fg-muted">{{ $t('org.members.no_match') }}</p>
    </div>

    <!-- Add member -->
    <div class="p-3 border-t border-border">
      <div v-if="showAddMember">
        <form class="space-y-2" @submit.prevent="handleAddMember">
          <label for="new-member-username" class="sr-only">{{
            $t('org.members.username_label')
          }}</label>
          <input
            id="new-member-username"
            v-model="newUsername"
            type="text"
            name="new-member-username"
            :placeholder="$t('org.members.username_placeholder')"
            v-bind="noCorrect"
            class="w-full px-2 py-1.5 font-mono text-sm bg-bg border border-border rounded text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          />
          <div class="flex items-center gap-2">
            <label for="new-member-role" class="sr-only">{{ $t('org.members.role_label') }}</label>
            <select
              id="new-member-role"
              v-model="newRole"
              name="new-member-role"
              class="flex-1 px-2 py-1.5 font-mono text-sm bg-bg border border-border rounded text-fg transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            >
              <option value="developer">{{ $t('org.members.role.developer') }}</option>
              <option value="admin">{{ $t('org.members.role.admin') }}</option>
              <option value="owner">{{ $t('org.members.role.owner') }}</option>
            </select>
            <!-- Team selection -->
            <label for="new-member-team" class="sr-only">{{ $t('org.members.team_label') }}</label>
            <select
              id="new-member-team"
              v-model="newTeam"
              name="new-member-team"
              class="flex-1 px-2 py-1.5 font-mono text-sm bg-bg border border-border rounded text-fg transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            >
              <option value="">{{ $t('org.members.no_team') }}</option>
              <option v-for="team in teamNames" :key="team" :value="team">
                {{ team }}
              </option>
            </select>
            <button
              type="submit"
              :disabled="!newUsername.trim() || isAddingMember"
              class="px-3 py-1.5 font-mono text-xs text-bg bg-fg rounded transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            >
              {{ isAddingMember ? '…' : $t('org.members.add_button') }}
            </button>
            <button
              type="button"
              class="p-1.5 text-fg-subtle hover:text-fg transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
              :aria-label="$t('org.members.cancel_add')"
              @click="showAddMember = false"
            >
              <span class="i-carbon:close block w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
      <button
        v-else
        type="button"
        class="w-full px-3 py-2 font-mono text-sm text-fg-muted bg-bg border border-border rounded transition-colors duration-200 hover:text-fg hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        @click="showAddMember = true"
      >
        {{ $t('org.members.add_member') }}
      </button>
    </div>
  </section>
</template>
