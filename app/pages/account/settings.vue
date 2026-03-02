<script setup lang="ts">
const { user } = useAtproto()

const isResetting = ref(false)
const resetEmail = ref('')
const isCodeSent = ref(false)
const resetToken = ref('')
const newPassword = ref('')
const isConfirming = ref(false)

const errorMessage = ref('')
const successMessage = ref('')

async function handlePasswordReset() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!resetEmail.value) {
    errorMessage.value = 'Please enter your email first.'
    return
  }

  isResetting.value = true
  try {
    await $fetch('/api/atproto/password-reset', {
      method: 'POST',
      body: { email: resetEmail.value },
    })

    isCodeSent.value = true
    successMessage.value = 'Code sent! Check your email.'
  } catch (e: any) {
    errorMessage.value = e.statusMessage || 'Something went wrong. Please try again.'
  } finally {
    isResetting.value = false
  }
}

async function handleConfirmReset() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!resetToken.value || !newPassword.value) {
    errorMessage.value = 'Please enter both the code and your new password.'
    return
  }

  isConfirming.value = true
  try {
    await $fetch('/api/atproto/password-reset-confirm', {
      method: 'POST',
      body: {
        token: resetToken.value,
        password: newPassword.value,
      },
    })

    successMessage.value = 'Password updated successfully!'

    // Reset the form
    isCodeSent.value = false
    resetToken.value = ''
    newPassword.value = ''
    resetEmail.value = ''
  } catch (e: any) {
    errorMessage.value = e.statusMessage || 'Failed to update password. Check your code.'
  } finally {
    isConfirming.value = false
  }
}
</script>

<template>
  <main class="container py-8 sm:py-12 w-full max-w-3xl mx-auto flex flex-col gap-8">
    <header class="flex flex-col gap-4 pb-4 border-b border-border">
      <div>
        <LinkBase
          :to="`/profile/${user?.handle}`"
          classicon="i-lucide:arrow-left"
          class="text-sm text-fg-muted hover:text-fg mb-4 inline-flex items-center gap-2"
        >
          Back to Profile
        </LinkBase>
        <h1 class="font-mono text-2xl sm:text-3xl font-medium">PDS Account Settings</h1>
        <p class="text-fg-muted mt-2">
          Manage your underlying identity, handle, and security credentials.
        </p>
      </div>
    </header>

    <div class="flex flex-col gap-6">
      <section class="p-6 bg-bg-subtle border border-border rounded-lg">
        <h2 class="font-mono text-xl mb-2">Change Handle</h2>
        <p class="text-sm text-fg-muted mb-4">
          Your handle is your unique identifier on the AT Protocol. Changing it will update your
          identity across the network.
        </p>
        <div class="flex gap-4">
          <input
            type="text"
            class="flex-1 bg-bg border border-border rounded-md px-3 py-2 font-mono text-sm max-w-md"
            :placeholder="user?.handle || 'New handle...'"
          />
          <ButtonBase variant="primary">Update Handle</ButtonBase>
        </div>
      </section>

      <section
        class="p-6 bg-bg-subtle border border-border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h2 class="font-mono text-xl mb-1">Email Address</h2>
          <p class="text-sm text-fg-muted">Update the email address of your account.</p>
        </div>
        <ButtonBase variant="secondary">Request Email Change</ButtonBase>
      </section>

      <section
        class="flex flex-col gap-2 max-w-sm p-4 border border-border rounded-lg bg-bg-subtle"
      >
        <h3 class="font-mono text-lg text-fg">Reset Password</h3>

        <p v-if="errorMessage" class="text-sm text-red-500 mb-2">{{ errorMessage }}</p>
        <p v-if="successMessage" class="text-sm text-green-500 mb-2">{{ successMessage }}</p>

        <div v-if="!isCodeSent">
          <p class="text-sm text-fg-muted mb-2">
            Enter your atmosphere email to receive a reset link.
          </p>
          <input
            v-model="resetEmail"
            type="email"
            placeholder="you@example.com"
            class="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-fg focus:border-accent outline-none mb-2"
          />
          <ButtonBase
            variant="secondary"
            class="text-red-500 mt-2"
            :disabled="isResetting || !resetEmail"
            @click="handlePasswordReset"
          >
            {{ isResetting ? 'Sending...' : 'Send Reset Code' }}
          </ButtonBase>
        </div>

        <div v-else class="flex flex-col gap-2">
          <input
            v-model="resetToken"
            type="text"
            placeholder="Reset Code (e.g. ABC-DEF)"
            class="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-fg focus:border-accent outline-none"
          />

          <input
            v-model="newPassword"
            type="password"
            placeholder="New Password"
            class="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-fg focus:border-accent outline-none"
          />

          <ButtonBase
            variant="secondary"
            class="text-red-500 mt-2"
            :disabled="isConfirming || !resetToken || !newPassword"
            @click="handleConfirmReset"
          >
            {{ isConfirming ? 'Saving...' : 'Save New Password' }}
          </ButtonBase>
        </div>
      </section>
    </div>
  </main>
</template>
