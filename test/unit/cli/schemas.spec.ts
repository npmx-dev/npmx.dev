import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import {
  PackageNameSchema,
  NewPackageNameSchema,
  UsernameSchema,
  OrgNameSchema,
  ScopeTeamSchema,
  OrgRoleSchema,
  PermissionSchema,
  OperationTypeSchema,
  OtpSchema,
  HexTokenSchema,
  OperationIdSchema,
  ConnectBodySchema,
  ExecuteBodySchema,
  CreateOperationBodySchema,
  BatchOperationsBodySchema,
  OrgAddUserParamsSchema,
  AccessGrantParamsSchema,
  PackageInitParamsSchema,
  safeParse,
  validateOperationParams,
} from '../../../cli/src/schemas.ts'

describe('PackageNameSchema', () => {
  it('accepts valid package names', () => {
    expect(v.safeParse(PackageNameSchema, 'my-package').success).toBe(true)
    expect(v.safeParse(PackageNameSchema, '@scope/package').success).toBe(true)
    expect(v.safeParse(PackageNameSchema, 'package123').success).toBe(true)
    expect(v.safeParse(PackageNameSchema, 'lodash').success).toBe(true)
  })

  it('accepts legacy package names (uppercase)', () => {
    // Legacy packages with uppercase are valid for old packages
    expect(v.safeParse(PackageNameSchema, 'UPPERCASE').success).toBe(true)
  })

  it('rejects invalid package names', () => {
    expect(v.safeParse(PackageNameSchema, '').success).toBe(false)
    expect(v.safeParse(PackageNameSchema, '.package').success).toBe(false)
    expect(v.safeParse(PackageNameSchema, '_package').success).toBe(false)
    expect(v.safeParse(PackageNameSchema, ' spaces ').success).toBe(false)
  })
})

describe('NewPackageNameSchema', () => {
  it('accepts valid new package names', () => {
    expect(v.safeParse(NewPackageNameSchema, 'my-package').success).toBe(true)
    expect(v.safeParse(NewPackageNameSchema, '@scope/package').success).toBe(true)
    expect(v.safeParse(NewPackageNameSchema, 'package123').success).toBe(true)
    expect(v.safeParse(NewPackageNameSchema, 'lodash').success).toBe(true)
  })

  it('rejects legacy package name formats', () => {
    // New packages must be lowercase
    expect(v.safeParse(NewPackageNameSchema, 'UPPERCASE').success).toBe(false)
    expect(v.safeParse(NewPackageNameSchema, 'MixedCase').success).toBe(false)
  })

  it('rejects invalid package names', () => {
    expect(v.safeParse(NewPackageNameSchema, '').success).toBe(false)
    expect(v.safeParse(NewPackageNameSchema, '.package').success).toBe(false)
    expect(v.safeParse(NewPackageNameSchema, '_package').success).toBe(false)
    expect(v.safeParse(NewPackageNameSchema, ' spaces ').success).toBe(false)
  })
})

describe('PackageInitParamsSchema', () => {
  it('accepts valid new package names', () => {
    expect(v.safeParse(PackageInitParamsSchema, { name: 'my-package' }).success).toBe(true)
    expect(
      v.safeParse(PackageInitParamsSchema, { name: '@scope/pkg', author: 'alice' }).success,
    ).toBe(true)
  })

  it('rejects legacy package name formats for new packages', () => {
    // Cannot create new packages with uppercase names
    expect(v.safeParse(PackageInitParamsSchema, { name: 'UPPERCASE' }).success).toBe(false)
    expect(v.safeParse(PackageInitParamsSchema, { name: 'MixedCase' }).success).toBe(false)
  })
})

describe('UsernameSchema', () => {
  it('accepts valid usernames', () => {
    expect(v.safeParse(UsernameSchema, 'alice').success).toBe(true)
    expect(v.safeParse(UsernameSchema, 'bob123').success).toBe(true)
    expect(v.safeParse(UsernameSchema, 'my-user').success).toBe(true)
  })

  it('rejects invalid usernames', () => {
    expect(v.safeParse(UsernameSchema, '').success).toBe(false)
    expect(v.safeParse(UsernameSchema, 'a'.repeat(51)).success).toBe(false)
    expect(v.safeParse(UsernameSchema, '-user').success).toBe(false)
    expect(v.safeParse(UsernameSchema, 'user-').success).toBe(false)
    expect(v.safeParse(UsernameSchema, 'user name').success).toBe(false)
    expect(v.safeParse(UsernameSchema, 'user;rm').success).toBe(false)
  })
})

describe('OrgNameSchema', () => {
  it('accepts valid org names', () => {
    expect(v.safeParse(OrgNameSchema, 'nuxt').success).toBe(true)
    expect(v.safeParse(OrgNameSchema, 'my-org').success).toBe(true)
  })

  it('rejects invalid org names', () => {
    expect(v.safeParse(OrgNameSchema, '').success).toBe(false)
    expect(v.safeParse(OrgNameSchema, 'a'.repeat(51)).success).toBe(false)
  })
})

describe('ScopeTeamSchema', () => {
  it('accepts valid scope:team format', () => {
    expect(v.safeParse(ScopeTeamSchema, '@nuxt:developers').success).toBe(true)
    expect(v.safeParse(ScopeTeamSchema, '@my-org:my-team').success).toBe(true)
    expect(v.safeParse(ScopeTeamSchema, '@a:b').success).toBe(true)
  })

  it('rejects invalid scope:team format', () => {
    expect(v.safeParse(ScopeTeamSchema, '').success).toBe(false)
    expect(v.safeParse(ScopeTeamSchema, 'nuxt:developers').success).toBe(false) // missing @
    expect(v.safeParse(ScopeTeamSchema, '@nuxt').success).toBe(false) // missing :team
    expect(v.safeParse(ScopeTeamSchema, '@:team').success).toBe(false) // empty scope
    expect(v.safeParse(ScopeTeamSchema, '@org:').success).toBe(false) // empty team
    expect(v.safeParse(ScopeTeamSchema, '@-org:team').success).toBe(false) // scope starts with hyphen
    expect(v.safeParse(ScopeTeamSchema, '@org:-team').success).toBe(false) // team starts with hyphen
  })
})

describe('OrgRoleSchema', () => {
  it('accepts valid roles', () => {
    expect(v.safeParse(OrgRoleSchema, 'developer').success).toBe(true)
    expect(v.safeParse(OrgRoleSchema, 'admin').success).toBe(true)
    expect(v.safeParse(OrgRoleSchema, 'owner').success).toBe(true)
  })

  it('rejects invalid roles', () => {
    expect(v.safeParse(OrgRoleSchema, 'user').success).toBe(false)
    expect(v.safeParse(OrgRoleSchema, '').success).toBe(false)
    expect(v.safeParse(OrgRoleSchema, 'ADMIN').success).toBe(false)
  })
})

describe('PermissionSchema', () => {
  it('accepts valid permissions', () => {
    expect(v.safeParse(PermissionSchema, 'read-only').success).toBe(true)
    expect(v.safeParse(PermissionSchema, 'read-write').success).toBe(true)
  })

  it('rejects invalid permissions', () => {
    expect(v.safeParse(PermissionSchema, 'write').success).toBe(false)
    expect(v.safeParse(PermissionSchema, '').success).toBe(false)
  })
})

describe('OperationTypeSchema', () => {
  it('accepts valid operation types', () => {
    expect(v.safeParse(OperationTypeSchema, 'org:add-user').success).toBe(true)
    expect(v.safeParse(OperationTypeSchema, 'team:create').success).toBe(true)
    expect(v.safeParse(OperationTypeSchema, 'access:grant').success).toBe(true)
    expect(v.safeParse(OperationTypeSchema, 'owner:add').success).toBe(true)
    expect(v.safeParse(OperationTypeSchema, 'package:init').success).toBe(true)
  })

  it('rejects invalid operation types', () => {
    expect(v.safeParse(OperationTypeSchema, 'invalid').success).toBe(false)
    expect(v.safeParse(OperationTypeSchema, '').success).toBe(false)
  })
})

describe('OtpSchema', () => {
  it('accepts valid OTP codes', () => {
    const result = v.safeParse(OtpSchema, '123456')
    expect(result.success).toBe(true)
    expect(result.output).toBe('123456')
  })

  it('accepts undefined (optional)', () => {
    const result = v.safeParse(OtpSchema, undefined)
    expect(result.success).toBe(true)
    expect(result.output).toBeUndefined()
  })

  it('rejects invalid OTP codes', () => {
    expect(v.safeParse(OtpSchema, '12345').success).toBe(false) // too short
    expect(v.safeParse(OtpSchema, '1234567').success).toBe(false) // too long
    expect(v.safeParse(OtpSchema, 'abcdef').success).toBe(false) // not digits
    expect(v.safeParse(OtpSchema, '').success).toBe(false) // empty
  })
})

describe('HexTokenSchema', () => {
  it('accepts valid hex tokens', () => {
    expect(v.safeParse(HexTokenSchema, 'abcd1234').success).toBe(true)
    expect(v.safeParse(HexTokenSchema, 'ABCD1234').success).toBe(true)
    expect(v.safeParse(HexTokenSchema, 'a1b2c3d4e5f6').success).toBe(true)
  })

  it('rejects invalid hex tokens', () => {
    expect(v.safeParse(HexTokenSchema, '').success).toBe(false)
    expect(v.safeParse(HexTokenSchema, 'ghij').success).toBe(false) // invalid hex chars
    expect(v.safeParse(HexTokenSchema, 'abc-123').success).toBe(false) // contains hyphen
  })
})

describe('OperationIdSchema', () => {
  it('accepts valid 16-char hex operation IDs', () => {
    expect(v.safeParse(OperationIdSchema, 'abcd1234abcd1234').success).toBe(true)
    expect(v.safeParse(OperationIdSchema, '0123456789abcdef').success).toBe(true)
  })

  it('rejects invalid operation IDs', () => {
    expect(v.safeParse(OperationIdSchema, '').success).toBe(false)
    expect(v.safeParse(OperationIdSchema, 'abcd1234').success).toBe(false) // too short
    expect(v.safeParse(OperationIdSchema, 'abcd1234abcd1234abcd').success).toBe(false) // too long
    expect(v.safeParse(OperationIdSchema, 'ghij1234abcd1234').success).toBe(false) // invalid hex
  })
})

describe('ConnectBodySchema', () => {
  it('accepts valid connect body', () => {
    const result = v.safeParse(ConnectBodySchema, { token: 'abcd1234' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid connect body', () => {
    expect(v.safeParse(ConnectBodySchema, {}).success).toBe(false)
    expect(v.safeParse(ConnectBodySchema, { token: '' }).success).toBe(false)
    expect(v.safeParse(ConnectBodySchema, { token: 'invalid!' }).success).toBe(false)
  })
})

describe('ExecuteBodySchema', () => {
  it('accepts valid execute body with OTP', () => {
    const result = v.safeParse(ExecuteBodySchema, { otp: '123456' })
    expect(result.success).toBe(true)
  })

  it('accepts execute body without OTP', () => {
    const result = v.safeParse(ExecuteBodySchema, {})
    expect(result.success).toBe(true)
  })

  it('rejects invalid OTP', () => {
    expect(v.safeParse(ExecuteBodySchema, { otp: '12345' }).success).toBe(false)
  })
})

describe('CreateOperationBodySchema', () => {
  it('accepts valid operation body', () => {
    const result = v.safeParse(CreateOperationBodySchema, {
      type: 'org:add-user',
      params: { org: 'nuxt', user: 'alice', role: 'developer' },
      description: 'Add alice to nuxt org',
      command: 'npm org set nuxt alice developer',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    expect(v.safeParse(CreateOperationBodySchema, {}).success).toBe(false)
    expect(v.safeParse(CreateOperationBodySchema, { type: 'org:add-user' }).success).toBe(false)
  })

  it('rejects invalid type', () => {
    expect(
      v.safeParse(CreateOperationBodySchema, {
        type: 'invalid',
        params: {},
        description: 'test',
        command: 'test',
      }).success,
    ).toBe(false)
  })
})

describe('BatchOperationsBodySchema', () => {
  it('accepts array of valid operations', () => {
    const result = v.safeParse(BatchOperationsBodySchema, [
      {
        type: 'org:add-user',
        params: { org: 'nuxt', user: 'alice', role: 'developer' },
        description: 'Add alice',
        command: 'npm org set nuxt alice developer',
      },
      {
        type: 'org:add-user',
        params: { org: 'nuxt', user: 'bob', role: 'admin' },
        description: 'Add bob',
        command: 'npm org set nuxt bob admin',
      },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts empty array', () => {
    expect(v.safeParse(BatchOperationsBodySchema, []).success).toBe(true)
  })

  it('rejects array with invalid operation', () => {
    expect(
      v.safeParse(BatchOperationsBodySchema, [
        { type: 'invalid', params: {}, description: 'test', command: 'test' },
      ]).success,
    ).toBe(false)
  })
})

describe('OrgAddUserParamsSchema', () => {
  it('accepts valid org:add-user params', () => {
    const result = v.safeParse(OrgAddUserParamsSchema, {
      org: 'nuxt',
      user: 'alice',
      role: 'developer',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid params', () => {
    expect(v.safeParse(OrgAddUserParamsSchema, {}).success).toBe(false)
    expect(v.safeParse(OrgAddUserParamsSchema, { org: 'nuxt' }).success).toBe(false)
    expect(
      v.safeParse(OrgAddUserParamsSchema, {
        org: 'nuxt',
        user: 'alice',
        role: 'invalid',
      }).success,
    ).toBe(false)
  })
})

describe('AccessGrantParamsSchema', () => {
  it('accepts valid access:grant params', () => {
    const result = v.safeParse(AccessGrantParamsSchema, {
      permission: 'read-write',
      scopeTeam: '@nuxt:developers',
      pkg: '@nuxt/kit',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid params', () => {
    expect(
      v.safeParse(AccessGrantParamsSchema, {
        permission: 'write', // invalid permission
        scopeTeam: '@nuxt:developers',
        pkg: '@nuxt/kit',
      }).success,
    ).toBe(false)
  })
})

describe('safeParse helper', () => {
  it('returns success with data for valid input', () => {
    const result = safeParse(UsernameSchema, 'alice')
    expect(result.success).toBe(true)
    expect(result).toHaveProperty('data', 'alice')
  })

  it('returns error message for invalid input', () => {
    const result = safeParse(UsernameSchema, '')
    expect(result.success).toBe(false)
    expect(result).toHaveProperty('error', 'Username is required')
  })

  it('includes path in error message for nested objects', () => {
    const result = safeParse(OrgAddUserParamsSchema, { org: '', user: 'alice', role: 'developer' })
    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toContain('org')
  })
})

describe('validateOperationParams', () => {
  it('validates org:add-user params', () => {
    expect(() =>
      validateOperationParams('org:add-user', {
        org: 'nuxt',
        user: 'alice',
        role: 'developer',
      }),
    ).not.toThrow()
  })

  it('throws for invalid org:add-user params', () => {
    expect(() => validateOperationParams('org:add-user', { org: 'nuxt' })).toThrow('Invalid key')
  })

  it('validates team:create params', () => {
    expect(() =>
      validateOperationParams('team:create', {
        scopeTeam: '@nuxt:developers',
      }),
    ).not.toThrow()
  })

  it('validates access:grant params', () => {
    expect(() =>
      validateOperationParams('access:grant', {
        permission: 'read-write',
        scopeTeam: '@nuxt:developers',
        pkg: '@nuxt/kit',
      }),
    ).not.toThrow()
  })

  it('validates owner:add params', () => {
    expect(() =>
      validateOperationParams('owner:add', {
        user: 'alice',
        pkg: '@nuxt/kit',
      }),
    ).not.toThrow()
  })

  it('validates package:init params', () => {
    expect(() =>
      validateOperationParams('package:init', {
        name: 'my-package',
      }),
    ).not.toThrow()

    expect(() =>
      validateOperationParams('package:init', {
        name: 'my-package',
        author: 'alice',
      }),
    ).not.toThrow()
  })
})
