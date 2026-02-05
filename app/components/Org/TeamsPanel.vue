<script setup lang="ts">
import type { NewOperation } from '~/composables/useConnector'
import { buildScopeTeam } from '~/utils/npm/common'

const props = defineProps<{
  orgName: string
}>()

const {
  isConnected,
  lastExecutionTime,
  listOrgTeams,
  listOrgUsers,
  listTeamUsers,
  addOperation,
  error: connectorError,
} = useConnector()

// Teams data
const teams = shallowRef<string[]>([])
const teamUsers = ref<Record<string, string[]>>({})
const isLoadingTeams = shallowRef(false)
const isLoadingUsers = ref<Record<string, boolean>>({})
const error = shallowRef<string | null>(null)

// Org members (to check if user needs to be added to org first)
const orgMembers = shallowRef<Record<string, 'developer' | 'admin' | 'owner'>>({})

// Search/filter
const searchQuery = shallowRef('')
const sortBy = shallowRef<'name' | 'members'>('name')
const sortOrder = shallowRef<'asc' | 'desc'>('asc')

// Expanded teams (to show members)
const expandedTeams = ref<Set<string>>(new Set())

// Create team form
const showCreateTeam = shallowRef(false)
const newTeamName = shallowRef('')
const isCreatingTeam = shallowRef(false)

// Add user form (per team)
const showAddUserFor = shallowRef<string | null>(null)
const newUserUsername = shallowRef('')
const isAddingUser = shallowRef(false)

// Filtered and sorted teams
const filteredTeams = computed(() => {
  let result = teams.value

  // Filter by search
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(team => team.toLowerCase().includes(query))
  }

  // Sort
  result = [...result].sort((a, b) => {
    if (sortBy.value === 'name') {
      return sortOrder.value === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
    } else {
      const aCount = teamUsers.value[a]?.length ?? 0
      const bCount = teamUsers.value[b]?.length ?? 0
      return sortOrder.value === 'asc' ? aCount - bCount : bCount - aCount
    }
  })

  return result
})

// Load teams and org members
async function loadTeams() {
  if (!isConnected.value) return

  isLoadingTeams.value = true
  error.value = null

  try {
    // Load teams and org members in parallel
    const [teamsResult, membersResult] = await Promise.all([
      listOrgTeams(props.orgName),
      listOrgUsers(props.orgName),
    ])

    if (teamsResult) {
      // Teams come as "org:team" format, extract just the team name
      teams.value = teamsResult.map((t: string) => t.replace(`${props.orgName}:`, ''))
    } else {
      error.value = connectorError.value || 'Failed to load teams'
    }

    if (membersResult) {
      orgMembers.value = membersResult
    }
  } finally {
    isLoadingTeams.value = false
  }
}

// Load team members
async function loadTeamUsers(teamName: string) {
  if (!isConnected.value) return

  isLoadingUsers.value[teamName] = true

  try {
    const scopeTeam = buildScopeTeam(props.orgName, teamName)
    const result = await listTeamUsers(scopeTeam)
    if (result) {
      teamUsers.value[teamName] = result
    }
  } finally {
    isLoadingUsers.value[teamName] = false
  }
}

// Toggle team expansion
async function toggleTeam(teamName: string) {
  if (expandedTeams.value.has(teamName)) {
    expandedTeams.value.delete(teamName)
  } else {
    expandedTeams.value.add(teamName)
    // Load users if not already loaded
    if (!teamUsers.value[teamName]) {
      await loadTeamUsers(teamName)
    }
  }
  // Force reactivity
  expandedTeams.value = new Set(expandedTeams.value)
}

// Create team
async function handleCreateTeam() {
  if (!newTeamName.value.trim()) return

  isCreatingTeam.value = true
  try {
    const teamName = newTeamName.value.trim()
    const scopeTeam = buildScopeTeam(props.orgName, teamName)
    const operation: NewOperation = {
      type: 'team:create',
      params: { scopeTeam },
      description: `Create team ${scopeTeam}`,
      command: `npm team create ${scopeTeam}`,
    }

    await addOperation(operation)
    newTeamName.value = ''
    showCreateTeam.value = false
  } finally {
    isCreatingTeam.value = false
  }
}

// Destroy team
async function handleDestroyTeam(teamName: string) {
  const scopeTeam = buildScopeTeam(props.orgName, teamName)
  const operation: NewOperation = {
    type: 'team:destroy',
    params: { scopeTeam },
    description: `Destroy team ${scopeTeam}`,
    command: `npm team destroy ${scopeTeam}`,
  }

  await addOperation(operation)
}

// Add user to team (auto-invites to org if needed)
async function handleAddUser(teamName: string) {
  if (!newUserUsername.value.trim()) return

  isAddingUser.value = true
  try {
    const username = newUserUsername.value.trim().replace(/^@/, '')
    const scopeTeam = buildScopeTeam(props.orgName, teamName)

    let dependsOnId: string | undefined

    // If user is not in org, add them first with developer role
    const isInOrg = username in orgMembers.value
    if (!isInOrg) {
      const orgOperation: NewOperation = {
        type: 'org:add-user',
        params: {
          org: props.orgName,
          user: username,
          role: 'developer',
        },
        description: `Add @${username} to @${props.orgName} as developer`,
        command: `npm org set ${props.orgName} ${username} developer`,
      }
      const addedOp = await addOperation(orgOperation)
      if (addedOp) {
        dependsOnId = addedOp.id
      }
    }

    // Then add user to team (depends on org op if user wasn't in org)
    const teamOperation: NewOperation = {
      type: 'team:add-user',
      params: { scopeTeam, user: username },
      description: `Add @${username} to team ${teamName}`,
      command: `npm team add ${scopeTeam} ${username}`,
      dependsOn: dependsOnId,
    }
    await addOperation(teamOperation)

    newUserUsername.value = ''
    showAddUserFor.value = null
  } finally {
    isAddingUser.value = false
  }
}

// Remove user from team
async function handleRemoveUser(teamName: string, username: string) {
  const scopeTeam = buildScopeTeam(props.orgName, teamName)
  const operation: NewOperation = {
    type: 'team:rm-user',
    params: { scopeTeam, user: username },
    description: `Remove @${username} from ${scopeTeam}`,
    command: `npm team rm ${scopeTeam} ${username}`,
  }

  await addOperation(operation)
}

// Toggle sort
function toggleSort(field: 'name' | 'members') {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
}

// Load on mount when connected
watch(
  isConnected,
  connected => {
    if (connected) {
      loadTeams()
    }
  },
  { immediate: true },
)

// Refresh data when operations complete
watch(lastExecutionTime, () => {
  if (isConnected.value) {
    loadTeams()
  }
})
</script>

<template>
  <section v-if="isConnected" class="bg-bg-subtle border border-border rounded-lg overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-start p-4 border-b border-border">
      <h2 id="teams-heading" class="font-mono text-sm font-medium flex items-center gap-2">
        <span class="i-carbon:group w-4 h-4 text-fg-muted" aria-hidden="true" />
        {{ $t('org.teams.title') }}
        <span v-if="teams.length > 0" class="text-fg-muted">({{ teams.length }})</span>
      </h2>
      <span aria-hidden="true" class="flex-shrink-1 flex-grow-1" />
      <button
        type="button"
        class="p-1.5 text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70"
        :aria-label="$t('org.teams.refresh')"
        :disabled="isLoadingTeams"
        @click="loadTeams"
      >
        <span
          class="i-carbon:renew w-4 h-4"
          :class="{ 'animate-spin': isLoadingTeams }"
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- Search and sort -->
    <div class="flex items-center gap-2 p-3 border-b border-border bg-bg">
      <div class="flex-1 relative">
        <span
          class="absolute inset-is-2 top-1/2 -translate-y-1/2 i-carbon:search w-3.5 h-3.5 text-fg-subtle"
          aria-hidden="true"
        />
        <label for="teams-search" class="sr-only">{{ $t('org.teams.filter_label') }}</label>
        <input
          id="teams-search"
          v-model="searchQuery"
          type="search"
          name="teams-search"
          :placeholder="$t('org.teams.filter_placeholder')"
          v-bind="noCorrect"
          class="w-full ps-7 pe-2 py-1.5 font-mono text-sm bg-bg-subtle border border-border rounded text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-accent focus-visible:(outline-2 outline-accent/70)"
        />
      </div>
      <div
        class="flex items-center gap-1 text-xs"
        role="group"
        :aria-label="$t('org.teams.sort_by')"
      >
        <button
          type="button"
          class="px-2 py-1 font-mono rounded transition-colors duration-200 focus-visible:outline-accent/70"
          :class="sortBy === 'name' ? 'bg-bg-muted text-fg' : 'text-fg-muted hover:text-fg'"
          :aria-pressed="sortBy === 'name'"
          @click="toggleSort('name')"
        >
          {{ $t('common.sort.name') }}
          <span v-if="sortBy === 'name'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
        </button>
        <button
          type="button"
          class="px-2 py-1 font-mono rounded transition-colors duration-200 focus-visible:outline-accent/70"
          :class="sortBy === 'members' ? 'bg-bg-muted text-fg' : 'text-fg-muted hover:text-fg'"
          :aria-pressed="sortBy === 'members'"
          @click="toggleSort('members')"
        >
          {{ $t('common.sort.members') }}
          <span v-if="sortBy === 'members'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoadingTeams && teams.length === 0" class="p-8 text-center">
      <span
        class="i-carbon:rotate-180 w-5 h-5 text-fg-muted motion-safe:animate-spin mx-auto"
        aria-hidden="true"
      />
      <p class="font-mono text-sm text-fg-muted mt-2">{{ $t('org.teams.loading') }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="p-4 text-center" role="alert">
      <p class="font-mono text-sm text-red-400">
        {{ error }}
      </p>
      <button
        type="button"
        class="mt-2 font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70"
        @click="loadTeams"
      >
        {{ $t('common.try_again') }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="teams.length === 0" class="p-8 text-center">
      <p class="font-mono text-sm text-fg-muted">{{ $t('org.teams.no_teams') }}</p>
    </div>

    <!-- Teams list -->
    <ul v-else class="divide-y divide-border" :aria-label="$t('org.teams.list_label')">
      <li v-for="teamName in filteredTeams" :key="teamName" class="bg-bg">
        <!-- Team header -->
        <div
          class="flex items-center justify-start p-3 hover:bg-bg-subtle transition-colors duration-200"
        >
          <button
            type="button"
            class="flex-1 flex items-center gap-2 text-start rounded focus-visible:outline-accent/70"
            :aria-expanded="expandedTeams.has(teamName)"
            :aria-controls="`team-${teamName}-members`"
            @click="toggleTeam(teamName)"
          >
            <span
              class="w-4 h-4 transition-transform duration-200 rtl-flip"
              :class="[
                expandedTeams.has(teamName) ? 'i-carbon:chevron-down' : 'i-carbon:chevron-right',
                'text-fg-muted',
              ]"
              aria-hidden="true"
            />
            <span class="font-mono text-sm text-fg">{{ teamName }}</span>
            <span v-if="teamUsers[teamName]" class="font-mono text-xs text-fg-subtle">
              ({{
                $t(
                  'org.teams.member_count',
                  { count: teamUsers[teamName].length },
                  teamUsers[teamName].length,
                )
              }})
            </span>
            <span
              v-if="isLoadingUsers[teamName]"
              class="i-carbon:rotate-180 w-3 h-3 text-fg-muted motion-safe:animate-spin"
              aria-hidden="true"
            />
          </button>
          <span aria-hidden="true" class="flex-shrink-1 flex-grow-1" />
          <button
            type="button"
            class="p-1 text-fg-subtle hover:text-red-400 transition-colors duration-200 rounded focus-visible:outline-accent/70"
            :aria-label="$t('org.teams.delete_team', { name: teamName })"
            @click.stop="handleDestroyTeam(teamName)"
          >
            <span class="i-carbon:trash-can w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <!-- Expanded: Team members -->
        <div
          v-if="expandedTeams.has(teamName)"
          :id="`team-${teamName}-members`"
          class="ps-9 pe-3 pb-3"
        >
          <!-- Members list -->
          <ul
            v-if="teamUsers[teamName]?.length"
            class="space-y-1 mb-2"
            :aria-label="$t('org.teams.members_of', { team: teamName })"
          >
            <li
              v-for="user in teamUsers[teamName]"
              :key="user"
              class="flex items-center justify-start py-1 ps-2 pe-1 rounded hover:bg-bg-subtle transition-colors duration-200"
            >
              <NuxtLink
                :to="{ name: '~username', params: { username: user } }"
                class="font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200"
              >
                ~{{ user }}
              </NuxtLink>
              <span class="font-mono text-sm text-fg">{{ teamName }}</span>
              <button
                type="button"
                class="p-1 text-fg-subtle hover:text-red-400 transition-colors duration-200 rounded focus-visible:outline-accent/70"
                :aria-label="$t('org.teams.remove_user', { user })"
                @click="handleRemoveUser(teamName, user)"
              >
                <span class="i-carbon:close w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <p v-else-if="!isLoadingUsers[teamName]" class="font-mono text-xs text-fg-subtle py-1">
            {{ $t('org.teams.no_members') }}
          </p>

          <!-- Add user form -->
          <div v-if="showAddUserFor === teamName" class="mt-2">
            <form class="flex items-center gap-2" @submit.prevent="handleAddUser(teamName)">
              <label :for="`add-user-${teamName}`" class="sr-only">{{
                $t('org.teams.username_to_add', { team: teamName })
              }}</label>
              <input
                :id="`add-user-${teamName}`"
                v-model="newUserUsername"
                type="text"
                :name="`add-user-${teamName}`"
                :placeholder="$t('org.teams.username_placeholder')"
                v-bind="noCorrect"
                class="flex-1 px-2 py-1 font-mono text-sm bg-bg-subtle border border-border rounded text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-border-hover focus-visible:outline-accent/70"
              />
              <button
                type="submit"
                :disabled="!newUserUsername.trim() || isAddingUser"
                class="px-2 py-1 font-mono text-xs text-bg bg-fg rounded transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-accent/70"
              >
                {{ isAddingUser ? '…' : $t('org.teams.add_button') }}
              </button>
              <button
                type="button"
                class="p-1 text-fg-subtle hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70"
                :aria-label="$t('org.teams.cancel_add_user')"
                @click="showAddUserFor = null"
              >
                <span class="i-carbon:close w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>
          <button
            v-else
            type="button"
            class="mt-2 px-2 py-1 font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70"
            @click="showAddUserFor = teamName"
          >
            {{ $t('org.teams.add_member') }}
          </button>
        </div>
      </li>
    </ul>

    <!-- No results -->
    <div v-if="teams.length > 0 && filteredTeams.length === 0" class="p-4 text-center">
      <p class="font-mono text-sm text-fg-muted">
        {{ $t('org.teams.no_match', { query: searchQuery }) }}
      </p>
    </div>

    <!-- Create team -->
    <div class="p-3 border-t border-border">
      <div v-if="showCreateTeam">
        <form class="flex items-center gap-2" @submit.prevent="handleCreateTeam">
          <div class="flex-1 flex items-center">
            <span
              class="px-2 py-1.5 font-mono text-sm text-fg-subtle bg-bg border border-ie-0 border-border rounded-is"
            >
              {{ orgName }}:
            </span>
            <label for="new-team-name" class="sr-only">{{ $t('org.teams.team_name_label') }}</label>
            <input
              id="new-team-name"
              v-model="newTeamName"
              type="text"
              name="new-team-name"
              :placeholder="$t('org.teams.team_name_placeholder')"
              v-bind="noCorrect"
              class="flex-1 px-2 py-1.5 font-mono text-sm bg-bg border border-border rounded-ie text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-border-hover focus-visible:outline-accent/70"
            />
          </div>
          <button
            type="submit"
            :disabled="!newTeamName.trim() || isCreatingTeam"
            class="px-3 py-1.5 font-mono text-xs text-bg bg-fg rounded transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-accent/70"
          >
            {{ isCreatingTeam ? '…' : $t('org.teams.create_button') }}
          </button>
          <button
            type="button"
            class="p-1.5 text-fg-subtle hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70"
            :aria-label="$t('org.teams.cancel_create')"
            @click="showCreateTeam = false"
          >
            <span class="i-carbon:close w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </div>
      <button
        v-else
        type="button"
        class="w-full px-3 py-2 font-mono text-sm text-fg-muted bg-bg border border-border rounded transition-colors duration-200 hover:text-fg hover:border-border-hover focus-visible:outline-accent/70"
        @click="showCreateTeam = true"
      >
        {{ $t('org.teams.create_team') }}
      </button>
    </div>
  </section>
</template>
