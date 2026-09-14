import type { RecentPackageLike } from '~/utils/recent-package-likes'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import RecentlyLiked from '~/components/Landing/RecentlyLiked.vue'

const packageLikesStub = {
  template: '<button type="button" data-testid="package-likes-stub">Like</button>',
}

function like(overrides: Partial<RecentPackageLike> = {}): RecentPackageLike {
  const packageName = overrides.packageName ?? 'vue'
  const rkey = packageName.replaceAll('/', '-')

  return {
    id: `at://did:plc:test/dev.npmx.feed.like/${rkey}`,
    packageName,
    origin: 'recent',
    subjectRef: `https://npmx.dev/package/${packageName}`,
    likedAt: Date.parse('2026-05-09T12:28:11.127Z'),
    ...overrides,
  }
}

describe('LandingRecentlyLiked', () => {
  it('reserves space while the startup seed is loading', async () => {
    const wrapper = await mountSuspended(RecentlyLiked, {
      props: { isLoading: true, likes: [] },
      global: { stubs: { PackageLikes: packageLikesStub } },
    })

    expect(wrapper.find('[data-testid="recently-liked-packages"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="recently-liked-skeleton"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="recently-liked-skeleton"] li')).toHaveLength(5)
  })

  it('renders recent package likes as package links', async () => {
    const wrapper = await mountSuspended(RecentlyLiked, {
      props: {
        isLoading: false,
        likes: [
          like({
            packageDescription: 'The progressive JavaScript framework',
            weeklyDownloads: 12_345,
            repositoryStars: 55_555,
          }),
        ],
      },
      global: { stubs: { PackageLikes: packageLikesStub } },
    })

    const link = wrapper.find('[data-testid="recently-liked-package"]')

    expect(wrapper.text()).toContain('Recently liked')
    expect(link.text()).toContain('vue')
    expect(link.text()).toContain('liked')
    expect(link.text()).toContain('The progressive JavaScript framework')
    expect(wrapper.text()).toContain('55.6K')
    expect(wrapper.text()).toContain('12.3K/wk')
    expect(wrapper.find('[data-testid="recently-liked-time"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('recent package love')
    expect(wrapper.find('[data-testid="package-likes-stub"]').exists()).toBe(true)
    expect(link.attributes('href')).toBe('/package/vue')
  })

  it('applies the entry animation to live and staged likes', async () => {
    const wrapper = await mountSuspended(RecentlyLiked, {
      props: {
        isLoading: false,
        likes: [
          like({
            origin: 'live',
          }),
          like({
            id: 'at://did:plc:test/dev.npmx.feed.like/staged',
            packageName: 'nuxt',
            likedAt: Date.parse('2026-05-09T12:24:11.127Z'),
            animateEntry: true,
          }),
          like({
            id: 'at://did:plc:test/dev.npmx.feed.like/recent',
            packageName: 'nuxt',
            likedAt: Date.parse('2026-05-09T12:20:11.127Z'),
          }),
        ],
      },
      global: { stubs: { PackageLikes: packageLikesStub } },
    })

    const cards = wrapper.findAll('article')
    expect(cards[0]?.classes()).toContain('recently-liked-entry')
    expect(cards[1]?.classes()).toContain('recently-liked-entry')
    expect(cards[2]?.classes()).not.toContain('recently-liked-entry')
  })

  it('scopes screen reader announcements to newly inserted live likes', async () => {
    const wrapper = await mountSuspended(RecentlyLiked, {
      props: { isLoading: false, likes: [] },
      global: { stubs: { PackageLikes: packageLikesStub } },
    })

    const section = wrapper.find('[data-testid="recently-liked-packages"]')
    const status = wrapper.find('[role="status"][aria-live="polite"]')

    expect(section.attributes('aria-live')).toBeUndefined()
    expect(status.text()).toBe('')

    await wrapper.setProps({
      likes: [
        like({
          id: 'at://did:plc:test/dev.npmx.feed.like/recent',
          packageName: 'nuxt',
          likedAt: Date.parse('2026-05-09T12:20:11.127Z'),
          animateEntry: true,
        }),
      ],
    })
    await nextTick()

    expect(status.text()).toBe('')

    await wrapper.setProps({
      likes: [
        like({
          origin: 'live',
          animateEntry: true,
        }),
        like({
          id: 'at://did:plc:test/dev.npmx.feed.like/recent',
          packageName: 'nuxt',
          likedAt: Date.parse('2026-05-09T12:20:11.127Z'),
          animateEntry: true,
        }),
      ],
    })
    await nextTick()

    expect(status.text()).toBe('vue was liked')
  })
})
