import { describe, expect, it, vi } from 'vite-plus/test'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { OwnCollection } from '#shared/types/social'
import { MAX_COLLECTION_ITEMS, PACKAGE_SUBJECT_REF } from '#shared/utils/constants'
import CollectionPicker from '~/components/Collection/Picker.vue'

const DID = 'did:plc:alice'
const ZOD = PACKAGE_SUBJECT_REF('zod')

const own = (rkey: string, name: string, subjectRefs: string[]): OwnCollection => ({
  uri: `at://${DID}/dev.npmx.collection/${rkey}`,
  cid: `cid-${rkey}`,
  did: DID,
  handle: 'alice.test',
  rkey,
  name,
  itemCount: subjectRefs.length,
  createdAt: '2026-01-01T00:00:00.000Z',
  subjectRefs,
})

let collections: OwnCollection[] = []
const changeItems = vi.fn()
const create = vi.fn()

registerEndpoint('/api/auth/session', () => ({ did: DID, handle: 'alice.test' }))
registerEndpoint('/api/social/collections/mine', () => collections)
registerEndpoint(`/api/social/collections/${DID}/b/items`, {
  method: 'POST',
  handler: changeItems,
})
registerEndpoint('/api/social/collections', { method: 'POST', handler: create })

async function mountPicker(packages: string[]) {
  const component = await mountSuspended(CollectionPicker, { props: { packages } })
  await vi.waitFor(() => {
    for (const { name } of collections) expect(component.text()).toContain(name)
  })
  return component
}

const checkbox = (component: Awaited<ReturnType<typeof mountPicker>>, name: string) => {
  const label = component.findAll('label').find(l => l.text().includes(name))!
  return label.find<HTMLInputElement>('input[type="checkbox"]')
}

describe('CollectionPicker', () => {
  it('checks collections that already have the package and adds it to others', async () => {
    collections = [own('a', 'Validation', [ZOD]), own('b', 'Favorites', [])]
    changeItems.mockImplementation(() => ({ cid: 'cid-b2', subjectRefs: [ZOD] }))
    const fetchSpy = vi.spyOn(globalThis, '$fetch')
    const component = await mountPicker(['zod'])

    expect(checkbox(component, 'Validation').element.checked).toBe(true)
    expect(checkbox(component, 'Favorites').element.checked).toBe(false)

    await checkbox(component, 'Favorites').setValue(true)

    // The item count comes from the response, so this proves the save went through
    await vi.waitFor(() => {
      const label = component.findAll('label').find(l => l.text().includes('Favorites'))!
      expect(label.text()).toContain('1 item')
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/social/collections/${encodeURIComponent(DID)}/b/items`,
      { method: 'POST', body: { add: [ZOD] } },
    )
    fetchSpy.mockRestore()
    expect(checkbox(component, 'Favorites').element.checked).toBe(true)
  })

  it('puts the checkbox back and says so when a save fails', async () => {
    // No endpoint is registered for this collection's items, so the save fails
    collections = [own('unsaveable', 'Broken', [])]
    const component = await mountPicker(['zod'])

    await checkbox(component, 'Broken').setValue(true)

    await vi.waitFor(() => expect(component.find('[role="alert"]').exists()).toBe(true))
    expect(checkbox(component, 'Broken').element.checked).toBe(false)
  })

  it('shows a partial selection as indeterminate', async () => {
    collections = [own('a', 'Validation', [ZOD])]
    const component = await mountPicker(['zod', 'valibot'])
    expect(checkbox(component, 'Validation').element.indeterminate).toBe(true)
  })

  it('disables collections with no room left', async () => {
    collections = [
      own(
        'a',
        'Everything',
        Array.from({ length: MAX_COLLECTION_ITEMS }, (_, i) => PACKAGE_SUBJECT_REF(`pkg-${i}`)),
      ),
    ]
    const component = await mountPicker(['zod'])
    expect(checkbox(component, 'Everything').element.disabled).toBe(true)
    expect(component.text()).toContain('Full')
  })

  it('creates a new collection containing the packages', async () => {
    collections = [own('a', 'Validation', [])]
    create.mockImplementation(() => {
      collections = [...collections, own('c', 'Schema libs', [ZOD])]
      return { uri: collections[1]!.uri, cid: 'cid-c', did: DID, rkey: 'c' }
    })
    const component = await mountPicker(['zod'])

    await component.find('input[placeholder="Name"]').setValue('Schema libs')
    await component.find('form').trigger('submit')

    await vi.waitFor(() => expect(checkbox(component, 'Schema libs').element.checked).toBe(true))
    expect(create).toHaveBeenCalledOnce()
  })
})
