import { describe, expect, it } from 'vitest'
import {
  isTrustedImageDomain,
  isAllowedImageUrl,
  toProxiedImageUrl,
} from '../../../../shared/utils/image-proxy'

describe('Image Proxy Utils', () => {
  describe('isTrustedImageDomain', () => {
    it('trusts GitHub raw content URLs', () => {
      expect(
        isTrustedImageDomain('https://raw.githubusercontent.com/owner/repo/main/img.png'),
      ).toBe(true)
    })

    it('trusts GitHub user images', () => {
      expect(isTrustedImageDomain('https://user-images.githubusercontent.com/123/image.png')).toBe(
        true,
      )
    })

    it('trusts shields.io badge URLs', () => {
      expect(isTrustedImageDomain('https://img.shields.io/badge/test-passing-green')).toBe(true)
    })

    it('trusts jsdelivr CDN URLs', () => {
      expect(isTrustedImageDomain('https://cdn.jsdelivr.net/npm/pkg/logo.png')).toBe(true)
    })

    it('trusts npmx.dev URLs', () => {
      expect(isTrustedImageDomain('https://npmx.dev/images/logo.png')).toBe(true)
    })

    it('trusts subdomain of trusted domains', () => {
      expect(isTrustedImageDomain('https://sub.gitlab.com/image.png')).toBe(true)
    })

    it('does not trust arbitrary domains', () => {
      expect(isTrustedImageDomain('https://evil-tracker.com/pixel.gif')).toBe(false)
    })

    it('does not trust similar-looking domains', () => {
      expect(isTrustedImageDomain('https://notgithub.com/image.png')).toBe(false)
    })

    it('returns false for invalid URLs', () => {
      expect(isTrustedImageDomain('not-a-url')).toBe(false)
    })
  })

  describe('isAllowedImageUrl', () => {
    it('allows HTTPS URLs', () => {
      expect(isAllowedImageUrl('https://example.com/image.png')).toBe(true)
    })

    it('allows HTTP URLs', () => {
      expect(isAllowedImageUrl('http://example.com/image.png')).toBe(true)
    })

    it('blocks data: URIs', () => {
      expect(isAllowedImageUrl('data:image/png;base64,abc')).toBe(false)
    })

    it('blocks javascript: URIs', () => {
      expect(isAllowedImageUrl('javascript:alert(1)')).toBe(false)
    })

    it('blocks localhost', () => {
      expect(isAllowedImageUrl('http://localhost/image.png')).toBe(false)
    })

    it('blocks 127.0.0.1', () => {
      expect(isAllowedImageUrl('http://127.0.0.1/image.png')).toBe(false)
    })

    it('blocks private IPs (10.x)', () => {
      expect(isAllowedImageUrl('http://10.0.0.1/image.png')).toBe(false)
    })

    it('blocks private IPs (192.168.x)', () => {
      expect(isAllowedImageUrl('http://192.168.1.1/image.png')).toBe(false)
    })

    it('blocks .local domains', () => {
      expect(isAllowedImageUrl('http://myhost.local/image.png')).toBe(false)
    })

    it('blocks .internal domains', () => {
      expect(isAllowedImageUrl('http://service.internal/image.png')).toBe(false)
    })

    it('returns false for invalid URLs', () => {
      expect(isAllowedImageUrl('not-a-url')).toBe(false)
    })
  })

  describe('toProxiedImageUrl', () => {
    it('returns trusted URLs as-is', () => {
      const url = 'https://raw.githubusercontent.com/owner/repo/main/image.png'
      expect(toProxiedImageUrl(url)).toBe(url)
    })

    it('proxies untrusted external URLs', () => {
      const url = 'https://evil-tracker.com/pixel.gif'
      expect(toProxiedImageUrl(url)).toBe(
        `/api/registry/image-proxy?url=${encodeURIComponent(url)}`,
      )
    })

    it('proxies unknown third-party image hosts', () => {
      const url = 'https://some-random-site.com/tracking-pixel.png'
      expect(toProxiedImageUrl(url)).toBe(
        `/api/registry/image-proxy?url=${encodeURIComponent(url)}`,
      )
    })

    it('does not proxy shields.io badges', () => {
      const url = 'https://img.shields.io/badge/build-passing-green'
      expect(toProxiedImageUrl(url)).toBe(url)
    })

    it('does not proxy jsdelivr CDN images', () => {
      const url = 'https://cdn.jsdelivr.net/npm/pkg/logo.png'
      expect(toProxiedImageUrl(url)).toBe(url)
    })

    it('returns empty string for empty input', () => {
      expect(toProxiedImageUrl('')).toBe('')
    })

    it('returns anchor links as-is', () => {
      expect(toProxiedImageUrl('#section')).toBe('#section')
    })

    it('returns data URIs as-is', () => {
      expect(toProxiedImageUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
    })

    it('returns relative URLs as-is', () => {
      expect(toProxiedImageUrl('./images/logo.png')).toBe('./images/logo.png')
    })

    it('does not proxy GitHub blob URLs', () => {
      const url = 'https://github.com/owner/repo/blob/main/assets/logo.png'
      expect(toProxiedImageUrl(url)).toBe(url)
    })
  })
})
