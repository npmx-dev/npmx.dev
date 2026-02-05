import type { BuildInfo } from '#shared/types'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BuildEnvironment from '~/components/BuildEnvironment.vue'

describe('BuildEnvironment', () => {
  it('renders dev environment correctly', async () => {
    const buildInfo: BuildInfo = {
      env: 'dev',
      version: '1.2.3',
      time: 1234567890,
      commit: 'abcdef',
      shortCommit: 'abc',
      branch: 'main',
    }
    const component = await mountSuspended(BuildEnvironment, {
      props: {
        buildInfo,
      },
    })

    // In dev mode, it shows env name, not version link
    const envSpan = component.find('span.tracking-wider')
    expect(envSpan.exists()).toBe(true)
    expect(envSpan.text()).toBe(buildInfo.env)
    const commitLink = component.find(`a[href$="/commit/${buildInfo.commit}"]`)
    expect(commitLink.exists()).toBe(true)
    const tagLink = component.find(`a[href$="/tag/v${buildInfo.commit}"]`)
    expect(tagLink.exists()).toBe(false)
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

    // In release mode, it shows tag version link, not env name
    const envSpan = component.find('span.tracking-wider')
    expect(envSpan.exists()).toBe(false)
    const commitLink = component.find(`a[href$="/commit/${buildInfo.commit}"]`)
    expect(commitLink.exists()).toBe(false)
    const tagLink = component.find(`a[href$="/tag/v${buildInfo.version}"]`)
    expect(tagLink.exists()).toBe(true)
  })
})
