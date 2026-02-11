#!/usr/bin/env node
/**
 * Mock connector CLI — starts a pre-populated mock server for developing
 * authenticated features without a real npm account.
 */

import process from 'node:process'
import crypto from 'node:crypto'
import { styleText } from 'node:util'
import * as p from '@clack/prompts'
import { defineCommand, runMain } from 'citty'
import {
  MockConnectorStateManager,
  createMockConnectorState,
  type MockConnectorConfig,
} from './mock-state.ts'
import { MockConnectorServer } from './mock-app.ts'

const DEFAULT_PORT = 31415
const DEV_FRONTEND_URL = 'http://127.0.0.1:3000/'
const PROD_FRONTEND_URL = 'https://npmx.dev/'

function generateToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Pre-populate with sample data using real npm orgs so the registry
 * API calls don't 404. Members/teams are fictional.
 */
function populateDefaultData(stateManager: MockConnectorStateManager): void {
  const npmUser = stateManager.config.npmUser

  stateManager.setOrgData('@nuxt', {
    users: {
      [npmUser]: 'owner',
      danielroe: 'owner',
      pi0: 'admin',
      antfu: 'developer',
    },
    teams: ['core', 'docs', 'triage'],
    teamMembers: {
      core: [npmUser, 'danielroe', 'pi0'],
      docs: ['antfu'],
      triage: ['pi0', 'antfu'],
    },
  })

  stateManager.setOrgData('@unjs', {
    users: {
      [npmUser]: 'admin',
      pi0: 'owner',
    },
    teams: ['maintainers'],
    teamMembers: {
      maintainers: [npmUser, 'pi0'],
    },
  })

  stateManager.setUserOrgs(['nuxt', 'unjs'])

  stateManager.setPackageData('@nuxt/kit', {
    collaborators: {
      [npmUser]: 'read-write',
      'danielroe': 'read-write',
      'nuxt:core': 'read-write',
      'nuxt:docs': 'read-only',
    },
  })
  stateManager.setPackageData('@nuxt/schema', {
    collaborators: {
      [npmUser]: 'read-write',
      'nuxt:core': 'read-write',
    },
  })
  stateManager.setPackageData('@unjs/nitro', {
    collaborators: {
      [npmUser]: 'read-write',
      'pi0': 'read-write',
      'unjs:maintainers': 'read-write',
    },
  })

  stateManager.setUserPackages({
    '@nuxt/kit': 'read-write',
    '@nuxt/schema': 'read-write',
    '@unjs/nitro': 'read-write',
  })
}

const main = defineCommand({
  meta: {
    name: 'npmx-connector-mock',
    version: '0.0.1',
    description: 'Mock connector for npmx.dev development and testing',
  },
  args: {
    port: {
      type: 'string',
      description: 'Port to listen on',
      default: String(DEFAULT_PORT),
    },
    user: {
      type: 'string',
      description: 'Simulated npm username',
      default: 'mock-user',
    },
    empty: {
      type: 'boolean',
      description: 'Start with empty state (no pre-populated data)',
      default: false,
    },
  },
  async run({ args }) {
    const port = Number.parseInt(args.port as string, 10) || DEFAULT_PORT
    const npmUser = args.user as string
    const empty = args.empty as boolean
    const frontendUrl = process.env.NPMX_CLI_DEV === 'true' ? DEV_FRONTEND_URL : PROD_FRONTEND_URL

    p.intro(styleText(['bgMagenta', 'white'], ' npmx mock connector '))

    const token = generateToken()
    const config: MockConnectorConfig = {
      token,
      npmUser,
      avatar: null,
      port,
    }
    const stateManager = new MockConnectorStateManager(createMockConnectorState(config))

    if (!empty) {
      populateDefaultData(stateManager)
      p.log.info(`Pre-populated with sample data for ${styleText('cyan', npmUser)}`)
      p.log.info(styleText('dim', `  Orgs: @nuxt (4 members, 3 teams), @unjs (2 members, 1 team)`))
      p.log.info(styleText('dim', `  Packages: @nuxt/kit, @nuxt/schema, @unjs/nitro`))
    } else {
      p.log.info('Starting with empty state')
    }

    stateManager.connect(token)
    const server = new MockConnectorServer(stateManager)

    try {
      await server.start()
    } catch (error) {
      p.log.error(error instanceof Error ? error.message : 'Failed to start mock connector server')
      process.exit(1)
    }

    const connectUrl = `${frontendUrl}?token=${token}&port=${port}`

    p.note(
      [
        `Open: ${styleText(['bold', 'underline', 'cyan'], connectUrl)}`,
        '',
        styleText('dim', `Or paste token manually: ${token}`),
        '',
        styleText('dim', `User: ${npmUser} | Port: ${port}`),
        styleText('dim', 'Operations will succeed immediately (no real npm calls)'),
      ].join('\n'),
      'Click to connect',
    )

    p.log.info('Waiting for connection... (Press Ctrl+C to stop)')
  },
})

runMain(main)
