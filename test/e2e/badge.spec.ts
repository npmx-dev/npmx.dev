import { expect, test } from '@nuxt/test-utils/playwright'

function toLocalUrl(baseURL: string | undefined, path: string): string {
  if (!baseURL) return path
  return baseURL.endsWith('/') ? `${baseURL}${path.slice(1)}` : `${baseURL}${path}`
}

async function fetchBadge(page: { request: { get: (url: string) => Promise<any> } }, url: string) {
  const response = await page.request.get(url)
  const body = await response.text()
  return { response, body }
}

test.describe('badge API', () => {
  const badgeMap: Record<string, string> = {
    'version': 'version',
    'license': 'license',
    'size': 'install size',
    'downloads': 'downloads/mo',
    'downloads-day': 'downloads/day',
    'downloads-week': 'downloads/wk',
    'downloads-month': 'downloads/mo',
    'downloads-year': 'downloads/yr',
    'vulnerabilities': 'vulns',
    'dependencies': 'dependencies',
    'updated': 'updated',
    'engines': 'node',
    'types': 'types',
    'created': 'created',
    'maintainers': 'maintainers',
    'deprecated': 'status',
    'quality': 'quality',
    'popularity': 'popularity',
    'maintenance': 'maintenance',
    'score': 'score',
  }

  const percentageTypes = new Set(['quality', 'popularity', 'maintenance', 'score'])

  for (const [type, expectedLabel] of Object.entries(badgeMap)) {
    test.describe(`${type} badge`, () => {
      test('renders correct label', async ({ page, baseURL }) => {
        const url = toLocalUrl(baseURL, `/api/registry/badge/${type}/nuxt`)
        const { response, body } = await fetchBadge(page, url)

        expect(response.status()).toBe(200)
        expect(response.headers()['content-type']).toContain('image/svg+xml')
        expect(body).toContain(expectedLabel)
      })

      test('scoped package renders successfully', async ({ page, baseURL }) => {
        const url = toLocalUrl(baseURL, `/api/registry/badge/${type}/@nuxt/kit`)
        const { response } = await fetchBadge(page, url)

        expect(response.status()).toBe(200)
      })

      test('explicit version badge renders successfully', async ({ page, baseURL }) => {
        const url = toLocalUrl(baseURL, `/api/registry/badge/${type}/nuxt/v/3.12.0`)
        const { response, body } = await fetchBadge(page, url)

        expect(response.status()).toBe(200)
        if (type === 'version') {
          expect(body).toContain('3.12.0')
        }
      })

      test('respects name=true parameter', async ({ page, baseURL }) => {
        const packageName = 'nuxt'
        const url = toLocalUrl(baseURL, `/api/registry/badge/${type}/${packageName}?name=true`)
        const { body } = await fetchBadge(page, url)

        expect(body).toContain(packageName)
        expect(body).not.toContain(expectedLabel)
      })

      if (percentageTypes.has(type)) {
        test('contains percentage value', async ({ page, baseURL }) => {
          const url = toLocalUrl(baseURL, `/api/registry/badge/${type}/vue`)
          const { body } = await fetchBadge(page, url)

          expect(body).toMatch(/\d+%|unknown/)
        })
      }
    })
  }

  test.describe('specific scenarios', () => {
    test('downloads-year handles large numbers', async ({ page, baseURL }) => {
      const url = toLocalUrl(baseURL, '/api/registry/badge/downloads-year/lodash')
      const { body } = await fetchBadge(page, url)

      expect(body).toContain('downloads/yr')
      expect(body).not.toContain('NaN')
    })

    test('deprecated badge shows active for non-deprecated packages', async ({ page, baseURL }) => {
      const url = toLocalUrl(baseURL, '/api/registry/badge/deprecated/vue')
      const { body } = await fetchBadge(page, url)

      expect(body).toContain('active')
    })
  })

  test('custom color parameter is applied to SVG', async ({ page, baseURL }) => {
    const customColor = 'ff69b4'
    const url = toLocalUrl(baseURL, `/api/registry/badge/version/nuxt?color=${customColor}`)
    const { body } = await fetchBadge(page, url)

    expect(body).toContain(`fill="#${customColor}"`)
  })

  test('invalid badge type defaults to version strategy', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/badge/invalid-type/nuxt')
    const { body } = await fetchBadge(page, url)

    expect(body).toContain('version')
  })

  test('missing package returns 404', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/badge/version/')
    const { response } = await fetchBadge(page, url)

    expect(response.status()).toBe(404)
  })
})
