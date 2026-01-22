#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'
import consola from 'consola'
import { listen } from 'listhen'
import { toNodeListener } from 'h3'
import { createConnectorApp, generateToken } from './server'

const DEFAULT_PORT = 31415

const main = defineCommand({
  meta: {
    name: 'npmx-connector',
    version: '0.0.1',
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
    const token = generateToken()

    consola.box({
      title: 'npmx connector',
      message: [
        '',
        'Paste this token in the npmx.dev web UI to connect:',
        '',
        `  ${token}`,
        '',
        `Server running at http://localhost:${port}`,
        '',
        'Press Ctrl+C to stop',
        '',
      ].join('\n'),
    })

    const app = createConnectorApp(token)

    await listen(toNodeListener(app), {
      port,
      hostname: '127.0.0.1',
      showURL: false,
    })
  },
})

runMain(main)
