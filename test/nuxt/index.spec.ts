import { describe, expect, it } from 'vite-plus/test'

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
