import { describe, expect, it } from 'vitest'

describe('runtime environment', () => {
  it('should work', () => {
    expect(useRuntimeConfig().app).toMatchInlineSnapshot(`
      {
        "baseURL": "/",
        "buildAssetsDir": "/_nuxt/",
        "buildId": "test",
        "cdnURL": "",
      }
    `)
  })
})
