#!/usr/bin/env node
import process from 'node:process'
import { spawn } from 'node:child_process'
import { defineCommand, runMain } from 'citty'
import { listen } from 'listhen'
import { toNodeListener } from 'h3'
import { createConnectorApp, generateToken, CONNECTOR_VERSION } from './server.ts'
import { getNpmUser } from './npm-client.ts'
import { initLogger, showToken, logInfo, logWarning } from './logger.ts'

const DEFAULT_PORT = 31415

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

    initLogger()

    // Check npm authentication before starting
    logInfo('Checking npm authentication...')
    let npmUser = await getNpmUser()

    if (!npmUser) {
      logWarning('Not logged in to npm. Starting npm login...')
      logWarning('This allows npmx to access your npm cli and any authenticated contexts.')
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
    showToken(token, port)

    const app = createConnectorApp(token)

    await listen(toNodeListener(app), {
      port,
      hostname: '127.0.0.1',
      showURL: false,
    })

    logInfo('Waiting for connection... (Press Ctrl+C to stop)')
  },
})

runMain(main)
