#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'
import { listen } from 'listhen'
import { toNodeListener } from 'h3'
import { createConnectorApp, generateToken, CONNECTOR_VERSION } from './server.ts'
import { getNpmUser } from './npm-client.ts'
import { initLogger, showToken, logInfo, showAuthRequired } from './logger.ts'

const DEFAULT_PORT = 31415

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
    const npmUser = await getNpmUser()

    if (!npmUser) {
      showAuthRequired()
      process.exit(1)
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
