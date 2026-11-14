import { expect, it, vi } from 'vite-plus/test'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { replacementsBaseURL } from '#module-replacements'

it('only requests packages that have a module replacement', async () => {
  const requested: string[] = []
  for (const name of ['is-even', 'react', 'is-odd']) {
    registerEndpoint(`${replacementsBaseURL}/${name}.json`, () => {
      requested.push(name)
      return {
        mapping: { replacements: [`snippet::${name}`] },
        replacement: { id: `snippet::${name}`, type: 'simple', example: 'example' },
      }
    })
  }

  const name = ref('is-even')
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        const { data, status } = useModuleReplacement(name)
        return () => h('div', `${status.value}:${data.value?.replacement.id ?? 'none'}`)
      },
    }),
  )

  await vi.waitFor(() => expect(wrapper.text()).toBe('success:snippet::is-even'))
  name.value = 'react'
  await vi.waitFor(() => expect(wrapper.text()).toBe('success:none'))
  name.value = 'is-odd'
  await vi.waitFor(() => expect(wrapper.text()).toBe('success:snippet::is-odd'))
  expect(requested).toEqual(['is-even', 'is-odd'])
})
