import process from 'node:process'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { logCommand, logSuccess, logError } from './logger.ts'

const execAsync = promisify(exec)

export interface NpmExecResult {
  stdout: string
  stderr: string
  exitCode: number
  /** True if the operation failed due to missing/invalid OTP */
  requiresOtp?: boolean
  /** True if the operation failed due to authentication failure (not logged in or token expired) */
  authFailure?: boolean
}

function detectOtpRequired(stderr: string): boolean {
  const otpPatterns = [
    'EOTP',
    'one-time password',
    'This operation requires a one-time password',
    '--otp=<code>',
  ]
  const lowerStderr = stderr.toLowerCase()
  return otpPatterns.some(pattern => lowerStderr.includes(pattern.toLowerCase()))
}

function detectAuthFailure(stderr: string): boolean {
  const authPatterns = [
    'ENEEDAUTH',
    'You must be logged in',
    'authentication error',
    'Unable to authenticate',
    'code E401',
    'code E403',
    '401 Unauthorized',
    '403 Forbidden',
    'not logged in',
    'npm login',
    'npm adduser',
  ]
  const lowerStderr = stderr.toLowerCase()
  return authPatterns.some(pattern => lowerStderr.includes(pattern.toLowerCase()))
}

function filterNpmWarnings(stderr: string): string {
  return stderr
    .split('\n')
    .filter(line => !line.startsWith('npm warn'))
    .join('\n')
    .trim()
}

export async function execNpm(
  args: string[],
  options: { otp?: string; silent?: boolean } = {},
): Promise<NpmExecResult> {
  const cmd = ['npm', ...args]

  if (options.otp) {
    cmd.push('--otp', options.otp)
  }

  // Log the command being run (hide OTP value for security)
  if (!options.silent) {
    const displayCmd = options.otp ? ['npm', ...args, '--otp', '******'].join(' ') : cmd.join(' ')
    logCommand(displayCmd)
  }

  try {
    const { stdout, stderr } = await execAsync(cmd.join(' '), {
      timeout: 60000,
      env: { ...process.env, FORCE_COLOR: '0' },
    })

    if (!options.silent) {
      logSuccess('Done')
    }

    return {
      stdout: stdout.trim(),
      stderr: filterNpmWarnings(stderr),
      exitCode: 0,
    }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number }
    const stderr = err.stderr?.trim() ?? String(error)
    const requiresOtp = detectOtpRequired(stderr)
    const authFailure = detectAuthFailure(stderr)

    if (!options.silent) {
      if (requiresOtp) {
        logError('OTP required')
      } else if (authFailure) {
        logError('Authentication required - please run "npm login" and restart the connector')
      } else {
        logError(filterNpmWarnings(stderr).split('\n')[0] || 'Command failed')
      }
    }

    return {
      stdout: err.stdout?.trim() ?? '',
      stderr: requiresOtp
        ? 'This operation requires a one-time password (OTP).'
        : authFailure
          ? 'Authentication failed. Please run "npm login" and restart the connector.'
          : filterNpmWarnings(stderr),
      exitCode: err.code ?? 1,
      requiresOtp,
      authFailure,
    }
  }
}

export async function getNpmUser(): Promise<string | null> {
  const result = await execNpm(['whoami'], { silent: true })
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

export async function teamCreate(scopeTeam: string, otp?: string): Promise<NpmExecResult> {
  return execNpm(['team', 'create', scopeTeam], { otp })
}

export async function teamDestroy(scopeTeam: string, otp?: string): Promise<NpmExecResult> {
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

export async function ownerAdd(user: string, pkg: string, otp?: string): Promise<NpmExecResult> {
  return execNpm(['owner', 'add', user, pkg], { otp })
}

export async function ownerRemove(user: string, pkg: string, otp?: string): Promise<NpmExecResult> {
  return execNpm(['owner', 'rm', user, pkg], { otp })
}

// List functions (for reading data) - silent since they're not user-triggered operations

export async function orgListUsers(org: string): Promise<NpmExecResult> {
  return execNpm(['org', 'ls', org, '--json'], { silent: true })
}

export async function teamListTeams(org: string): Promise<NpmExecResult> {
  return execNpm(['team', 'ls', org, '--json'], { silent: true })
}

export async function teamListUsers(scopeTeam: string): Promise<NpmExecResult> {
  return execNpm(['team', 'ls', scopeTeam, '--json'], { silent: true })
}

export async function accessListCollaborators(pkg: string): Promise<NpmExecResult> {
  return execNpm(['access', 'list', 'collaborators', pkg, '--json'], { silent: true })
}
