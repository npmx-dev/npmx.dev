import process from 'node:process'

interface NpmProcessCommand {
  command: string
  args: string[]
}

export function resolveNpmProcessCommand(npmArgs: string[]): NpmProcessCommand {
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm', ...npmArgs],
    }
  }

  return {
    command: 'npm',
    args: npmArgs,
  }
}
