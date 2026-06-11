import { describe, expect, it } from 'vitest'
import { ChangelogErrorMsg } from '#components'
import { mountSuspended } from '@nuxt/test-utils/runtime'

describe('Changelog', () => {
  it('Should display error message', async () => {
    const component = await mountSuspended(ChangelogErrorMsg, {
      props: {
        changelogLink: 'https://github.com/npmx-dev/npmx.dev/releases/',
        pkgName: 'npmx-dev',
        viewOnGit: 'View on Github',
      },
    })

    expect(component.text()).toContain(`Sorry, the changelog for npmx-dev couldn't be loaded`)
    expect(component.text()).toContain(`Please try again later or View on Github`)
  })
})
