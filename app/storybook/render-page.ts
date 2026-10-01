import { clearNuxtData, useRouter } from '#app'
import { PageRouteSymbol } from '#app/components/injections'
import { h, provide, shallowReactive, Suspense } from 'vue'
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

export function renderPageAt(component: Component, path: RouteLocationRaw) {
  return () => ({
    setup() {
      clearNuxtData()

      const router = useRouter()
      const routeForStory = shallowReactive(router.resolve(path))
      provide(PageRouteSymbol, routeForStory)

      if (router.currentRoute.value.fullPath !== routeForStory.fullPath) {
        router.replace(path).catch(() => {})
      }

      return () =>
        h(Suspense, null, {
          default: () => h(component),
        })
    },
  })
}
