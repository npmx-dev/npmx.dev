import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import PackageSecurityDowngradeAlert from '~/components/Package/SecurityDowngradeAlert.vue'

describe('PackageSecurityDowngradeAlert', () => {
  it.each(['vue', '@nuxt/kit'])(
    'links to the trusted-to-downgraded diff for %s',
    async packageName => {
      const component = await mountSuspended(PackageSecurityDowngradeAlert, {
        props: {
          packageName,
          downgrade: {
            downgradedVersion: '2.0.0',
            downgradedTrustLevel: 'none',
            downgradedTrustedPublisher: true,
            trustedVersion: '1.9.0',
            trustedTrustLevel: 'provenance',
          },
          fallbackInstallText: 'Consider installing 1.9.0 instead.',
        },
      })
      const link = component.get('a[href*="/diff/"]')
      expect(link.text()).toBe('File Changes')
      expect(link.attributes('href')).toBe(`/diff/${packageName}/v/1.9.0...2.0.0`)
    },
  )

  it('hides the diff link without a trusted version and hides the alert without a downgrade', async () => {
    const component = await mountSuspended(PackageSecurityDowngradeAlert, {
      props: {
        packageName: 'vue',
        downgrade: {
          downgradedVersion: '2.0.0',
          downgradedTrustLevel: 'none',
          downgradedTrustedPublisher: false,
          trustedTrustLevel: 'provenance',
        },
      },
    })
    expect(component.find('[role="alert"]').exists()).toBe(true)
    expect(component.find('a[href*="/diff/"]').exists()).toBe(false)

    await component.setProps({ downgrade: null })
    expect(component.find('[role="alert"]').exists()).toBe(false)
  })
})
