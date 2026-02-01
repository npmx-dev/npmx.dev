#!/usr/bin/env node
import process from 'node:process'
import { spawn } from 'node:child_process'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { defineCommand, runMain } from 'citty'
import { serve } from 'srvx'
import { createConnectorApp, generateToken, CONNECTOR_VERSION } from './server.ts'
import { getNpmUser } from './npm-client.ts'
import { initLogger, showToken, logInfo, logWarning, logError } from './logger.ts'

const DEFAULT_PORT = 31415
const DEFAULT_FRONTEND_URL = 'https://npmx.dev/'
const DEV_FRONTEND_URL = 'http://127.0.0.1:3000/'

async function runNpmLogin(): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn('npm', ['login'], {
      stdio: 'inherit',
      shell: true,
    })

    child.on('close', code => {
      resolve(code === 0)
    })

    child.on('error', () => {
      resolve(false)
    })
  })
}

const main = defineCommand({
  meta: {
    name: 'npmx-connector',
    version: CONNECTOR_VERSION,
    description: 'Local connector for npmx.dev',
  },
  args: {
    port: {
      type: 'string',
      description: 'Port to listen on',
      default: String(DEFAULT_PORT),
    },
  },
  async run({ args }) {
    const port = Number.parseInt(args.port as string, 10) || DEFAULT_PORT
    const frontendUrl =
      process.env.NPMX_CLI_DEV === 'true' ? DEV_FRONTEND_URL : DEFAULT_FRONTEND_URL

    initLogger()

    // Warning message and accept prompt
    logWarning(
      `This allows ${pc.underline('npmx.dev')} to access your npm cli and any authenticated contexts.`,
    )
    const accept = await p.confirm({
      message: 'Do you accept?',
      initialValue: true,
    })

    if (!accept || p.isCancel(accept)) {
      logError('Connector setup cancelled.')
      process.exit(0)
    }

    // Check npm authentication before starting
    logInfo('Checking npm authentication...')
    let npmUser = await getNpmUser()

    if (!npmUser) {
      logWarning('Not logged in to npm. Starting npm login...')
      // oxlint-disable-next-line no-console -- deliberate spacing
      console.log()

      const loginSuccess = await runNpmLogin()

      // oxlint-disable-next-line no-console -- deliberate spacing
      console.log()

      if (!loginSuccess) {
        logWarning('npm login failed or was cancelled.')
        process.exit(1)
      }

      // Check again after login
      npmUser = await getNpmUser()
      if (!npmUser) {
        logWarning('Still not authenticated after login attempt.')
        process.exit(1)
      }
    }

    logInfo(`Authenticated as: ${npmUser}`)

    const token = generateToken()
    showToken(token, port, frontendUrl)

    const app = createConnectorApp(token)

    const server = serve({
      port,
      hostname: '127.0.0.1',
      fetch: app.fetch,
    })

    await server.ready()

    logInfo('Waiting for connection... (Press Ctrl+C to stop)')
  },
})

runMain(main)
