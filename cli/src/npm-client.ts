import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface NpmExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function execNpm(
  args: string[],
  options: { otp?: string } = {},
): Promise<NpmExecResult> {
  const cmd = ['npm', ...args]

  if (options.otp) {
    cmd.push('--otp', options.otp)
  }

  try {
    const { stdout, stderr } = await execAsync(cmd.join(' '), {
      timeout: 60000,
      env: { ...process.env, FORCE_COLOR: '0' },
    })
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 }
  }
  catch (error) {
    const err = error as { stdout?: string, stderr?: string, code?: number }
    return {
      stdout: err.stdout?.trim() ?? '',
      stderr: err.stderr?.trim() ?? String(error),
      exitCode: err.code ?? 1,
    }
  }
}

export async function getNpmUser(): Promise<string | null> {
  const result = await execNpm(['whoami'])
  if (result.exitCode === 0 && result.stdout) {
    return result.stdout
  }
  return null
}

export async function orgAddUser(
  org: string,
  user: string,
  role: 'developer' | 'admin' | 'owner',
  otp?: string,
): Promise<NpmExecResult> {
  return execNpm(['org', 'set', org, user, role], { otp })
}

export async function orgRemoveUser(
  org: string,
  user: string,
  otp?: string,
): Promise<NpmExecResult> {
  return execNpm(['org', 'rm', org, user], { otp })
}

export async function teamCreate(
  scopeTeam: string,
  otp?: string,
): Promise<NpmExecResult> {
  return execNpm(['team', 'create', scopeTeam], { otp })
}

export async function teamDestroy(
  scopeTeam: string,
  otp?: string,
): Promise<NpmExecResult> {
  return execNpm(['team', 'destroy', scopeTeam], { otp })
}

export async function teamAddUser(
  scopeTeam: string,
  user: string,
  otp?: string,
): Promise<NpmExecResult> {
  return execNpm(['team', 'add', scopeTeam, user], { otp })
}

export async function teamRemoveUser(
  scopeTeam: string,
  user: string,
  otp?: string,
): Promise<NpmExecResult> {
  return execNpm(['team', 'rm', scopeTeam, user], { otp })
}

export async function accessGrant(
  permission: 'read-only' | 'read-write',
  scopeTeam: string,
  pkg: string,
  otp?: string,
): Promise<NpmExecResult> {
  return execNpm(['access', 'grant', permission, scopeTeam, pkg], { otp })
}

export async function accessRevoke(
  scopeTeam: string,
  pkg: string,
  otp?: string,
): Promise<NpmExecResult> {
  return execNpm(['access', 'revoke', scopeTeam, pkg], { otp })
}

export async function ownerAdd(
  user: string,
  pkg: string,
  otp?: string,
): Promise<NpmExecResult> {
  return execNpm(['owner', 'add', user, pkg], { otp })
}

export async function ownerRemove(
  user: string,
  pkg: string,
  otp?: string,
): Promise<NpmExecResult> {
  return execNpm(['owner', 'rm', user, pkg], { otp })
}
