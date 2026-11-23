import { expect, it, vi } from 'vite-plus/test'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { PackageDeprecatedTree } from '#components'

it('sends one request when several components use the same analysis', async () => {
  let requests = 0
  registerEndpoint('/api/registry/vulnerabilities/shared-analysis/v/1.0.0', () => {
    requests++
    return { vulnerablePackages: [] }
  })

  const Consumer = defineComponent({
    setup() {
      const { data } = useDependencyAnalysis('shared-analysis', '1.0.0')
      return () => h('div', data.value ? 'loaded' : 'pending')
    },
  })
  const wrapper = await mountSuspended(
    defineComponent({ render: () => [h(Consumer), h(Consumer), h(Consumer)] }),
  )

  await vi.waitFor(() => expect(wrapper.text()).toBe('loadedloadedloaded'))
  expect(requests).toBe(1)
})

it('shows only direct and transitive dependencies in the deprecated tree', async () => {
  const props = { packageName: 'deprecated-root', version: '1.0.0' }
  registerEndpoint('/api/registry/vulnerabilities/deprecated-root/v/1.0.0', () => ({
    deprecatedPackages: [
      { name: 'deprecated-root', version: '1.0.0', depth: 'root' },
      { name: 'direct-dep', version: '1.0.0', depth: 'direct' },
      { name: 'transitive-dep', version: '1.0.0', depth: 'transitive' },
    ],
  }))

  const wrapper = await mountSuspended(PackageDeprecatedTree, { props })
  await vi.waitFor(() => expect(wrapper.get('button').text()).toBe('2 deprecated dependencies'))
  await wrapper.get('button').trigger('click')

  expect(wrapper.findAll('li a').map(link => link.text())).toEqual([
    'direct-dep@1.0.0',
    'transitive-dep@1.0.0',
  ])
})
