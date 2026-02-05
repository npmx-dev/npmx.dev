/**
 * This script runs oxlint and oxfmt in a CI environment, without the need to install the entire
 * project. It reads the required version from pnpm-lock.yaml and executes the linters accordingly.
 * It's "stupid by design" so it could work in minimal Node.js environments.
 */

import { spawnSync } from 'node:child_process'

function getDependencyVersion(dependencyName: string): string {
  const result = spawnSync('npm', ['pkg', 'get', `devDependencies.${dependencyName}`], {
    encoding: 'utf8',
  })

  if (result.status) {
    throw new Error(`Command failed: pnpm info ${dependencyName} version`)
  }

  return JSON.parse(result.stdout)
}

function runCommand(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit' })

  if (result.status) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
  }
}

const oxlintVersion = getDependencyVersion('oxlint')
const oxfmtVersion = getDependencyVersion('oxfmt')
const e18eVersion = getDependencyVersion('@e18e/eslint-plugin')

runCommand('pnpx', [
  `--package=@e18e/eslint-plugin@${e18eVersion}`,
  `--package=oxlint@${oxlintVersion}`,
  'oxlint',
])
runCommand('pnpx', [`oxfmt@${oxfmtVersion}`, '--check'])
