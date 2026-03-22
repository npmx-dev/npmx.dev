import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CopyToClipboardButton from '~/components/CopyToClipboardButton.vue'

describe('CopyToClipboardButton', () => {
  it('aria-label matches visible copy text when copyText is provided', async () => {
    const wrapper = await mountSuspended(CopyToClipboardButton, {
      props: {
        copied: false,
        copyText: 'Copy package name',
      },
    })

    const button = wrapper.find('button')
    expect(button.attributes('aria-label')).toBe('Copy package name')
    expect(button.text()).toContain('Copy package name')
  })

  it('aria-label uses ariaLabelCopy when explicitly provided', async () => {
    const wrapper = await mountSuspended(CopyToClipboardButton, {
      props: {
        copied: false,
        copyText: 'Copy package name',
        ariaLabelCopy: 'Copy the package name to clipboard',
      },
    })

    const button = wrapper.find('button')
    expect(button.attributes('aria-label')).toBe('Copy the package name to clipboard')
  })

  it('aria-label reflects copiedText when copied is true', async () => {
    const wrapper = await mountSuspended(CopyToClipboardButton, {
      props: {
        copied: true,
        copyText: 'Copy package name',
        copiedText: 'Copied!',
      },
    })

    const button = wrapper.find('button')
    expect(button.attributes('aria-label')).toBe('Copied!')
    expect(button.text()).toContain('Copied!')
  })

  it('aria-label matches visible text - no label/content mismatch', async () => {
    const wrapper = await mountSuspended(CopyToClipboardButton, {
      props: {
        copied: false,
        copyText: 'Copy install command',
      },
    })

    const button = wrapper.find('button')
    const ariaLabel = button.attributes('aria-label') ?? ''
    const visibleText = button.text()
    // The aria-label should equal the visible text (not some other string)
    expect(visibleText).toContain(ariaLabel)
  })
})
