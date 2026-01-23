<script setup lang="ts">
import type { NewOperation } from '~/composables/useConnector'

const props = defineProps<{
  packageName: string
  maintainers?: Array<{ name?: string, email?: string }>
}>()

const {
  isConnected,
  lastExecutionTime,
  npmUser,
  addOperation,
  listPackageCollaborators,
  listTeamUsers,
} = useConnector()

const showAddOwner = ref(false)
const newOwnerUsername = ref('')
const isAdding = ref(false)

// Show admin controls when connected (let npm CLI handle permission errors)
const canManageOwners = computed(() => isConnected.value)

// Extract org name from scoped package
const orgName = computed(() => {
  if (!props.packageName.startsWith('@')) return null
  const match = props.packageName.match(/^@([^/]+)\//)
  return match ? match[1] : null
})

// Access data: who has access and via what
const collaborators = ref<Record<string, 'read-only' | 'read-write'>>({})
const teamMembers = ref<Record<string, string[]>>({}) // team -> members
const isLoadingAccess = ref(false)

// Compute access source for each maintainer
const maintainerAccess = computed(() => {
  if (!props.maintainers) return []

  return props.maintainers.map((maintainer) => {
    const name = maintainer.name
    if (!name) return { ...maintainer, accessVia: [] as string[] }

    const accessVia: string[] = []

    // Check if they're a direct owner (in collaborators as a user, not team)
    if (collaborators.value[name]) {
      accessVia.push('owner')
    }

    // Check which teams they're in that have access
    for (const [collab, _perm] of Object.entries(collaborators.value)) {
      // Teams are in format "org:team"
      if (collab.includes(':')) {
        const teamName = collab.split(':')[1]
        const members = teamMembers.value[collab]
        if (members?.includes(name)) {
          accessVia.push(teamName || collab)
        }
      }
    }

    // If no specific access found, they're likely an owner
    if (accessVia.length === 0) {
      accessVia.push('owner')
    }

    return { ...maintainer, accessVia }
  })
})

// Load access information
async function loadAccessInfo() {
  if (!isConnected.value) return

  isLoadingAccess.value = true

  try {
    // Get collaborators (teams and users with access)
    const collabResult = await listPackageCollaborators(props.packageName)
    if (collabResult) {
      collaborators.value = collabResult

      // For each team collaborator, load its members
      const teamPromises: Promise<void>[] = []
      for (const collab of Object.keys(collabResult)) {
        if (collab.includes(':')) {
          teamPromises.push(
            listTeamUsers(collab).then((members: string[] | null) => {
              if (members) {
                teamMembers.value[collab] = members
              }
            }),
          )
        }
      }
      await Promise.all(teamPromises)
    }
  }
  finally {
    isLoadingAccess.value = false
  }
}

async function handleAddOwner() {
  if (!newOwnerUsername.value.trim()) return

  isAdding.value = true
  try {
    const username = newOwnerUsername.value.trim().replace(/^@/, '')
    const operation: NewOperation = {
      type: 'owner:add',
      params: {
        user: username,
        pkg: props.packageName,
      },
      description: `Add @${username} as owner of ${props.packageName}`,
      command: `npm owner add ${username} ${props.packageName}`,
    }

    await addOperation(operation)
    newOwnerUsername.value = ''
    showAddOwner.value = false
  }
  finally {
    isAdding.value = false
  }
}

async function handleRemoveOwner(username: string) {
  const operation: NewOperation = {
    type: 'owner:rm',
    params: {
      user: username,
      pkg: props.packageName,
    },
    description: `Remove @${username} from ${props.packageName}`,
    command: `npm owner rm ${username} ${props.packageName}`,
  }

  await addOperation(operation)
}

// Load access info when connected and for scoped packages
watch([isConnected, () => props.packageName], ([connected]) => {
  if (connected && orgName.value) {
    loadAccessInfo()
  }
}, { immediate: true })

// Refresh data when operations complete
watch(lastExecutionTime, () => {
  if (isConnected.value && orgName.value) {
    loadAccessInfo()
  }
})
</script>

<template>
  <section
    v-if="maintainers?.length"
    aria-labelledby="maintainers-heading"
  >
    <h2
      id="maintainers-heading"
      class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
    >
      Maintainers
    </h2>
    <ul
      class="space-y-2 list-none m-0 p-0"
      aria-label="Package maintainers"
    >
      <li
        v-for="maintainer in maintainerAccess.slice(0, canManageOwners ? undefined : 5)"
        :key="maintainer.name ?? maintainer.email"
        class="flex items-center justify-between gap-2"
      >
        <div class="flex items-center gap-2 min-w-0">
          <NuxtLink
            v-if="maintainer.name"
            :to="{ name: '~username', params: { username: maintainer.name } }"
            class="link-subtle font-mono text-sm shrink-0"
          >
            @{{ maintainer.name }}
          </NuxtLink>
          <span
            v-else
            class="font-mono text-sm text-fg-muted"
          >{{ maintainer.email }}</span>

          <!-- Access source badges -->
          <span
            v-if="isConnected && maintainer.accessVia?.length && !isLoadingAccess"
            class="text-xs text-fg-subtle truncate"
          >
            via {{ maintainer.accessVia.join(', ') }}
          </span>
          <span
            v-if="canManageOwners && maintainer.name === npmUser"
            class="text-xs text-fg-subtle shrink-0"
          >(you)</span>
        </div>

        <!-- Remove button (only when can manage and not self) -->
        <button
          v-if="canManageOwners && maintainer.name && maintainer.name !== npmUser"
          type="button"
          class="p-1 text-fg-subtle hover:text-red-400 transition-colors duration-200 shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          :aria-label="`Remove ${maintainer.name} as owner`"
          @click="handleRemoveOwner(maintainer.name)"
        >
          <span
            class="i-carbon-close block w-3.5 h-3.5"
            aria-hidden="true"
          />
        </button>
      </li>
    </ul>

    <!-- Add owner form (only when can manage) -->
    <div
      v-if="canManageOwners"
      class="mt-3"
    >
      <div v-if="showAddOwner">
        <form
          class="flex items-center gap-2"
          @submit.prevent="handleAddOwner"
        >
          <label
            for="add-owner-username"
            class="sr-only"
          >Username to add as owner</label>
          <input
            id="add-owner-username"
            v-model="newOwnerUsername"
            type="text"
            name="add-owner-username"
            placeholder="username…"
            autocomplete="off"
            spellcheck="false"
            class="flex-1 px-2 py-1 font-mono text-sm bg-bg-subtle border border-border rounded text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          >
          <button
            type="submit"
            :disabled="!newOwnerUsername.trim() || isAdding"
            class="px-2 py-1 font-mono text-xs text-bg bg-fg rounded transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          >
            {{ isAdding ? '…' : 'add' }}
          </button>
          <button
            type="button"
            class="p-1 text-fg-subtle hover:text-fg transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            aria-label="Cancel adding owner"
            @click="showAddOwner = false"
          >
            <span
              class="i-carbon-close block w-4 h-4"
              aria-hidden="true"
            />
          </button>
        </form>
      </div>
      <button
        v-else
        type="button"
        class="w-full px-3 py-1.5 font-mono text-xs text-fg-muted bg-bg-subtle border border-border rounded transition-colors duration-200 hover:text-fg hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        @click="showAddOwner = true"
      >
        + Add owner
      </button>
    </div>
  </section>
</template>
