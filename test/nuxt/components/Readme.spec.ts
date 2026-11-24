import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, onTestFinished } from 'vite-plus/test'
import Readme from '~/components/Readme.vue'

const darkImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="black"/></svg>')}`
const lightImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="white"/></svg>')}`
const html = `<picture>
  <source srcset="${darkImage}" media="(prefers-color-scheme: dark)">
  <source srcset="${lightImage}" media="(prefers-color-scheme: light)">
  <img src="${lightImage}" alt="Theme-aware image" width="100" height="60">
</picture>`

async function mountReadme(markdownHtml = html) {
  const component = await mountSuspended(Readme, {
    attachTo: document.body,
    props: { html: markdownHtml },
  })
  onTestFinished(() => component.unmount())
  return component
}

describe('README image color mode', () => {
  beforeEach(() => {
    const colorMode = useColorMode()
    const preference = colorMode.preference
    const unknown = colorMode.unknown
    colorMode.preference = 'system'

    return async () => {
      colorMode.preference = preference
      colorMode.unknown = unknown
      await nextTick()
    }
  })

  it.each(['dark', 'light'])('selects the %s image for an explicit site theme', async theme => {
    useColorMode().preference = theme
    const wrapper = await mountReadme()
    const image = wrapper.get('img').element

    await expect.poll(() => image.currentSrc).toBe(theme === 'dark' ? darkImage : lightImage)
    await expect.poll(() => image.naturalWidth).toBe(100)
  })

  it('updates the image when the site theme changes', async () => {
    const colorMode = useColorMode()
    colorMode.preference = 'dark'
    const wrapper = await mountReadme()

    colorMode.preference = 'light'
    await expect.poll(() => wrapper.get('img').element.currentSrc).toBe(lightImage)

    colorMode.preference = 'dark'
    await expect.poll(() => wrapper.get('img').element.currentSrc).toBe(darkImage)
  })

  it('restores native media queries when returning to the system theme', async () => {
    const colorMode = useColorMode()
    colorMode.preference = 'dark'
    const wrapper = await mountReadme()

    colorMode.preference = 'system'
    await nextTick()

    expect(wrapper.findAll('source').map(source => source.attributes('media'))).toEqual([
      '(prefers-color-scheme: dark)',
      '(prefers-color-scheme: light)',
    ])
    const systemImage = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? darkImage
      : lightImage
    await expect.poll(() => wrapper.get('img').element.currentSrc).toBe(systemImage)
  })

  it('applies the selected theme when README content is replaced', async () => {
    useColorMode().preference = 'dark'
    const wrapper = await mountReadme('<p>Loading README</p>')

    await wrapper.setProps({ html })

    await expect.poll(() => wrapper.get('img').element.currentSrc).toBe(darkImage)
  })

  it('preserves the prehydrated image until the saved theme is available', async () => {
    const colorMode = useColorMode()
    colorMode.unknown = true
    const wrapper = await mountReadme(`<picture>
      <source srcset="${darkImage}" media="all" data-color-mode-media="(prefers-color-scheme: dark)">
      <img src="${lightImage}" alt="Prehydrated banner">
    </picture>`)

    await expect.poll(() => wrapper.get('img').element.currentSrc).toBe(darkImage)

    colorMode.preference = 'dark'
    colorMode.unknown = false
    await nextTick()

    expect(wrapper.get('source').attributes('media')).toBe('all')

    colorMode.preference = 'system'
    await nextTick()

    expect(wrapper.get('source').attributes('media')).toBe('(prefers-color-scheme: dark)')
  })

  it.each([' (prefers-color-scheme:dark) ', '(PREFERS-COLOR-SCHEME: DARK)'])(
    'recognizes equivalent media query syntax: %s',
    async media => {
      useColorMode().preference = 'dark'
      const wrapper = await mountReadme(html.replace('(prefers-color-scheme: dark)', media))

      await expect.poll(() => wrapper.get('img').element.currentSrc).toBe(darkImage)
    },
  )

  it('preserves compound and unrelated media conditions and source attributes', async () => {
    const wrapper = await mountReadme(`<picture>
      <source srcset="${darkImage} 1x, ${lightImage} 2x" type="image/svg+xml" media="(min-width: 800px) and (prefers-color-scheme: dark)">
      <source srcset="${darkImage}" media="print">
      <source srcset="${lightImage}">
      <img src="${lightImage}" alt="Responsive image">
    </picture>`)

    const sourceAttributes = wrapper.findAll('source').map(source => source.attributes())

    useColorMode().preference = 'dark'
    await nextTick()

    expect(wrapper.findAll('source').map(source => source.attributes())).toEqual(sourceAttributes)
  })

  it('uses the fallback image when no source matches the selected theme', async () => {
    useColorMode().preference = 'light'
    const wrapper = await mountReadme(`<picture>
      <source srcset="${darkImage}" media="(prefers-color-scheme: dark)">
      <img src="${lightImage}" alt="Fallback image">
    </picture>`)

    await expect.poll(() => wrapper.get('img').element.currentSrc).toBe(lightImage)
  })
})
