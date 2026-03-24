import process from 'node:process'

export interface NpmProcessCommand {
  command: string
  args: string[]
}

export function resolveNpmProcessCommand(
  npmArgs: string[],
  platform = process.platform,
  comSpec = process.env.ComSpec,
): NpmProcessCommand {
  if (platform === 'win32') {
    return {
      command: comSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm', ...npmArgs],
    }
  }

  return {
    command: 'npm',
    args: npmArgs,
  }
}
