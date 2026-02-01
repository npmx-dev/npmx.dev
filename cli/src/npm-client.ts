import crypto from 'node:crypto'
import process from 'node:process'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as v from 'valibot'
import { PackageNameSchema, UsernameSchema, OrgNameSchema, ScopeTeamSchema } from './schemas.ts'
import { logCommand, logSuccess, logError } from './logger.ts'

const execFileAsync = promisify(execFile)

/**
 * Validates an npm package name using the official npm validation package
 * @throws Error if the name is invalid
 */
export function validatePackageName(name: string): void {
  const result = v.safeParse(PackageNameSchema, name)
  if (!result.success) {
    const message = result.issues[0]?.message || 'Invalid package name'
    throw new Error(`Invalid package name "${name}": ${message}`)
  }
}

/**
 * Validates an npm username
 * @throws Error if the username is invalid
 */
export function validateUsername(name: string): void {
  const result = v.safeParse(UsernameSchema, name)
  if (!result.success) {
    throw new Error(`Invalid username: ${name}`)
  }
}

/**
 * Validates an npm org name (without the @ prefix)
 * @throws Error if the org name is invalid
 */
export function validateOrgName(name: string): void {
  const result = v.safeParse(OrgNameSchema, name)
  if (!result.success) {
    throw new Error(`Invalid org name: ${name}`)
  }
}

/**
 * Validates a scope:team format (e.g., @myorg:developers)
 * @throws Error if the scope:team is invalid
 */
export function validateScopeTeam(scopeTeam: string): void {
  const result = v.safeParse(ScopeTeamSchema, scopeTeam)
  if (!result.success) {
    throw new Error(`Invalid scope:team format: ${scopeTeam}. Expected @scope:team`)
  }
}

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

async function execNpm(
  args: string[],
  options: { otp?: string; silent?: boolean } = {},
): Promise<NpmExecResult> {
  // Build the full args array including OTP if provided
  const npmArgs = options.otp ? [...args, '--otp', options.otp] : args

  // Log the command being run (hide OTP value for security)
  if (!options.silent) {
    const displayCmd = options.otp
      ? ['npm', ...args, '--otp', '******'].join(' ')
      : ['npm', ...args].join(' ')
    logCommand(displayCmd)
  }

  try {
    // Use execFile instead of exec to avoid shell injection vulnerabilities
    // execFile does not spawn a shell, so metacharacters are passed literally
    const { stdout, stderr } = await execFileAsync('npm', npmArgs, {
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

/**
 * Gets the user's avatar as a base64 data URL from Gravatar.
 * Returns null if the user's email cannot be retrieved or avatar fetch fails.
 */
export async function getNpmAvatar(): Promise<string | null> {
  const result = await execNpm(['profile', 'get', 'email', '--json'], { silent: true })
  if (result.exitCode !== 0 || !result.stdout) {
    return null
  }

  try {
    const parsed = JSON.parse(result.stdout) as { email?: string }
    if (!parsed.email) {
      return null
    }

    const email = parsed.email.trim().toLowerCase()
    const hash = crypto.createHash('md5').update(email).digest('hex')
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=64&d=retro`

    const response = await fetch(gravatarUrl)
    if (!response.ok) {
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

export async function orgAddUser(
  org: string,
  user: string,
  role: 'developer' | 'admin' | 'owner',
  otp?: string,
): Promise<NpmExecResult> {
  validateOrgName(org)
  validateUsername(user)
  return execNpm(['org', 'set', org, user, role], { otp })
}

export async function orgRemoveUser(
  org: string,
  user: string,
  otp?: string,
): Promise<NpmExecResult> {
  validateOrgName(org)
  validateUsername(user)
  return execNpm(['org', 'rm', org, user], { otp })
}

export async function teamCreate(scopeTeam: string, otp?: string): Promise<NpmExecResult> {
  validateScopeTeam(scopeTeam)
  return execNpm(['team', 'create', scopeTeam], { otp })
}

export async function teamDestroy(scopeTeam: string, otp?: string): Promise<NpmExecResult> {
  validateScopeTeam(scopeTeam)
  return execNpm(['team', 'destroy', scopeTeam], { otp })
}

export async function teamAddUser(
  scopeTeam: string,
  user: string,
  otp?: string,
): Promise<NpmExecResult> {
  validateScopeTeam(scopeTeam)
  validateUsername(user)
  return execNpm(['team', 'add', scopeTeam, user], { otp })
}

export async function teamRemoveUser(
  scopeTeam: string,
  user: string,
  otp?: string,
): Promise<NpmExecResult> {
  validateScopeTeam(scopeTeam)
  validateUsername(user)
  return execNpm(['team', 'rm', scopeTeam, user], { otp })
}

export async function accessGrant(
  permission: 'read-only' | 'read-write',
  scopeTeam: string,
  pkg: string,
  otp?: string,
): Promise<NpmExecResult> {
  validateScopeTeam(scopeTeam)
  validatePackageName(pkg)
  return execNpm(['access', 'grant', permission, scopeTeam, pkg], { otp })
}

export async function accessRevoke(
  scopeTeam: string,
  pkg: string,
  otp?: string,
): Promise<NpmExecResult> {
  validateScopeTeam(scopeTeam)
  validatePackageName(pkg)
  return execNpm(['access', 'revoke', scopeTeam, pkg], { otp })
}

export async function ownerAdd(user: string, pkg: string, otp?: string): Promise<NpmExecResult> {
  validateUsername(user)
  validatePackageName(pkg)
  return execNpm(['owner', 'add', user, pkg], { otp })
}

export async function ownerRemove(user: string, pkg: string, otp?: string): Promise<NpmExecResult> {
  validateUsername(user)
  validatePackageName(pkg)
  return execNpm(['owner', 'rm', user, pkg], { otp })
}

// List functions (for reading data) - silent since they're not user-triggered operations

export async function orgListUsers(org: string): Promise<NpmExecResult> {
  validateOrgName(org)
  return execNpm(['org', 'ls', org, '--json'], { silent: true })
}

export async function teamListTeams(org: string): Promise<NpmExecResult> {
  validateOrgName(org)
  return execNpm(['team', 'ls', org, '--json'], { silent: true })
}

export async function teamListUsers(scopeTeam: string): Promise<NpmExecResult> {
  validateScopeTeam(scopeTeam)
  return execNpm(['team', 'ls', scopeTeam, '--json'], { silent: true })
}

export async function accessListCollaborators(pkg: string): Promise<NpmExecResult> {
  validatePackageName(pkg)
  return execNpm(['access', 'list', 'collaborators', pkg, '--json'], { silent: true })
}

/**
 * Lists all packages that a user has access to publish.
 * Uses `npm access list packages @{user} --json`
 * Returns a map of package name to permission level
 */
export async function listUserPackages(user: string): Promise<NpmExecResult> {
  validateUsername(user)
  return execNpm(['access', 'list', 'packages', `@${user}`, '--json'], { silent: true })
}

/**
 * Initialize and publish a new package to claim the name.
 * Creates a minimal package.json in a temp directory and publishes it.
 * @param name Package name to claim
 * @param author npm username of the publisher (for author field)
 * @param otp Optional OTP for 2FA
 */
export async function packageInit(
  name: string,
  author?: string,
  otp?: string,
): Promise<NpmExecResult> {
  validatePackageName(name)

  // Create a temporary directory
  const tempDir = await mkdtemp(join(tmpdir(), 'npmx-init-'))

  try {
    // Determine access type based on whether it's a scoped package
    const isScoped = name.startsWith('@')
    const access = isScoped ? 'public' : undefined

    // Create minimal package.json
    const packageJson = {
      name,
      version: '0.0.0',
      description: `Placeholder for ${name}`,
      main: 'index.js',
      scripts: {},
      keywords: [],
      author: author ? `${author} (https://www.npmjs.com/~${author})` : '',
      license: 'UNLICENSED',
      private: false,
      ...(access && { publishConfig: { access } }),
    }

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2))

    // Create empty index.js
    await writeFile(join(tempDir, 'index.js'), '// Placeholder\n')

    // Build npm publish args
    const args = ['publish']
    if (access) {
      args.push('--access', access)
    }

    // Run npm publish from the temp directory
    const npmArgs = otp ? [...args, '--otp', otp] : args

    // Log the command being run (hide OTP value for security)
    const displayCmd = otp ? `npm ${args.join(' ')} --otp ******` : `npm ${args.join(' ')}`
    logCommand(`${displayCmd} (in temp dir for ${name})`)

    try {
      const { stdout, stderr } = await execFileAsync('npm', npmArgs, {
        timeout: 60000,
        cwd: tempDir,
        env: { ...process.env, FORCE_COLOR: '0' },
      })

      logSuccess(`Published ${name}@0.0.0`)

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

      if (requiresOtp) {
        logError('OTP required')
      } else if (authFailure) {
        logError('Authentication required - please run "npm login" and restart the connector')
      } else {
        logError(filterNpmWarnings(stderr).split('\n')[0] || 'Command failed')
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
  } finally {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true }).catch(() => {
      // Ignore cleanup errors
    })
  }
}
