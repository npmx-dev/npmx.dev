import type { BuildInfo } from '#shared/types'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BuildEnvironment from '~/components/BuildEnvironment.vue'

describe('BuildEnvironment', () => {
  it('renders dev environment correctly', async () => {
    const buildInfo = useAppConfig().buildInfo as BuildInfo
    const component = await mountSuspended(BuildEnvironment, {
      props: {
        buildInfo,
      },
    })
    const html = component.html()

    // In dev mode, it shows env name, not version link
    expect(html).toContain('<span class="tracking-wider">dev</span>')
    expect(html).toContain(
      '<a href="https://github.com/npmx-dev/npmx.dev/commit/704987bba88909f3782d792c224bde989569acb9"',
    )
    expect(html).not.toContain('href="https://github.com/npmx-dev/npmx.dev/tag/v0.0.0"')
  })

  it('renders release environment correctly', async () => {
    const buildInfo: BuildInfo = {
      env: 'release',
      version: '1.2.3',
      time: 1234567890,
      commit: 'abcdef',
      shortCommit: 'abc',
      branch: 'release',
    }

    const component = await mountSuspended(BuildEnvironment, {
      props: {
        buildInfo,
      },
    })
    const html = component.html()

    // In release mode, it shows tag version link, not env name
    expect(html).not.toContain('<span class="tracking-wider">dev</span>')
    expect(html).not.toContain(
      '<a href="https://github.com/npmx-dev/npmx.dev/commit/704987bba88909f3782d792c224bde989569acb9"',
    )
    expect(html).toContain('href="https://github.com/npmx-dev/npmx.dev/tag/v1.2.3"')
  })
})
