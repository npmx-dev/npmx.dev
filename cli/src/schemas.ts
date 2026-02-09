import * as v from 'valibot'
import validateNpmPackageName from 'validate-npm-package-name'

// Validation pattern for npm usernames/org names
// These follow similar rules: lowercase alphanumeric with hyphens, can't start/end with hyphen
const NPM_USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Validates an npm package name using the official npm validation package
 * Accepts both new and legacy package name formats
 */
export const PackageNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('Package name is required'),
  v.check(input => {
    const result = validateNpmPackageName(input)
    return result.validForNewPackages || result.validForOldPackages
  }, 'Invalid package name format'),
)

/**
 * Validates an npm package name for new packages only
 * Stricter than PackageNameSchema - rejects legacy formats (uppercase, etc.)
 * @internal
 */
export const NewPackageNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('Package name is required'),
  v.check(input => {
    const result = validateNpmPackageName(input)
    return result.validForNewPackages === true
  }, 'Invalid package name format. New packages must be lowercase and follow npm naming conventions.'),
)

/**
 * Validates an npm username
 * Must be alphanumeric with hyphens, max 50 chars, can't start/end with hyphen
 */
export const UsernameSchema = v.pipe(
  v.string(),
  v.nonEmpty('Username is required'),
  v.maxLength(50, 'Username is too long'),
  v.regex(NPM_USERNAME_RE, 'Invalid username format'),
)

/**
 * Validates an npm org name (without the @ prefix)
 * Same rules as username
 */
export const OrgNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('Org name is required'),
  v.maxLength(50, 'Org name is too long'),
  v.regex(NPM_USERNAME_RE, 'Invalid org name format'),
)

/**
 * Validates a scope:team format (e.g., @myorg:developers)
 */
export const ScopeTeamSchema = v.pipe(
  v.string(),
  v.nonEmpty('Scope:team is required'),
  v.maxLength(100, 'Scope:team is too long'),
  v.check(input => {
    const match = input.match(/^@([^:]+):(.+)$/)
    if (!match) return false
    const [, scope, team] = match
    if (!scope || !NPM_USERNAME_RE.test(scope)) return false
    if (!team || !NPM_USERNAME_RE.test(team)) return false
    return true
  }, 'Invalid scope:team format. Expected @scope:team'),
)

/**
 * Validates org roles
 * @internal
 */
export const OrgRoleSchema = v.picklist(
  ['developer', 'admin', 'owner'],
  'Invalid role. Must be developer, admin, or owner',
)

/**
 * Validates access permissions
 * @internal
 */
export const PermissionSchema = v.picklist(
  ['read-only', 'read-write'],
  'Invalid permission. Must be read-only or read-write',
)

/**
 * Validates operation types
 */
export const OperationTypeSchema = v.picklist([
  'org:add-user',
  'org:rm-user',
  'org:set-role',
  'team:create',
  'team:destroy',
  'team:add-user',
  'team:rm-user',
  'access:grant',
  'access:revoke',
  'owner:add',
  'owner:rm',
  'package:init',
])

/**
 * Validates OTP (6-digit code)
 * @internal
 */
export const OtpSchema = v.optional(
  v.pipe(v.string(), v.regex(/^\d{6}$/, 'OTP must be a 6-digit code')),
)

/**
 * Validates a hex token (like session tokens and operation IDs)
 * @internal
 */
export const HexTokenSchema = v.pipe(
  v.string(),
  v.nonEmpty('Token is required'),
  v.regex(/^[a-f0-9]+$/i, 'Invalid token format'),
)

/**
 * Validates operation ID (16-char hex)
 * @internal
 */
export const OperationIdSchema = v.pipe(
  v.string(),
  v.nonEmpty('Operation ID is required'),
  v.regex(/^[a-f0-9]{16}$/i, 'Invalid operation ID format'),
)

// ============================================================================
// Request Body Schemas
// ============================================================================

/**
 * Schema for /connect request body
 */
export const ConnectBodySchema = v.object({
  token: HexTokenSchema,
})

/**
 * Schema for /execute request body
 */
export const ExecuteBodySchema = v.object({
  otp: OtpSchema,
})

/**
 * Schema for operation params based on type
 * Validates the params object for each operation type
 */
const OperationParamsSchema = v.record(v.string(), v.string())

/**
 * Schema for single operation request body
 */
export const CreateOperationBodySchema = v.object({
  type: OperationTypeSchema,
  params: OperationParamsSchema,
  description: v.pipe(v.string(), v.nonEmpty('Description is required'), v.maxLength(500)),
  command: v.pipe(v.string(), v.nonEmpty('Command is required'), v.maxLength(1000)),
})

/**
 * Schema for batch operation request body
 */
export const BatchOperationsBodySchema = v.array(CreateOperationBodySchema)

// ============================================================================
// Type-specific Operation Params Schemas
// ============================================================================

/** @internal */
export const OrgAddUserParamsSchema = v.object({
  org: OrgNameSchema,
  user: UsernameSchema,
  role: OrgRoleSchema,
})

const OrgRemoveUserParamsSchema = v.object({
  org: OrgNameSchema,
  user: UsernameSchema,
})

const TeamCreateParamsSchema = v.object({
  scopeTeam: ScopeTeamSchema,
})

const TeamDestroyParamsSchema = v.object({
  scopeTeam: ScopeTeamSchema,
})

const TeamAddUserParamsSchema = v.object({
  scopeTeam: ScopeTeamSchema,
  user: UsernameSchema,
})

const TeamRemoveUserParamsSchema = v.object({
  scopeTeam: ScopeTeamSchema,
  user: UsernameSchema,
})

/** @internal */
export const AccessGrantParamsSchema = v.object({
  permission: PermissionSchema,
  scopeTeam: ScopeTeamSchema,
  pkg: PackageNameSchema,
})

const AccessRevokeParamsSchema = v.object({
  scopeTeam: ScopeTeamSchema,
  pkg: PackageNameSchema,
})

const OwnerAddParamsSchema = v.object({
  user: UsernameSchema,
  pkg: PackageNameSchema,
})

const OwnerRemoveParamsSchema = v.object({
  user: UsernameSchema,
  pkg: PackageNameSchema,
})

/** @internal */
export const PackageInitParamsSchema = v.object({
  name: NewPackageNameSchema,
  author: v.optional(UsernameSchema),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates operation params based on operation type
 * @throws ValiError if validation fails
 */
export function validateOperationParams(
  type: v.InferOutput<typeof OperationTypeSchema>,
  params: Record<string, string>,
): void {
  switch (type) {
    case 'org:add-user':
      v.parse(OrgAddUserParamsSchema, params)
      break
    case 'org:rm-user':
      v.parse(OrgRemoveUserParamsSchema, params)
      break
    case 'org:set-role':
      v.parse(OrgAddUserParamsSchema, params) // same params as add-user
      break
    case 'team:create':
      v.parse(TeamCreateParamsSchema, params)
      break
    case 'team:destroy':
      v.parse(TeamDestroyParamsSchema, params)
      break
    case 'team:add-user':
      v.parse(TeamAddUserParamsSchema, params)
      break
    case 'team:rm-user':
      v.parse(TeamRemoveUserParamsSchema, params)
      break
    case 'access:grant':
      v.parse(AccessGrantParamsSchema, params)
      break
    case 'access:revoke':
      v.parse(AccessRevokeParamsSchema, params)
      break
    case 'owner:add':
      v.parse(OwnerAddParamsSchema, params)
      break
    case 'owner:rm':
      v.parse(OwnerRemoveParamsSchema, params)
      break
    case 'package:init':
      v.parse(PackageInitParamsSchema, params)
      break
  }
}

/**
 * Safe parse wrapper that returns a formatted error message
 */
export function safeParse<T extends v.GenericSchema>(
  schema: T,
  input: unknown,
): { success: true; data: v.InferOutput<T> } | { success: false; error: string } {
  const result = v.safeParse(schema, input)
  if (result.success) {
    return { success: true, data: result.output }
  }
  // Format the first error message
  const firstIssue = result.issues[0]
  const path = firstIssue?.path?.map(p => p.key).join('.') || ''
  const message = firstIssue?.message || 'Validation failed'
  return {
    success: false,
    error: path ? `${path}: ${message}` : message,
  }
}
