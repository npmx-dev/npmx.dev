import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

const cacheNames = ['npmx-packages', 'npmx-packages-code-and-docs', 'npmx-vercel-proxies'] as const

async function createRuntimeCaches() {
  await Promise.all(cacheNames.map(c => caches.open(c)))
}
self.addEventListener('install', event => {
  event.waitUntil(createRuntimeCaches())
})

self.skipWaiting()
clientsClaim()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST, {
  urlManipulation: ({ url }) => {
    const urls: URL[] = []
    // search use query params, we need to include here any page using query params
    if (url.pathname.endsWith('_payload.json') || url.pathname.endsWith('/search')) {
      const newUrl = new URL(url.href)
      newUrl.search = ''
      urls.push(newUrl)
    }
    return urls
  },
})

// allow only fallback in dev: we don't want to cache anything
let allowlist: undefined | RegExp[]
if (import.meta.env.DEV) allowlist = [/^\/$/]

// deny api and server page calls
let denylist: undefined | RegExp[]
if (import.meta.env.PROD) {
  denylist = [
    // search page
    /^\/search$/,
    /^\/search?/,
    /^\/~/,
    /^\/org\//,
    // api calls
    /^\/api\//,
    /^\/oauth\//,
    /^\/package\//,
    /^\/package-code\//,
    /^\/package-docs\//,
    /^\/_v\//,
    /^\/opensearch\.xml$/,
    // exclude sw: if the user navigates to it, fallback to index.html
    /^\/service-worker\.js$/,
  ]

  registerRoute(
    ({ sameOrigin, url }) =>
      sameOrigin &&
      (url.pathname.startsWith('/package/') ||
        url.pathname.startsWith('/org/') ||
        url.pathname.startsWith('/~') ||
        url.pathname.startsWith('/api/')),
    new NetworkFirst({
      cacheName: cacheNames[0],
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 1000, maxAgeSeconds: 60 }),
      ],
    }),
  )
  registerRoute(
    ({ sameOrigin, url }) =>
      sameOrigin &&
      (url.pathname.startsWith('/package-docs/') || url.pathname.startsWith('/package-code/')),
    new StaleWhileRevalidate({
      cacheName: cacheNames[1],
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 1000, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      ],
    }),
  )
  registerRoute(
    ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/_v/'),
    new NetworkFirst({
      cacheName: cacheNames[1],
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 }),
      ],
    }),
  )
}

// to allow work offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('/'), { allowlist, denylist }))
