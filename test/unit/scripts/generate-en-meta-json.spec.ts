import { describe, expect, it } from 'vitest'
import { makeEnMetaJson } from '#scripts/i18n-meta/update-en-meta-json'

describe('Create en.meta.json', () => {
  it('should handle an empty en.json file', () => {
    const oldEnMetaJson = {}
    const newEnJson = {}

    const enMetaJson = makeEnMetaJson(oldEnMetaJson, newEnJson, 'sha-new-12345')
    expect(enMetaJson).toEqual({})
  })

  it('should generate en.meta.json correctly for an initial en.json', () => {
    const oldEnMetaJson = {}
    const newEnJson = {
      tagline: 'npmx - a fast, modern browser for the npm registry',
    }

    const enMetaJson = makeEnMetaJson(oldEnMetaJson, newEnJson, 'sha-new-12345')
    expect(enMetaJson).toEqual({
      tagline: {
        text: 'npmx - a fast, modern browser for the npm registry',
        commit: 'sha-new-12345',
      },
    })
  })

  it('should update existing keys and add new keys with the latest commit hash', () => {
    const oldEnMetaJson = {
      name: {
        text: 'npmx',
        commit: 'sha-old-12345',
      },
      tagline: {
        text: 'npmx - a better browser for the npm registry',
        commit: 'sha-old-12345',
      },
    }
    const newEnJson = {
      name: 'npmx',
      tagline: 'npmx - a fast, modern browser for the npm registry',
      description: 'Search, browse, and explore packages with a modern interface.',
    }

    const enMetaJson = makeEnMetaJson(oldEnMetaJson, newEnJson, 'sha-new-12345')
    expect(enMetaJson).toEqual({
      name: {
        text: 'npmx',
        commit: 'sha-old-12345',
      },
      tagline: {
        text: 'npmx - a fast, modern browser for the npm registry',
        commit: 'sha-new-12345',
      },
      description: {
        text: 'Search, browse, and explore packages with a modern interface.',
        commit: 'sha-new-12345',
      },
    })
  })

  it('should remove keys that are no longer in en.json', () => {
    const oldEnMetaJson = {
      tagline: {
        text: 'npmx - a fast, modern browser for the npm registry',
        commit: 'sha-old-12345',
      },
      toBeRemoved: { text: 'This will be gone', commit: 'sha-old-12345' },
    }
    const newEnJson = {
      tagline: 'npmx - a fast, modern browser for the npm registry',
    }

    const enMetaJson = makeEnMetaJson(oldEnMetaJson, newEnJson, 'sha-new-12345')
    expect(enMetaJson).toEqual({
      tagline: {
        text: 'npmx - a fast, modern browser for the npm registry',
        commit: 'sha-old-12345',
      },
    })
  })

  it('should handle complex nested structures', () => {
    const oldEnMetaJson = {
      a: {
        b: {
          text: 'value-b',
          commit: 'sha-old-12345',
        },
      },
      c: {
        text: 'value-c',
        commit: 'sha-old-12345',
      },
      d: {
        text: 'added-value',
        commit: 'sha-new-12345',
      },
    }
    const newEnJson = {
      a: {
        b: 'updated-value',
      },
      c: 'value-c',
      d: 'added-value',
    }

    const enMetaJson = makeEnMetaJson(oldEnMetaJson, newEnJson, 'sha-new-12345')
    expect(enMetaJson).toEqual({
      a: {
        b: { text: 'updated-value', commit: 'sha-new-12345' },
      },
      c: { text: 'value-c', commit: 'sha-old-12345' },
      d: { text: 'added-value', commit: 'sha-new-12345' },
    })
  })
})
