import { describe, expect, it } from 'vitest'
import {
  validateUsername,
  validateOrgName,
  validateScopeTeam,
  validatePackageName,
} from '../../../cli/src/npm-client.ts'

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    expect(() => validateUsername('alice')).not.toThrow()
    expect(() => validateUsername('bob123')).not.toThrow()
    expect(() => validateUsername('my-user')).not.toThrow()
    expect(() => validateUsername('user-name-123')).not.toThrow()
    expect(() => validateUsername('a')).not.toThrow()
    expect(() => validateUsername('A1')).not.toThrow()
  })

  it('rejects empty or missing usernames', () => {
    expect(() => validateUsername('')).toThrow('Invalid username')
    expect(() => validateUsername(null as unknown as string)).toThrow('Invalid username')
    expect(() => validateUsername(undefined as unknown as string)).toThrow('Invalid username')
  })

  it('rejects usernames that are too long', () => {
    const longName = 'a'.repeat(51)
    expect(() => validateUsername(longName)).toThrow('Invalid username')
  })

  it('rejects usernames with invalid characters', () => {
    expect(() => validateUsername('user;rm -rf')).toThrow('Invalid username')
    expect(() => validateUsername('user && evil')).toThrow('Invalid username')
    expect(() => validateUsername('$(whoami)')).toThrow('Invalid username')
    expect(() => validateUsername('user`id`')).toThrow('Invalid username')
    expect(() => validateUsername('user|cat')).toThrow('Invalid username')
    expect(() => validateUsername('user name')).toThrow('Invalid username')
    expect(() => validateUsername('user.name')).toThrow('Invalid username')
    expect(() => validateUsername('user_name')).toThrow('Invalid username')
    expect(() => validateUsername('user@name')).toThrow('Invalid username')
  })

  it('rejects usernames starting or ending with hyphen', () => {
    expect(() => validateUsername('-username')).toThrow('Invalid username')
    expect(() => validateUsername('username-')).toThrow('Invalid username')
    expect(() => validateUsername('-')).toThrow('Invalid username')
  })
})

describe('validateOrgName', () => {
  it('accepts valid org names', () => {
    expect(() => validateOrgName('nuxt')).not.toThrow()
    expect(() => validateOrgName('my-org')).not.toThrow()
    expect(() => validateOrgName('org123')).not.toThrow()
  })

  it('rejects empty or missing org names', () => {
    expect(() => validateOrgName('')).toThrow('Invalid org name')
  })

  it('rejects org names that are too long', () => {
    const longName = 'a'.repeat(51)
    expect(() => validateOrgName(longName)).toThrow('Invalid org name')
  })

  it('rejects org names with shell injection characters', () => {
    expect(() => validateOrgName('org;rm -rf /')).toThrow('Invalid org name')
    expect(() => validateOrgName('org && evil')).toThrow('Invalid org name')
    expect(() => validateOrgName('$(whoami)')).toThrow('Invalid org name')
  })
})

describe('validateScopeTeam', () => {
  it('accepts valid scope:team format', () => {
    expect(() => validateScopeTeam('@nuxt:developers')).not.toThrow()
    expect(() => validateScopeTeam('@my-org:my-team')).not.toThrow()
    expect(() => validateScopeTeam('@org123:team456')).not.toThrow()
    expect(() => validateScopeTeam('@a:b')).not.toThrow()
  })

  it('rejects empty or missing scope:team', () => {
    expect(() => validateScopeTeam('')).toThrow('Invalid scope:team')
    expect(() => validateScopeTeam(null as unknown as string)).toThrow('Invalid scope:team')
  })

  it('rejects scope:team that is too long', () => {
    const longScopeTeam = '@' + 'a'.repeat(50) + ':' + 'b'.repeat(50)
    expect(() => validateScopeTeam(longScopeTeam)).toThrow('Invalid scope:team')
  })

  it('rejects invalid scope:team format', () => {
    expect(() => validateScopeTeam('nuxt:developers')).toThrow('Invalid scope:team format')
    expect(() => validateScopeTeam('@nuxt')).toThrow('Invalid scope:team format')
    expect(() => validateScopeTeam('developers')).toThrow('Invalid scope:team format')
    expect(() => validateScopeTeam('@:team')).toThrow('Invalid scope:team format')
    expect(() => validateScopeTeam('@org:')).toThrow('Invalid scope:team format')
  })

  it('rejects scope:team with shell injection in scope', () => {
    expect(() => validateScopeTeam('@org;rm:team')).toThrow('Invalid scope:team format')
    expect(() => validateScopeTeam('@$(whoami):team')).toThrow('Invalid scope:team format')
  })

  it('rejects scope:team with shell injection in team', () => {
    expect(() => validateScopeTeam('@org:team;rm')).toThrow('Invalid scope:team format')
    expect(() => validateScopeTeam('@org:$(whoami)')).toThrow('Invalid scope:team format')
  })

  it('rejects scope or team starting/ending with hyphen', () => {
    expect(() => validateScopeTeam('@-org:team')).toThrow('Invalid scope:team format')
    expect(() => validateScopeTeam('@org-:team')).toThrow('Invalid scope:team format')
    expect(() => validateScopeTeam('@org:-team')).toThrow('Invalid scope:team format')
    expect(() => validateScopeTeam('@org:team-')).toThrow('Invalid scope:team format')
  })
})

describe('validatePackageName', () => {
  it('accepts valid package names', () => {
    expect(() => validatePackageName('my-package')).not.toThrow()
    expect(() => validatePackageName('@scope/package')).not.toThrow()
    expect(() => validatePackageName('package123')).not.toThrow()
  })

  it('rejects package names with shell injection', () => {
    expect(() => validatePackageName('pkg;rm -rf /')).toThrow('Invalid package name')
    expect(() => validatePackageName('pkg && evil')).toThrow('Invalid package name')
    expect(() => validatePackageName('$(whoami)')).toThrow('Invalid package name')
  })

  it('rejects empty package names', () => {
    expect(() => validatePackageName('')).toThrow('Invalid package name')
  })
})
