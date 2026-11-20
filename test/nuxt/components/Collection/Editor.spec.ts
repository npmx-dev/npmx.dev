import { describe, expect, it, vi } from 'vite-plus/test'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CollectionEditor from '~/components/Collection/Editor.vue'
import { PACKAGE_SUBJECT_REF } from '#shared/utils/constants'

vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ objects: [], total: 0, time: '' }))

describe('CollectionEditor', () => {
  it('says why a collection from another app cannot be saved yet', async () => {
    const component = await mountSuspended(CollectionEditor, {
      props: {
        initial: {
          name: 'From elsewhere',
          items: [
            {
              kind: 'package',
              subjectRef: PACKAGE_SUBJECT_REF('zod'),
              packageName: 'zod',
              resolved: true,
            },
            { kind: 'unknown', subjectRef: 'https://example.com/thing' },
          ],
        },
      },
    })
    expect(component.find('[role="alert"]').exists()).toBe(false)
    expect(component.text()).toContain('Not recognized')

    await component.find('form').trigger('submit')

    expect(component.emitted('submit')).toBeUndefined()
    expect(component.find('[role="alert"]').text()).toContain('Remove the items marked')

    const removeButtons = component.findAll('button[aria-label^="Remove"]')
    await removeButtons[1]!.trigger('click')
    expect(component.find('[role="alert"]').exists()).toBe(false)

    await component.find('form').trigger('submit')
    expect(component.emitted('submit')).toHaveLength(1)
  })
})
