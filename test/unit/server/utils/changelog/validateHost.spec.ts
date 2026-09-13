import type { ProviderId } from '~~/shared/utils/git-providers'
import { describe, expect, it } from 'vitest'
import { object, safeParse } from 'valibot'
import { validateHostWithValibot } from '~~/server/utils/changelog/validateHost'

function createSchema(provider: ProviderId) {
  return object({
    host: validateHostWithValibot(provider),
  })
}

// host === 'radicle.at' || host === 'app.radicle.at' || host === 'seed.radicle.at',
describe("shouldn't require 'host' from providers that don't need it", () => {
  it('should allow github without host', () => {
    const schema = createSchema('github')
    expect(safeParse(schema, {}).success).toBeTruthy()
  })

  it('should allow codeberg without host', () => {
    const schema = createSchema('codeberg')
    expect(safeParse(schema, {}).success).toBeTruthy()
  })

  it('should allow tangled without host', () => {
    const schema = createSchema('tangled')
    expect(safeParse(schema, {}).success).toBeTruthy()
  })
})

describe('should require host to be given', () => {
  it('should require gitlab to have a host', () => {
    const schema = createSchema('gitlab')
    expect(safeParse(schema, {}).success).toBeFalsy()
  })

  it('should require forgejo to have a host', () => {
    const schema = createSchema('forgejo')
    expect(safeParse(schema, {}).success).toBeFalsy()
  })

  it('should require gitea to have a host', () => {
    const schema = createSchema('gitea')
    expect(safeParse(schema, {}).success).toBeFalsy()
  })

  it('should require radicle to have a host', () => {
    const schema = createSchema('radicle')
    expect(safeParse(schema, {}).success).toBeFalsy()
  })
})

describe('should only allow known host for provider', () => {
  describe('gitlab', () => {
    it('should allow gitlab', () => {
      const schema = createSchema('gitlab')
      expect(safeParse(schema, { host: 'gitlab.com' }).success).toBeTruthy()
    })

    it('should allow framagit.org', () => {
      const schema = createSchema('gitlab')
      expect(safeParse(schema, { host: 'framagit.org' }).success).toBeTruthy()
    })

    it("shouldn't allow next.forgejo.org", () => {
      const schema = createSchema('gitlab')
      expect(safeParse(schema, { host: 'next.forgejo.org' }).success).toBeFalsy()
    })
    it("shouldn't allow gitea.com", () => {
      const schema = createSchema('gitlab')
      expect(safeParse(schema, { host: 'gitea.com' }).success).toBeFalsy()
    })

    it("shouldn't allow radicle.at", () => {
      const schema = createSchema('gitlab')
      expect(safeParse(schema, { host: 'radicle.at' }).success).toBeFalsy()
    })

    it("shouldn't allow seed.radicle.at", () => {
      const schema = createSchema('gitlab')
      expect(safeParse(schema, { host: 'seed.radicle.at' }).success).toBeFalsy()
    })

    it("shouldn't allow banana.org", () => {
      const schema = createSchema('gitlab')
      expect(safeParse(schema, { host: 'banana.org' }).success).toBeFalsy()
    })
  })

  describe('forgejo', () => {
    it("shouldn't allow gitlab", () => {
      const schema = createSchema('forgejo')
      expect(safeParse(schema, { host: 'gitlab.com' }).success).toBeFalsy()
    })

    it("shouldn't allow framagit.org", () => {
      const schema = createSchema('forgejo')
      expect(safeParse(schema, { host: 'framagit.org' }).success).toBeFalsy()
    })

    it('should allow next.forgejo.org', () => {
      const schema = createSchema('forgejo')
      expect(safeParse(schema, { host: 'next.forgejo.org' }).success).toBeTruthy()
    })

    it("shouldn't allow gitea.com", () => {
      const schema = createSchema('forgejo')
      expect(safeParse(schema, { host: 'gitea.com' }).success).toBeFalsy()
    })

    it("shouldn't allow radicle.at", () => {
      const schema = createSchema('forgejo')
      expect(safeParse(schema, { host: 'radicle.at' }).success).toBeFalsy()
    })

    it("shouldn't allow seed.radicle.at", () => {
      const schema = createSchema('forgejo')
      expect(safeParse(schema, { host: 'seed.radicle.at' }).success).toBeFalsy()
    })

    it("shouldn't allow banana.org", () => {
      const schema = createSchema('forgejo')
      expect(safeParse(schema, { host: 'banana.org' }).success).toBeFalsy()
    })
  })

  describe('gitea', () => {
    it("shouldn't allow gitlab", () => {
      const schema = createSchema('gitea')
      expect(safeParse(schema, { host: 'gitlab.com' }).success).toBeFalsy()
    })

    it("shouldn't allow framagit.org", () => {
      const schema = createSchema('gitea')
      expect(safeParse(schema, { host: 'framagit.org' }).success).toBeFalsy()
    })

    it("shouldn't allow next.forgejo.org", () => {
      const schema = createSchema('gitea')
      expect(safeParse(schema, { host: 'next.forgejo.org' }).success).toBeFalsy()
    })

    it('should allow gitea.com', () => {
      const schema = createSchema('gitea')
      expect(safeParse(schema, { host: 'gitea.com' }).success).toBeTruthy()
    })

    it("shouldn't allow radicle.at", () => {
      const schema = createSchema('gitea')
      expect(safeParse(schema, { host: 'radicle.at' }).success).toBeFalsy()
    })

    it("shouldn't allow seed.radicle.at", () => {
      const schema = createSchema('gitea')
      expect(safeParse(schema, { host: 'seed.radicle.at' }).success).toBeFalsy()
    })

    it("shouldn't allow banana.org", () => {
      const schema = createSchema('gitea')
      expect(safeParse(schema, { host: 'banana.org' }).success).toBeFalsy()
    })
  })

  describe('radicle', () => {
    it("shouldn't allow gitlab", () => {
      const schema = createSchema('radicle')
      expect(safeParse(schema, { host: 'gitlab.com' }).success).toBeFalsy()
    })

    it("shouldn't allow framagit.org", () => {
      const schema = createSchema('radicle')
      expect(safeParse(schema, { host: 'framagit.org' }).success).toBeFalsy()
    })

    it("shouldn't allow next.forgejo.org", () => {
      const schema = createSchema('radicle')
      expect(safeParse(schema, { host: 'next.forgejo.org' }).success).toBeFalsy()
    })

    it("shouldn't allow gitea.com", () => {
      const schema = createSchema('radicle')
      expect(safeParse(schema, { host: 'gitea.com' }).success).toBeFalsy()
    })

    it('should allow radicle.at', () => {
      const schema = createSchema('radicle')
      expect(safeParse(schema, { host: 'radicle.at' }).success).toBeTruthy()
    })

    it('should allow seed.radicle.at', () => {
      const schema = createSchema('radicle')
      expect(safeParse(schema, { host: 'seed.radicle.at' }).success).toBeTruthy()
    })

    it("shouldn't allow banana.org", () => {
      const schema = createSchema('radicle')
      expect(safeParse(schema, { host: 'banana.org' }).success).toBeFalsy()
    })
  })
})
