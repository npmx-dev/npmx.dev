import { createRequire } from 'node:module'
import { expect, test } from './test-utils'

const require = createRequire(import.meta.url)
const spacedustPackageLikeEvents =
  require('../fixtures/spacedust/package-like-events.json') as unknown[]

test.use({ spacedustPackageLikeEvents: [spacedustPackageLikeEvents, { scope: 'test' }] })

test('homepage streams recently liked packages from backfill and Spacedust', async ({
  page,
  goto,
  spacedustWebSocketUrls,
}) => {
  await goto('/', { waitUntil: 'hydration' })

  const widget = page.getByTestId('recently-liked-packages')
  await expect(widget.getByRole('heading', { name: 'Recently liked packages' })).toBeVisible()

  const packageLinks = widget.getByTestId('recently-liked-package')
  await expect(packageLinks).toHaveCount(3, { timeout: 10_000 })
  await expect(packageLinks.nth(0)).toContainText('is-odd')
  await expect(packageLinks.nth(1)).toContainText('ufo')
  await expect(packageLinks.nth(2)).toContainText('vue')

  await expect(widget).toContainText('Returns true if the given number is odd')
  await expect(widget).toContainText('URL utils for humans')
  await expect(widget).toContainText('The progressive JavaScript framework')
  await expect(widget).toContainText('/wk')
  await expect(widget.getByRole('button', { name: 'Like this package' })).toHaveCount(3)

  expect(spacedustWebSocketUrls).toHaveLength(1)
  const spacedustUrl = new URL(spacedustWebSocketUrls[0]!)
  expect(spacedustUrl.searchParams.get('instant')).toBe('true')
  expect(spacedustUrl.searchParams.getAll('wantedSources')).toEqual([
    'dev.npmx.feed.like:subjectRef',
  ])
})
