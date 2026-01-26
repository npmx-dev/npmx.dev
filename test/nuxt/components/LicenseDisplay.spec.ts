import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LicenseDisplay from '~/components/LicenseDisplay.vue'

describe('LicenseDisplay', () => {
  describe('single license', () => {
    it('renders a valid SPDX license as a link', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: 'MIT' },
      })
      const link = component.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('https://spdx.org/licenses/MIT.html')
      expect(link.text()).toBe('MIT')
    })

    it('renders an invalid license as plain text', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: 'CustomLicense' },
      })
      const link = component.find('a')
      expect(link.exists()).toBe(false)
      expect(component.text()).toContain('CustomLicense')
    })

    it('shows scales icon for valid license', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: 'MIT' },
      })
      const icon = component.find('.i-carbon-scales')
      expect(icon.exists()).toBe(true)
    })

    it('does not show scales icon for invalid license', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: 'CustomLicense' },
      })
      const icon = component.find('.i-carbon-scales')
      expect(icon.exists()).toBe(false)
    })
  })

  describe('compound expressions with OR', () => {
    it('renders "MIT OR Apache-2.0" with both licenses linked', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: 'MIT OR Apache-2.0' },
      })
      const links = component.findAll('a')
      expect(links).toHaveLength(2)
      expect(links[0]?.attributes('href')).toBe('https://spdx.org/licenses/MIT.html')
      expect(links[1]?.attributes('href')).toBe('https://spdx.org/licenses/Apache-2.0.html')
      // Operator is rendered lowercase
      expect(component.text().toLowerCase()).toContain('or')
    })

    it('renders triple license choice correctly', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: '(BSD-2-Clause OR MIT OR Apache-2.0)' },
      })
      const links = component.findAll('a')
      expect(links).toHaveLength(3)
    })
  })

  describe('compound expressions with AND', () => {
    it('renders "MIT AND Zlib" with both licenses linked', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: 'MIT AND Zlib' },
      })
      const links = component.findAll('a')
      expect(links).toHaveLength(2)
      expect(links[0]?.attributes('href')).toBe('https://spdx.org/licenses/MIT.html')
      expect(links[1]?.attributes('href')).toBe('https://spdx.org/licenses/Zlib.html')
      // Operator is rendered lowercase
      expect(component.text().toLowerCase()).toContain('and')
    })
  })

  describe('compound expressions with WITH', () => {
    it('renders license with exception', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: 'GPL-2.0-only WITH Classpath-exception-2.0' },
      })
      // GPL-2.0-only is a valid license, Classpath-exception-2.0 is an exception (not a license)
      const links = component.findAll('a')
      expect(links.length).toBeGreaterThanOrEqual(1)
      expect(links[0]?.attributes('href')).toBe('https://spdx.org/licenses/GPL-2.0-only.html')
      // Operator is rendered lowercase
      expect(component.text().toLowerCase()).toContain('with')
    })
  })

  describe('mixed valid and invalid', () => {
    it('renders valid licenses as links and invalid as text', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: 'MIT OR CustomLicense' },
      })
      const links = component.findAll('a')
      expect(links).toHaveLength(1)
      expect(links[0]?.text()).toBe('MIT')
      expect(component.text()).toContain('CustomLicense')
    })

    it('shows scales icon when at least one license is valid', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: 'CustomLicense OR MIT' },
      })
      const icon = component.find('.i-carbon-scales')
      expect(icon.exists()).toBe(true)
    })
  })

  describe('parentheses', () => {
    it('strips parentheses from expressions for cleaner display', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: '(MIT OR Apache-2.0)' },
      })
      // Parentheses are stripped for cleaner display
      expect(component.text()).not.toContain('(')
      expect(component.text()).not.toContain(')')
      const links = component.findAll('a')
      expect(links).toHaveLength(2)
    })
  })

  describe('real-world examples', () => {
    it('handles rc package license: (BSD-2-Clause OR MIT OR Apache-2.0)', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: '(BSD-2-Clause OR MIT OR Apache-2.0)' },
      })
      const links = component.findAll('a')
      expect(links).toHaveLength(3)
      expect(links.map(l => l.text())).toEqual(['BSD-2-Clause', 'MIT', 'Apache-2.0'])
    })

    it('handles jszip package license: (MIT OR GPL-3.0-or-later)', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: '(MIT OR GPL-3.0-or-later)' },
      })
      const links = component.findAll('a')
      expect(links).toHaveLength(2)
    })

    it('handles pako package license: (MIT AND Zlib)', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: '(MIT AND Zlib)' },
      })
      const links = component.findAll('a')
      expect(links).toHaveLength(2)
    })
  })
})
