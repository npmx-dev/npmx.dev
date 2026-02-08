import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ALL_ENV_VARS = [
  'CONTEXT',
  'VERCEL_ENV',
  'URL',
  'NUXT_ENV_VERCEL_URL',
  'NUXT_ENV_VERCEL_PROJECT_PRODUCTION_URL',
]

describe('getPreviewUrl', () => {
  beforeEach(() => {
    // Reset consts evaluated at module init time
    vi.resetModules()
  })

  beforeEach(() => {
    for (const envVar of ALL_ENV_VARS) {
      vi.stubEnv(envVar, undefined)
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns `undefined` if no known preview env is detected', async () => {
    const { getPreviewUrl } = await import('../../../config/env')

    expect(getPreviewUrl()).toBeUndefined()
  })

  it.each([
    ['Netlify production', { CONTEXT: 'production', URL: 'https://prod.example.com' }],
    ['Vercel production', { VERCEL_ENV: 'production', NUXT_ENV_VERCEL_URL: 'prod.example.com' }],
  ])('%s environment returns `undefined`', async (_name, envVars) => {
    for (const [key, value] of Object.entries(envVars)) {
      vi.stubEnv(key, value)
    }
    const { getPreviewUrl } = await import('../../../config/env')

    expect(getPreviewUrl()).toBeUndefined()
  })

  it.each([
    ['Netlify dev', { CONTEXT: 'dev', URL: 'https://dev.example.com' }, 'https://dev.example.com'],
    [
      'Netlify deploy-preview',
      {
        CONTEXT: 'deploy-preview',
        URL: 'https://preview.example.com',
      },
      'https://preview.example.com',
    ],
    [
      'Netlify branch-deploy',
      { CONTEXT: 'branch-deploy', URL: 'https://beta.example.com' },
      'https://beta.example.com',
    ],
    [
      'Netlify preview-server',
      {
        CONTEXT: 'preview-server',
        URL: 'https://my-feat--preview.example.com',
      },
      'https://my-feat--preview.example.com',
    ],
    [
      'Vercel development',
      { VERCEL_ENV: 'development', NUXT_ENV_VERCEL_URL: 'dev.example.com' },
      'https://dev.example.com',
    ],
    [
      'Vercel preview',
      { VERCEL_ENV: 'preview', NUXT_ENV_VERCEL_URL: 'preview.example.com' },
      'https://preview.example.com',
    ],
  ])('%s environment returns preview URL', async (_name, envVars, expectedUrl) => {
    for (const [key, value] of Object.entries(envVars)) {
      vi.stubEnv(key, value)
    }

    const { getPreviewUrl } = await import('../../../config/env')

    expect(getPreviewUrl()).toBe(expectedUrl)
  })
})

describe('getProductionUrl', () => {
  beforeEach(() => {
    // Reset consts evaluated at module init time
    vi.resetModules()
  })

  beforeEach(() => {
    for (const envVar of ALL_ENV_VARS) {
      vi.stubEnv(envVar, undefined)
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns `undefined` if no known production env is detected', async () => {
    const { getProductionUrl } = await import('../../../config/env')

    expect(getProductionUrl()).toBeUndefined()
  })

  it.each([
    ['Netlify dev', { CONTEXT: 'dev', URL: 'https://dev.example.com' }],
    [
      'Netlify deploy-preview',
      {
        CONTEXT: 'deploy-preview',
        URL: 'https://preview.example.com',
      },
    ],
    ['Netlify branch-deploy', { CONTEXT: 'branch-deploy', URL: 'https://beta.example.com' }],
    [
      'Netlify preview-server',
      {
        CONTEXT: 'preview-server',
        URL: 'https://my-feat--preview.example.com',
      },
    ],
    [
      'Vercel development',
      {
        VERCEL_ENV: 'development',
        NUXT_ENV_VERCEL_PROJECT_PRODUCTION_URL: 'dev.example.com',
      },
    ],
    [
      'Vercel preview',
      {
        VERCEL_ENV: 'preview',
        NUXT_ENV_VERCEL_PROJECT_PRODUCTION_URL: 'preview.example.com',
      },
    ],
  ])('%s environment returns `undefined`', async (_name, envVars) => {
    for (const [key, value] of Object.entries(envVars)) {
      vi.stubEnv(key, value)
    }
    const { getProductionUrl } = await import('../../../config/env')

    expect(getProductionUrl()).toBeUndefined()
  })

  it.each([
    [
      'Netlify production',
      { CONTEXT: 'production', URL: 'https://prod.example.com' },
      'https://prod.example.com',
    ],
    [
      'Vercel production',
      {
        VERCEL_ENV: 'production',
        NUXT_ENV_VERCEL_PROJECT_PRODUCTION_URL: 'prod.example.com',
      },
      'https://prod.example.com',
    ],
  ])('%s environment returns production URL', async (_name, envVars, expectedUrl) => {
    for (const [key, value] of Object.entries(envVars)) {
      vi.stubEnv(key, value)
    }
    const { getProductionUrl } = await import('../../../config/env')

    expect(getProductionUrl()).toBe(expectedUrl)
  })
})
