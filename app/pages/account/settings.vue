<script setup lang="ts">
const { user } = useAtproto()

const newHandle = ref('')
const isCustomDomain = ref(false)
const customDomainInput = ref('')
const availableDomains = ref(['.bsky.social'])
const selectedDomain = ref('')

const isUpdatingHandle = ref(false)
const isConfirmingHandle = ref(false)
const handleError = ref('')
const handleSuccess = ref('')

useFetch('/api/atproto/server-info').then(({ data }) => {
  if (data.value) {
    const combined = ['.bsky.social', ...data.value]
    availableDomains.value = [...new Set(combined)]
    selectedDomain.value = availableDomains.value[0] || '.bsky.social'
  }
})

function initiateHandleUpdate() {
  handleError.value = ''
  handleSuccess.value = ''

  if (!isCustomDomain.value && !newHandle.value) {
    handleError.value = 'Please enter your new handle.'
    return
  }

  if (isCustomDomain.value && !customDomainInput.value) {
    handleError.value = 'Please enter your custom domain.'
    return
  }

  isConfirmingHandle.value = true
}

async function executeHandleUpdate() {
  isUpdatingHandle.value = true
  isConfirmingHandle.value = false

  const fullHandle = isCustomDomain.value
    ? customDomainInput.value
    : `${newHandle.value}${selectedDomain.value}`

  try {
    await $fetch('/api/atproto/handle-update', {
      method: 'POST',
      body: { handle: fullHandle },
    })

    handleSuccess.value = 'Handle updated successfully!'
  } catch (e: any) {
    handleError.value = e.statusMessage || 'Something went wrong. Please try again'
  } finally {
    isUpdatingHandle.value = false
  }
}

const newEmail = ref('')
const emailToken = ref('')

const isRequestingEmail = ref(false)
const isConfirmingEmail = ref(false)
const isEmailCodeSent = ref(false)
const emailError = ref('')
const emailSuccess = ref('')

async function requestEmailChange() {
  emailError.value = ''
  emailSuccess.value = ''
  isRequestingEmail.value = true

  try {
    await $fetch('/api/atproto/email-update-request', { method: 'POST' })
    isEmailCodeSent.value = true
    emailSuccess.value = 'Code sent! Check your current email inbox.'
  } catch (e: any) {
    emailError.value = e.statusMessage || 'Something went wrong. Please try again.'
  } finally {
    isRequestingEmail.value = false
  }
}

async function confirmEmailChange() {
  emailError.value = ''
  emailSuccess.value = ''

  if (!emailToken.value || !newEmail.value) {
    emailError.value = 'Please enter both the code and your new email address'
    return
  }

  isConfirmingEmail.value = true
  try {
    await $fetch('/api/atproto/email-update-confirm', {
      method: 'POST',
      body: { token: emailToken.value, email: newEmail.value },
    })

    emailSuccess.value = 'Email address updated successfully!'

    isEmailCodeSent.value = false
    emailToken.value = ''
    newEmail.value = ''
  } catch (e: any) {
    emailError.value = e.statusMessage || 'Failed to update email. Check your code.'
  } finally {
    isConfirmingEmail.value = false
  }
}

const passwordEmail = ref('')
const newPassword = ref('')
const passwordToken = ref('')

const isRequestingPassword = ref(false)
const isConfirmingPassword = ref(false)
const isPasswordCodeSent = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

async function requestPasswordReset() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (!passwordEmail.value) {
    passwordError.value = 'Please enter your email first.'
    return
  }

  isRequestingPassword.value = true
  try {
    await $fetch('/api/atproto/password-reset', {
      method: 'POST',
      body: { email: passwordEmail.value },
    })

    isPasswordCodeSent.value = true
    passwordSuccess.value = 'Code sent! Check your email.'
  } catch (e: any) {
    passwordError.value = e.statusMessage || 'Something went wrong. Please try again.'
  } finally {
    isRequestingPassword.value = false
  }
}

async function confirmPasswordReset() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (!passwordToken.value || !newPassword.value) {
    passwordError.value = 'Please enter both the code and your new password.'
    return
  }

  isConfirmingPassword.value = true
  try {
    await $fetch('/api/atproto/password-reset-confirm', {
      method: 'POST',
      body: { token: passwordToken.value, password: newPassword.value },
    })

    passwordSuccess.value = 'Password updated successfully!'

    isPasswordCodeSent.value = false
    passwordToken.value = ''
    newPassword.value = ''
    passwordEmail.value = ''
  } catch (e: any) {
    passwordError.value = e.statusMessage || 'Failed to update password. Check your code.'
  } finally {
    isConfirmingPassword.value = false
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
          Your handle is your unique identifier on the AT Protocol.
        </p>

        <p v-if="handleError" class="text-sm text-red-500 mb-2">{{ handleError }}</p>
        <p v-if="handleSuccess" class="text-sm text-green-500 mb-2">{{ handleSuccess }}</p>

        <label class="flex items-center gap-2 mb-4 text-sm text-fg cursor-pointer w-fit">
          <input type="checkbox" v-model="isCustomDomain" class="accent-accent" />
          I have my own custom domain
        </label>

        <div v-if="!isCustomDomain" class="flex flex-wrap items-center gap-4">
          <input
            v-model="newHandle"
            type="text"
            class="flex-1 bg-bg border border-border rounded-md px-3 py-2 font-mono text-sm max-w-md"
            placeholder="username"
          />
          <select
            v-model="selectedDomain"
            class="bg-bg border border-border rounded-md px-3 py-2 text-sm text-fg outline-none"
          >
            <option v-for="domain in availableDomains" :key="domain" :value="domain">
              {{ domain }}
            </option>
          </select>
          <ButtonBase
            v-if="!isConfirmingHandle"
            variant="primary"
            :disabled="isUpdatingHandle"
            @click="initiateHandleUpdate"
          >
            {{ isUpdatingHandle ? 'Updating...' : 'Save' }}
          </ButtonBase>

          <div v-else class="flex items-center gap-2 shrink-0">
            <ButtonBase
              variant="primary"
              class="bg-red-500 hover:bg-red-600 text-white border-none whitespace-nowrap"
              @click="executeHandleUpdate"
            >
              Yes, change it
            </ButtonBase>
            <ButtonBase
              variant="secondary"
              class="whitespace-nowrap"
              @click="isConfirmingHandle = false"
            >
              Cancel
            </ButtonBase>
          </div>
        </div>

        <div v-else class="flex flex-col gap-4">
          <div class="flex gap-4">
            <input
              v-model="customDomainInput"
              type="text"
              class="flex-1 bg-bg border border-border rounded-md px-3 py-2 font-mono text-sm max-w-md"
              placeholder="e.g., paulie.codes"
            />
            <ButtonBase
              v-if="!isConfirmingHandle"
              variant="primary"
              :disabled="isUpdatingHandle"
              @click="initiateHandleUpdate"
            >
              {{ isUpdatingHandle ? 'Updating...' : 'Save' }}
            </ButtonBase>

            <div v-else class="flex items-center gap-2">
              <ButtonBase
                variant="primary"
                class="bg-red-500 hover:bg-red-600 text-white border-none"
                @click="executeHandleUpdate"
              >
                Yes, change it
              </ButtonBase>
              <ButtonBase variant="secondary" @click="isConfirmingHandle = false">
                Cancel
              </ButtonBase>
            </div>
          </div>
          <div class="p-4 bg-bg border border-border rounded-md text-sm text-fg-muted">
            <p class="font-medium text-fg mb-1">How to verify your domain:</p>
            <ol class="list-decimal ms-4 space-y-1">
              <li>Go to your domain registrar (e.g., Namecheap, GoDaddy).</li>
              <li>Add a <strong>TXT</strong> record.</li>
              <li>Set the Host/Name to: <code>_atproto</code></li>
              <li>
                Set the Value to: <code>did={{ user?.did }}</code>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section class="p-6 bg-bg-subtle border border-border rounded-lg flex flex-col gap-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="font-mono text-xl mb-1">Email Address</h2>
            <p class="text-sm text-fg-muted">Update the email address of your account.</p>
          </div>

          <ButtonBase
            v-if="!isEmailCodeSent"
            variant="secondary"
            :disabled="isRequestingEmail"
            @click="requestEmailChange"
          >
            {{ isRequestingEmail ? 'Requesting...' : 'Request Email Change' }}
          </ButtonBase>
        </div>

        <p v-if="emailError" class="text-sm text-red-500">{{ emailError }}</p>
        <p v-if="emailSuccess" class="text-sm text-green-500">{{ emailSuccess }}</p>

        <div v-if="isEmailCodeSent" class="max-w-sm">
          <div class="flex flex-col gap-2">
            <input
              v-model="emailToken"
              type="text"
              placeholder="Reset Code (e.g. ABC-DEF)"
              class="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-fg focus:border-accent outline-none"
            />
            <input
              v-model="newEmail"
              type="email"
              placeholder="new@example.com"
              class="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-fg focus:border-accent outline-none"
            />
            <ButtonBase
              variant="primary"
              class="mt-2"
              :disabled="isConfirmingEmail || !emailToken || !newEmail"
              @click="confirmEmailChange"
            >
              {{ isConfirmingEmail ? 'Saving...' : 'Save New Email' }}
            </ButtonBase>

            <ButtonBase
              variant="secondary"
              @click="
                isEmailCodeSent = false
                emailSuccess = ''
                emailError = ''
              "
            >
              Cancel
            </ButtonBase>
          </div>
        </div>
      </section>

      <section
        class="flex flex-col gap-2 max-w-sm p-4 border border-border rounded-lg bg-bg-subtle"
      >
        <h3 class="font-mono text-lg text-fg">Reset Password</h3>

        <p v-if="passwordError" class="text-sm text-red-500 mb-2">{{ passwordError }}</p>
        <p v-if="passwordSuccess" class="text-sm text-green-500 mb-2">{{ passwordSuccess }}</p>

        <div v-if="!isPasswordCodeSent">
          <p class="text-sm text-fg-muted mb-2">
            Enter your atmosphere email to receive a reset link.
          </p>
          <input
            v-model="passwordEmail"
            type="email"
            placeholder="you@example.com"
            class="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-fg focus:border-accent outline-none mb-2"
          />
          <ButtonBase
            variant="secondary"
            class="text-red-500 mt-2"
            :disabled="isRequestingPassword || !passwordEmail"
            @click="requestPasswordReset"
          >
            {{ isRequestingPassword ? 'Sending...' : 'Send Reset Code' }}
          </ButtonBase>
        </div>

        <div v-else class="flex flex-col gap-2">
          <input
            v-model="passwordToken"
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
            :disabled="isConfirmingPassword || !passwordToken || !newPassword"
            @click="confirmPasswordReset"
          >
            {{ isConfirmingPassword ? 'Saving...' : 'Save New Password' }}
          </ButtonBase>

          <ButtonBase
            variant="secondary"
            @click="
              isPasswordCodeSent = false
              passwordSuccess = ''
              passwordError = ''
            "
          >
            Cancel
          </ButtonBase>
        </div>
      </section>
    </div>
  </main>
</template>
