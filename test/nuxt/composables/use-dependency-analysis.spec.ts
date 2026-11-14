import { expect, it, vi } from 'vite-plus/test'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

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
