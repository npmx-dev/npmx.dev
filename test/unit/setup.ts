import { vi } from 'vitest'

// `nuxt/app` loads build-time virtual modules, which unit tests do not have.
vi.mock('nuxt/app', async () => {
  const { createError } = await import('nitro/h3')
  return { createError }
})
