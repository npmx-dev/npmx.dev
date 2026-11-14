/// <reference lib="webworker" />
/// <reference lib="webworker.importscripts" />
/// <reference types="vite/client" />
import {
  cleanupOutdatedCaches,
  // createHandlerBoundToURL,
  // precacheAndRoute,
} from '@composable-vite-pwa/workbox-swkit/precaching'
// import { NavigationRoute, registerRoute } from '@composable-vite-pwa/workbox-swkit/routing'
// import { NetworkFirst, StaleWhileRevalidate } from '@composable-vite-pwa/workbox-swkit/strategies'
// import { CacheableResponsePlugin } from '@composable-vite-pwa/workbox-swkit/cacheable-response'
// import { ExpirationPlugin } from '@composable-vite-pwa/workbox-swkit/expiration'

declare const self: ServiceWorkerGlobalScope

// const cacheNames = ['npmx-packages', 'npmx-packages-code-and-docs', 'npmx-vercel-proxies'] as const

// async function createRuntimeCaches() {
//   await Promise.all(cacheNames.map(c => caches.open(c)))
// }

// self.addEventListener('install', event => {
//   event.waitUntil(createRuntimeCaches())
// })

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})
/*
// oxlint-disable-next-line no-underscore-dangle
precacheAndRoute(self.__WB_MANIFEST, {
  parallel: { enabled: true, concurrency: 5 },
  urlManipulation: ({ url }) => {
    const urls: URL[] = []
    if (url.pathname.endsWith('_payload.json')) {
      const newUrl = new URL(url.href)
      newUrl.search = ''
      urls.push(newUrl)
    }
    return urls
  },
})*/

// clean old assets
cleanupOutdatedCaches()

// allow only fallback in dev: we don't want to cache anything
/*let allowlist: undefined | RegExp[]
if (import.meta.env.DEV) {
  allowlist = [/^\/$/]
}

let denylist: undefined | RegExp[]
if (import.meta.env.PROD) {
  denylist = [
    /^\/search$/,
    /^\/search\?/,
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
    /^\/workbox-(classic|module)-$/,
    /^\/npmx-sw-(classic|module)\.js$/,
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
      cacheName: cacheNames[2],
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 }),
      ],
    }),
  )
}*/

// to allow work offline
// registerRoute(new NavigationRoute(createHandlerBoundToURL('/'), { allowlist, denylist }))
